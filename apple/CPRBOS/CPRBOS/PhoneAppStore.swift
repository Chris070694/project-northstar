import Foundation
import Combine

@MainActor
final class PhoneAppStore: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published private(set) var isBusy = false
    @Published private(set) var isAuthenticated = false
    @Published private(set) var activeWorkout: FitnessSession?
    @Published var message = "Melde dich einmal an, um die Watch zu verbinden."

    private var accessToken = ""

    func login() async {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            message = "Bitte E-Mail und Passwort eingeben."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let url = URL(string: "\(CPRBConfig.supabaseURL)/auth/v1/token?grant_type=password")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(CPRBConfig.supabasePublishableKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
                "password": password
            ])

            let (data, response) = try await URLSession.shared.data(for: request)
            try validate(response: response, data: data)
            let auth = try JSONDecoder().decode(AuthResponse.self, from: data)
            accessToken = auth.accessToken
            password = ""
            isAuthenticated = true
            PhoneWatchBridge.shared.updateCredentials(accessToken: auth.accessToken)
            message = "Angemeldet – CPRB kann jetzt mit deiner Watch synchronisieren."
            await refreshWorkout()
        } catch {
            isAuthenticated = false
            message = error.localizedDescription
        }
    }

    func refreshWorkout() async {
        guard !accessToken.isEmpty else { return }
        do {
            let path = "fitness_sessions?select=id,plan_id,plan_name_snapshot,status&status=eq.active&order=started_at.desc&limit=1"
            let data = try await authorizedRequest(path: path)
            activeWorkout = try JSONDecoder().decode([FitnessSession].self, from: data).first
        } catch {
            message = error.localizedDescription
        }
    }

    func sendToWatchAgain() {
        PhoneWatchBridge.shared.sendCredentials()
    }

    private func authorizedRequest(path: String) async throws -> Data {
        guard let url = URL(string: "\(CPRBConfig.supabaseURL)/rest/v1/\(path)") else {
            throw CPRBError.invalidURL
        }
        var request = URLRequest(url: url)
        request.setValue(CPRBConfig.supabasePublishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return data
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
