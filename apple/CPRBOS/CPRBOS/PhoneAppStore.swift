import Foundation
import Combine

@MainActor
final class PhoneAppStore: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published private(set) var isBusy = false
    @Published private(set) var isRestoringSession = false
    @Published private(set) var isAuthenticated = false
    @Published private(set) var activeWorkout: FitnessSession?
    @Published var message = "Melde dich einmal an, um die Watch zu verbinden."

    private var accessToken = ""
    private var refreshToken = ""
    private var accessTokenExpiresAt = Date.distantPast
    private var automaticRefreshTask: Task<Void, Never>?
    private var sessionRefreshTask: Task<AuthResponse, Error>?
    private var hasAttemptedSessionRestore = false

    deinit {
        automaticRefreshTask?.cancel()
    }

    func restoreSession() async {
        guard !hasAttemptedSessionRestore else { return }
        hasAttemptedSessionRestore = true
        isRestoringSession = true
        defer { isRestoringSession = false }

        do {
            guard let storedRefreshToken = try KeychainCredentialStore.readRefreshToken() else { return }
            refreshToken = storedRefreshToken
            try await refreshSession()
            isAuthenticated = true
            message = "Anmeldung wiederhergestellt – die Watch wird automatisch verbunden."
            await refreshWorkout()
        } catch CPRBError.sessionExpired {
            endSession(message: CPRBError.sessionExpired.localizedDescription)
        } catch {
            message = "Gespeicherte Anmeldung vorhanden. Erneuter Versuch bei Internetverbindung."
            scheduleAutomaticRefresh(after: 60)
        }
    }

    func login() async {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            message = "Bitte E-Mail und Passwort eingeben."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let parameters = [
                "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
                "password": password
            ]
            let phoneAuth = try await authenticate(
                grantType: "password",
                parameters: parameters
            )
            let watchAuth = try await authenticate(
                grantType: "password",
                parameters: parameters
            )
            try accept(auth: phoneAuth, previousRefreshToken: nil)
            try provisionWatch(with: watchAuth)
            password = ""
            isAuthenticated = true
            message = "Dauerhaft angemeldet – CPRB erneuert die Watch-Verbindung automatisch."
            await refreshWorkout()
        } catch {
            isAuthenticated = false
            message = error.localizedDescription
        }
    }

    func refreshWorkout() async {
        guard isAuthenticated || !refreshToken.isEmpty else { return }
        do {
            let path = "fitness_sessions?select=id,plan_id,plan_name_snapshot,status&status=eq.active&order=started_at.desc&limit=1"
            let data = try await authorizedRequest(path: path)
            activeWorkout = try JSONDecoder().decode([FitnessSession].self, from: data).first
        } catch CPRBError.sessionExpired {
            endSession(message: CPRBError.sessionExpired.localizedDescription)
        } catch {
            message = error.localizedDescription
        }
    }

    func sendToWatchAgain() {
        PhoneWatchBridge.shared.sendCredentials()
    }

    func logout() {
        endSession(message: "Abgemeldet. Die Watch-Verbindung wurde entfernt.")
    }

    private func authorizedRequest(path: String, mayRetryAfterRefresh: Bool = true) async throws -> Data {
        let validAccessToken = try await accessTokenForRequest()
        guard let url = URL(string: "\(CPRBConfig.supabaseURL)/rest/v1/\(path)") else {
            throw CPRBError.invalidURL
        }
        var request = URLRequest(url: url)
        request.setValue(CPRBConfig.supabasePublishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(validAccessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        if mayRetryAfterRefresh,
           let http = response as? HTTPURLResponse,
           http.statusCode == 401 {
            try await refreshSession()
            return try await authorizedRequest(path: path, mayRetryAfterRefresh: false)
        }
        try validate(response: response, data: data)
        return data
    }

    private func accessTokenForRequest() async throws -> String {
        guard !refreshToken.isEmpty else { throw CPRBError.sessionExpired }
        if accessToken.isEmpty || accessTokenExpiresAt.timeIntervalSinceNow <= 300 {
            try await refreshSession()
        }
        return accessToken
    }

    private func refreshSession() async throws {
        guard !refreshToken.isEmpty else { throw CPRBError.sessionExpired }
        let previousRefreshToken = refreshToken
        if let sessionRefreshTask {
            let auth = try await sessionRefreshTask.value
            try accept(auth: auth, previousRefreshToken: previousRefreshToken)
            isAuthenticated = true
            return
        }

        let refreshTask = Task { @MainActor in
            try await authenticate(
                grantType: "refresh_token",
                parameters: ["refresh_token": previousRefreshToken]
            )
        }
        sessionRefreshTask = refreshTask
        let auth: AuthResponse
        do {
            auth = try await refreshTask.value
            sessionRefreshTask = nil
        } catch {
            sessionRefreshTask = nil
            throw error
        }
        try accept(auth: auth, previousRefreshToken: previousRefreshToken)
        isAuthenticated = true
    }

    private func authenticate(grantType: String, parameters: [String: String]) async throws -> AuthResponse {
        guard let url = URL(
            string: "\(CPRBConfig.supabaseURL)/auth/v1/token?grant_type=\(grantType)"
        ) else {
            throw CPRBError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(CPRBConfig.supabasePublishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: parameters)

        let (data, response) = try await URLSession.shared.data(for: request)
        if grantType == "refresh_token",
           let http = response as? HTTPURLResponse,
           http.statusCode == 400 || http.statusCode == 401 {
            throw CPRBError.sessionExpired
        }
        try validate(response: response, data: data)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    private func accept(auth: AuthResponse, previousRefreshToken: String?) throws {
        guard let newRefreshToken = auth.refreshToken ?? previousRefreshToken,
              !newRefreshToken.isEmpty else {
            throw CPRBError.sessionExpired
        }
        try KeychainCredentialStore.saveRefreshToken(newRefreshToken)

        accessToken = auth.accessToken
        refreshToken = newRefreshToken
        if let expiresAt = auth.expiresAt {
            accessTokenExpiresAt = Date(timeIntervalSince1970: expiresAt)
        } else {
            accessTokenExpiresAt = Date().addingTimeInterval(auth.expiresIn ?? 3600)
        }
        scheduleAutomaticRefresh()
    }

    private func provisionWatch(with auth: AuthResponse) throws {
        guard let watchRefreshToken = auth.refreshToken, !watchRefreshToken.isEmpty else {
            throw CPRBError.sessionExpired
        }
        let expiresAt = auth.expiresAt.map(Date.init(timeIntervalSince1970:))
            ?? Date().addingTimeInterval(auth.expiresIn ?? 3600)
        PhoneWatchBridge.shared.updateCredentials(
            accessToken: auth.accessToken,
            refreshToken: watchRefreshToken,
            expiresAt: expiresAt
        )
    }

    private func scheduleAutomaticRefresh(after overrideDelay: TimeInterval? = nil) {
        automaticRefreshTask?.cancel()
        let delay = overrideDelay ?? max(30, accessTokenExpiresAt.timeIntervalSinceNow - 300)
        automaticRefreshTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled, let self else { return }
                try await self.refreshSession()
                self.message = "Anmeldung automatisch erneuert – Watch ist aktuell."
            } catch is CancellationError {
                return
            } catch CPRBError.sessionExpired {
                self?.endSession(message: CPRBError.sessionExpired.localizedDescription)
            } catch {
                self?.message = "Automatische Erneuerung wartet auf Internetverbindung."
                self?.scheduleAutomaticRefresh(after: 60)
            }
        }
    }

    private func endSession(message: String) {
        automaticRefreshTask?.cancel()
        automaticRefreshTask = nil
        sessionRefreshTask?.cancel()
        sessionRefreshTask = nil
        accessToken = ""
        refreshToken = ""
        accessTokenExpiresAt = .distantPast
        isAuthenticated = false
        activeWorkout = nil
        password = ""
        try? KeychainCredentialStore.deleteRefreshToken()
        PhoneWatchBridge.shared.clearCredentials()
        self.message = message
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw CPRBError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let serverMessage = payload?["msg"] as? String
                ?? payload?["message"] as? String
                ?? "CPRB-Verbindung fehlgeschlagen (\(http.statusCode))."
            throw CPRBError.server(serverMessage)
        }
    }
}
