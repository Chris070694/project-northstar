import Foundation
import Combine
import WatchConnectivity

@MainActor
final class WatchWorkoutStore: NSObject, ObservableObject {
    @Published private(set) var session: WatchFitnessSession?
    @Published private(set) var exercises: [WatchExercise] = []
    @Published private(set) var sets: [WatchSetLog] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isConnected = false
    @Published var message = "Warte auf die iPhone-Verbindung…"

    private var supabaseURL = ""
    private var supabaseKey = ""
    private var accessToken = ""
    private var refreshToken = ""
    private var accessTokenExpiresAt = Date.distantPast
    private var sessionRefreshTask: Task<WatchAuthResponse, Error>?
    private let watchSession: WCSession? = WCSession.isSupported() ? .default : nil

    override init() {
        super.init()
        if let storedCredentials = try? WatchCredentialStore.read() {
            apply(credentials: storedCredentials, shouldLoadWorkout: false)
        }
        watchSession?.delegate = self
        watchSession?.activate()
        if let context = watchSession?.receivedApplicationContext, !context.isEmpty {
            apply(context: context)
        } else if hasCredentials {
            message = "Gespeicherte Anmeldung geladen – Training wird aktualisiert…"
            Task { await loadWorkout() }
        }
    }

    var completedSetCount: Int {
        sets.filter(\.isCompleted).count
    }

    func sets(for exerciseID: String) -> [WatchSetLog] {
        sets.filter { $0.sessionExerciseId == exerciseID }
            .sorted { $0.setNumber < $1.setNumber }
    }

    func set(with id: String) -> WatchSetLog? {
        sets.first { $0.id == id }
    }

    func loadWorkout() async {
        guard hasCredentials else {
            message = WatchCPRBError.missingConnection.localizedDescription
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let sessions: [WatchFitnessSession] = try await get(
                "fitness_sessions?select=id,plan_name_snapshot&status=eq.active&order=started_at.desc&limit=1"
            )
            guard let active = sessions.first else {
                session = nil
                exercises = []
                sets = []
                message = "Kein Training aktiv. Starte A oder B zuerst am iPhone."
                return
            }

            let loadedExercises: [WatchExercise] = try await get(
                "fitness_session_exercises?select=id,exercise_name,muscle_group,position&session_id=eq.\(active.id)&order=position.asc"
            )
            let loadedSets: [WatchSetLog] = try await get(
                "fitness_set_logs?select=id,session_exercise_id,set_number,actual_reps,weight_kg,is_completed,previous_weight_kg,previous_reps,completed_at&session_id=eq.\(active.id)&order=set_number.asc"
            )

            session = active
            exercises = loadedExercises
            sets = loadedSets
            message = "\(completedSetCount)/\(sets.count) Sätze erledigt"
        } catch {
            if error.localizedDescription.lowercased().contains("jwt") {
                message = "Anmeldung abgelaufen. Öffne die iPhone-App und melde dich erneut an."
            } else {
                message = error.localizedDescription
            }
        }
    }

    func changeWeight(setID: String, by delta: Double) async {
        guard let index = sets.firstIndex(where: { $0.id == setID }) else { return }
        let oldValue = sets[index].weightKg
        let newValue = max(0, min(500, ((oldValue + delta) * 2).rounded() / 2))
        sets[index].weightKg = newValue
        do {
            try await patch(table: "fitness_set_logs", id: setID, values: ["weight_kg": newValue])
        } catch {
            sets[index].weightKg = oldValue
            message = error.localizedDescription
        }
    }

    func changeReps(setID: String, by delta: Int) async {
        guard let index = sets.firstIndex(where: { $0.id == setID }) else { return }
        let oldValue = sets[index].actualReps
        let newValue = max(0, min(200, oldValue + delta))
        sets[index].actualReps = newValue
        do {
            try await patch(table: "fitness_set_logs", id: setID, values: ["actual_reps": newValue])
        } catch {
            sets[index].actualReps = oldValue
            message = error.localizedDescription
        }
    }

    func toggleSet(setID: String) async {
        guard let index = sets.firstIndex(where: { $0.id == setID }) else { return }
        let oldValue = sets[index].isCompleted
        let newValue = !oldValue
        let completedAt = newValue ? ISO8601DateFormatter().string(from: Date()) : nil
        sets[index].isCompleted = newValue
        sets[index].completedAt = completedAt

        do {
            var values: [String: Any] = ["is_completed": newValue]
            if let completedAt {
                values["completed_at"] = completedAt
            } else {
                values["completed_at"] = NSNull()
            }
            try await patch(table: "fitness_set_logs", id: setID, values: values)
            try await syncExercise(exerciseID: sets[index].sessionExerciseId)
            message = "\(completedSetCount)/\(sets.count) Sätze erledigt"
        } catch {
            sets[index].isCompleted = oldValue
            sets[index].completedAt = nil
            message = error.localizedDescription
        }
    }

    private var hasCredentials: Bool {
        !supabaseURL.isEmpty && !supabaseKey.isEmpty && !accessToken.isEmpty
    }

    private func apply(context: [String: Any]) {
        if context["signedOut"] as? Bool == true {
            clearCredentials(message: "Auf dem iPhone abgemeldet. Öffne CPRB OS dort erneut.")
            return
        }
        guard let url = context["supabaseURL"] as? String,
              let key = context["supabaseKey"] as? String,
              let token = context["accessToken"] as? String,
              let newRefreshToken = context["refreshToken"] as? String,
              let expiresAt = context["accessTokenExpiresAt"] as? Double else { return }
        let contextExpiration = Date(timeIntervalSince1970: expiresAt)
        if hasCredentials, accessTokenExpiresAt >= contextExpiration {
            Task { await loadWorkout() }
            return
        }
        guard contextExpiration > Date() else {
            message = "Watch-Anmeldung ist zu alt. Melde dich in CPRB OS auf dem iPhone erneut an."
            return
        }
        let credentials = WatchStoredCredentials(
            supabaseURL: url,
            supabaseKey: key,
            accessToken: token,
            refreshToken: newRefreshToken,
            accessTokenExpiresAt: contextExpiration
        )
        apply(credentials: credentials, shouldLoadWorkout: true)
    }

    private func apply(credentials: WatchStoredCredentials, shouldLoadWorkout: Bool) {
        supabaseURL = credentials.supabaseURL
        supabaseKey = credentials.supabaseKey
        accessToken = credentials.accessToken
        refreshToken = credentials.refreshToken
        accessTokenExpiresAt = credentials.accessTokenExpiresAt
        try? WatchCredentialStore.save(credentials)
        isConnected = true
        message = "Verbunden – Training wird geladen…"
        if shouldLoadWorkout {
            Task { await loadWorkout() }
        }
    }

    private func persistCredentials() throws {
        try WatchCredentialStore.save(
            WatchStoredCredentials(
                supabaseURL: supabaseURL,
                supabaseKey: supabaseKey,
                accessToken: accessToken,
                refreshToken: refreshToken,
                accessTokenExpiresAt: accessTokenExpiresAt
            )
        )
    }

    private func clearCredentials(message: String) {
        supabaseURL = ""
        supabaseKey = ""
        accessToken = ""
        refreshToken = ""
        accessTokenExpiresAt = .distantPast
        sessionRefreshTask?.cancel()
        sessionRefreshTask = nil
        session = nil
        exercises = []
        sets = []
        isConnected = false
        try? WatchCredentialStore.delete()
        self.message = message
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let data = try await request(path: path, method: "GET", body: nil)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func patch(table: String, id: String, values: [String: Any]) async throws {
        let body = try JSONSerialization.data(withJSONObject: values)
        _ = try await request(path: "\(table)?id=eq.\(id)", method: "PATCH", body: body)
    }

    private func syncExercise(exerciseID: String) async throws {
        let exerciseSets = sets(for: exerciseID)
        let isComplete = !exerciseSets.isEmpty && exerciseSets.allSatisfy(\.isCompleted)
        let completedWeights = exerciseSets.filter(\.isCompleted).map(\.weightKg)
        let maxWeight = completedWeights.max() ?? 0
        var values: [String: Any] = [
            "is_completed": isComplete,
            "actual_weight": maxWeight
        ]
        if isComplete {
            values["completed_at"] = ISO8601DateFormatter().string(from: Date())
        } else {
            values["completed_at"] = NSNull()
        }
        try await patch(table: "fitness_session_exercises", id: exerciseID, values: values)
    }

    private func request(
        path: String,
        method: String,
        body: Data?,
        mayRetryAfterRefresh: Bool = true
    ) async throws -> Data {
        try await refreshAccessTokenIfNeeded()
        guard hasCredentials else { throw WatchCPRBError.missingConnection }
        guard let url = URL(string: "\(supabaseURL)/rest/v1/\(path)") else {
            throw WatchCPRBError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WatchCPRBError.invalidResponse
        }
        if http.statusCode == 401, mayRetryAfterRefresh {
            try await refreshAccessToken()
            return try await self.request(
                path: path,
                method: method,
                body: body,
                mayRetryAfterRefresh: false
            )
        }
        guard (200...299).contains(http.statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let serverMessage = payload?["message"] as? String
                ?? payload?["msg"] as? String
                ?? "CPRB-Verbindung fehlgeschlagen (\(http.statusCode))."
            throw WatchCPRBError.server(serverMessage)
        }
        return data
    }

    private func refreshAccessTokenIfNeeded() async throws {
        guard accessTokenExpiresAt.timeIntervalSinceNow <= 300 else { return }
        try await refreshAccessToken()
    }

    private func refreshAccessToken() async throws {
        guard !refreshToken.isEmpty else { throw WatchCPRBError.missingConnection }
        let previousRefreshToken = refreshToken
        let auth: WatchAuthResponse
        if let sessionRefreshTask {
            auth = try await sessionRefreshTask.value
        } else {
            let refreshTask = Task { @MainActor in
                try await requestRefreshedAuth(using: previousRefreshToken)
            }
            sessionRefreshTask = refreshTask
            do {
                auth = try await refreshTask.value
                sessionRefreshTask = nil
            } catch {
                sessionRefreshTask = nil
                throw error
            }
        }

        accessToken = auth.accessToken
        refreshToken = auth.refreshToken ?? previousRefreshToken
        if let expiresAt = auth.expiresAt {
            accessTokenExpiresAt = Date(timeIntervalSince1970: expiresAt)
        } else {
            accessTokenExpiresAt = Date().addingTimeInterval(auth.expiresIn ?? 3600)
        }
        try persistCredentials()
        isConnected = true
    }

    private func requestRefreshedAuth(using refreshToken: String) async throws -> WatchAuthResponse {
        guard let url = URL(
            string: "\(supabaseURL)/auth/v1/token?grant_type=refresh_token"
        ) else {
            throw WatchCPRBError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(
            withJSONObject: ["refresh_token": refreshToken]
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WatchCPRBError.invalidResponse
        }
        if http.statusCode == 400 || http.statusCode == 401 {
            clearCredentials(message: "Anmeldung abgelaufen. Öffne CPRB OS auf dem iPhone.")
            throw WatchCPRBError.missingConnection
        }
        guard (200...299).contains(http.statusCode) else {
            throw WatchCPRBError.server("Anmeldung konnte nicht erneuert werden (\(http.statusCode)).")
        }

        return try JSONDecoder().decode(WatchAuthResponse.self, from: data)
    }
}

extension WatchWorkoutStore: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let error {
                self.message = error.localizedDescription
                return
            }
            let context = session.receivedApplicationContext
            if !context.isEmpty {
                self.apply(context: context)
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor [weak self] in
            self?.apply(context: applicationContext)
        }
    }
}
