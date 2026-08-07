import Foundation
import Security

struct WatchStoredCredentials: Codable {
    let supabaseURL: String
    let supabaseKey: String
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresAt: Date
}

enum WatchCredentialStore {
    private static let service = "com.chris070694.CPRBOS.watch.authentication"
    private static let account = "supabase-credentials"

    static func save(_ credentials: WatchStoredCredentials) throws {
        let data = try JSONEncoder().encode(credentials)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw WatchCredentialStoreError(status: updateStatus)
        }

        var newItem = query
        attributes.forEach { newItem[$0.key] = $0.value }
        let addStatus = SecItemAdd(newItem as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw WatchCredentialStoreError(status: addStatus)
        }
    }

    static func read() throws -> WatchStoredCredentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw WatchCredentialStoreError(status: status)
        }
        return try JSONDecoder().decode(WatchStoredCredentials.self, from: data)
    }

    static func delete() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw WatchCredentialStoreError(status: status)
        }
    }
}

struct WatchCredentialStoreError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        "Die sichere Watch-Anmeldung konnte nicht gespeichert werden (\(status))."
    }
}
