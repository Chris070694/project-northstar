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
    private let session: WCSession? = WCSession.isSupported() ? .default : nil

    private override init() {
        super.init()
        session?.delegate = self
        session?.activate()
        refreshState()
    }

    func updateCredentials(accessToken: String) {
        self.accessToken = accessToken
        sendCredentials()
    }

    func sendCredentials() {
        guard let session, !accessToken.isEmpty else { return }
        let payload = [
            "supabaseURL": CPRBConfig.supabaseURL,
            "supabaseKey": CPRBConfig.supabasePublishableKey,
            "accessToken": accessToken,
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
            if error == nil, !self.accessToken.isEmpty {
                self.sendCredentials()
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
}
