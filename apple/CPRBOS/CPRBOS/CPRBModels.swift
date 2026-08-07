import Foundation

enum CPRBConfig {
    static let supabaseURL = "https://uwyswrvzoeshynfowxuz.supabase.co"
    static let supabasePublishableKey = "sb_publishable_x9YtEdlCRhqQdB163ZPDxA_UTxnzyey"
    static let webAppURL = URL(string: "https://cprb-git-main-chris0706.vercel.app/?page=fitness")!
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Double?
    let expiresAt: Double?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
    }
}

struct FitnessSession: Decodable, Identifiable {
    let id: String
    let planId: String?
    let planName: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case planId = "plan_id"
        case planName = "plan_name_snapshot"
        case status
    }
}

enum CPRBError: LocalizedError {
    case invalidURL
    case invalidResponse
    case sessionExpired
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Die CPRB-Verbindung ist ungültig."
        case .invalidResponse:
            return "CPRB hat keine gültige Antwort erhalten."
        case .sessionExpired:
            return "Deine CPRB-Anmeldung ist abgelaufen. Bitte melde dich erneut an."
        case .server(let message):
            return message
        }
    }
}
