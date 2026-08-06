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
    private let watchSession: WCSession? = WCSession.isSupported() ? .default : nil

    override init() {
        super.init()
        watchSession?.delegate = self
        watchSession?.activate()
        if let context = watchSession?.receivedApplicationContext, !context.isEmpty {
            apply(context: context)
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
        guard let url = context["supabaseURL"] as? String,
              let key = context["supabaseKey"] as? String,
              let token = context["accessToken"] as? String else { return }
        supabaseURL = url
        supabaseKey = key
        accessToken = token
        isConnected = true
        message = "Verbunden – Training wird geladen…"
        Task { await loadWorkout() }
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

    private func request(path: String, method: String, body: Data?) async throws -> Data {
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
        guard (200...299).contains(http.statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let serverMessage = payload?["message"] as? String
                ?? payload?["msg"] as? String
                ?? "CPRB-Verbindung fehlgeschlagen (\(http.statusCode))."
            throw WatchCPRBError.server(serverMessage)
        }
        return data
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
