import Foundation

struct WatchAuthResponse: Decodable {
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

struct WatchFitnessSession: Decodable, Identifiable {
    let id: String
    let planName: String

    enum CodingKeys: String, CodingKey {
        case id
        case planName = "plan_name_snapshot"
    }
}

struct WatchExercise: Decodable, Identifiable {
    let id: String
    let exerciseName: String
    let muscleGroup: String
    let position: Int

    enum CodingKeys: String, CodingKey {
        case id
        case exerciseName = "exercise_name"
        case muscleGroup = "muscle_group"
        case position
    }
}

struct WatchSetLog: Decodable, Identifiable {
    let id: String
    let sessionExerciseId: String
    let setNumber: Int
    var actualReps: Int
    var weightKg: Double
    var isCompleted: Bool
    let previousWeightKg: Double?
    let previousReps: Int?
    var completedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionExerciseId = "session_exercise_id"
        case setNumber = "set_number"
        case actualReps = "actual_reps"
        case weightKg = "weight_kg"
        case isCompleted = "is_completed"
        case previousWeightKg = "previous_weight_kg"
        case previousReps = "previous_reps"
        case completedAt = "completed_at"
    }
}

enum WatchCPRBError: LocalizedError {
    case missingConnection
    case invalidURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingConnection:
            return "Öffne CPRB OS einmal auf dem iPhone und melde dich an."
        case .invalidURL:
            return "Die CPRB-Adresse ist ungültig."
        case .invalidResponse:
            return "CPRB hat keine gültige Antwort erhalten."
        case .server(let message):
            return message
        }
    }
}
