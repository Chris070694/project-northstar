import Foundation
import Combine
import WatchConnectivity

@MainActor
final class PhoneWatchBridge: NSObject, ObservableObject {
    static let shared = PhoneWatchBridge()

    @Published private(set) var isPaired = false
    @Published private(set) var isWatchAppInstalled = false
    @Published private(set) var lastTransferMessage = "Noch nicht an die Watch gesendet"

    private var accessToken = ""
    private var refreshToken = ""
    private var accessTokenExpiresAt = Date.distantPast
    private var shouldSendSignOut = false
    private let session: WCSession? = WCSession.isSupported() ? .default : nil

    private override init() {
        super.init()
        session?.delegate = self
        session?.activate()
        refreshState()
    }

    func updateCredentials(accessToken: String, refreshToken: String, expiresAt: Date) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        accessTokenExpiresAt = expiresAt
        shouldSendSignOut = false
        sendCredentials()
    }

    func clearCredentials() {
        accessToken = ""
        refreshToken = ""
        accessTokenExpiresAt = .distantPast
        shouldSendSignOut = true
        sendSignOut()
    }

    func sendCredentials() {
        guard let session, !accessToken.isEmpty else { return }
        guard session.activationState == .activated else {
            lastTransferMessage = "Watch-Verbindung wird aktiviert…"
            session.activate()
            return
        }
        let payload: [String: Any] = [
            "supabaseURL": CPRBConfig.supabaseURL,
            "supabaseKey": CPRBConfig.supabasePublishableKey,
            "accessToken": accessToken,
            "refreshToken": refreshToken,
            "accessTokenExpiresAt": accessTokenExpiresAt.timeIntervalSince1970,
            "signedOut": false,
            "sentAt": ISO8601DateFormatter().string(from: Date())
        ]

        do {
            try session.updateApplicationContext(payload)
            lastTransferMessage = session.isReachable
                ? "Zugang wurde an die Watch gesendet"
                : "Zugang gespeichert – wird bei Verbindung übertragen"
        } catch {
            lastTransferMessage = "Übertragung fehlgeschlagen: \(error.localizedDescription)"
        }
        refreshState()
    }

    private func sendSignOut() {
        guard let session else { return }
        guard session.activationState == .activated else {
            session.activate()
            return
        }
        do {
            let payload: [String: Any] = [
                "signedOut": true,
                "sentAt": ISO8601DateFormatter().string(from: Date())
            ]
            try session.updateApplicationContext(payload)
            lastTransferMessage = "Abmeldung wurde an die Watch gesendet"
        } catch {
            lastTransferMessage = "Abmeldung konnte nicht übertragen werden: \(error.localizedDescription)"
        }
    }

    private func refreshState() {
        isPaired = session?.isPaired ?? false
        isWatchAppInstalled = session?.isWatchAppInstalled ?? false
    }
}

extension PhoneWatchBridge: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.refreshState()
            if error == nil {
                if self.shouldSendSignOut {
                    self.sendSignOut()
                } else if !self.accessToken.isEmpty {
                    self.sendCredentials()
                }
            }
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor [weak self] in
            self?.refreshState()
        }
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.refreshState()
            if session.isPaired, session.isWatchAppInstalled {
                if self.shouldSendSignOut {
                    self.sendSignOut()
                } else if !self.accessToken.isEmpty {
                    self.sendCredentials()
                }
            }
        }
    }
}
