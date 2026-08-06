import SwiftUI

struct ContentView: View {
    @StateObject private var store = PhoneAppStore()
    @StateObject private var bridge = PhoneWatchBridge.shared

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 0.025, green: 0.045, blue: 0.075), .black],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        header
                        if store.isAuthenticated {
                            connectedContent
                        } else {
                            loginCard
                        }
                    }
                    .padding()
                }
            }
            .preferredColorScheme(.dark)
            .navigationTitle("CPRB OS")
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 18)
                    .fill(LinearGradient(colors: [.cyan, .green], startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.black)
            }
            .frame(width: 64, height: 64)

            VStack(alignment: .leading, spacing: 3) {
                Text("WATCH BRIDGE")
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(.cyan)
                Text("Training am Handgelenk")
                    .font(.title2.bold())
                Text("Sätze, kg und Wiederholungen direkt synchronisieren.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private var loginCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("CPRB-Konto verbinden", systemImage: "lock.shield")
                .font(.headline)
            Text("Nutze dieselben Zugangsdaten wie in deiner CPRB-Web-App. Das Passwort wird nicht gespeichert.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            TextField("E-Mail", text: $store.email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textContentType(.username)
                .padding(12)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))

            SecureField("Passwort", text: $store.password)
                .textContentType(.password)
                .padding(12)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))

            Button {
                Task { await store.login() }
            } label: {
                HStack {
                    if store.isBusy { ProgressView() }
                    Text(store.isBusy ? "Verbinden…" : "Mit CPRB anmelden")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
            .disabled(store.isBusy)

            Text(store.message)
                .font(.footnote)
                .foregroundStyle(store.message.contains("fehl") ? .red : .secondary)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22))
    }

    private var connectedContent: some View {
        VStack(spacing: 14) {
            statusCard

            VStack(alignment: .leading, spacing: 10) {
                Text("AKTIVES TRAINING")
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(.cyan)
                if let workout = store.activeWorkout {
                    Text(workout.planName)
                        .font(.title2.bold())
                    Text("Läuft bereits und kann auf der Watch geöffnet werden.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Kein Training gestartet")
                        .font(.headline)
                    Text("Starte Training A oder B zuerst in CPRB OS. Danach hier und auf der Watch aktualisieren.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Button("Aktualisieren") {
                        Task { await store.refreshWorkout() }
                    }
                    .buttonStyle(.bordered)

                    Link("Fitness öffnen", destination: CPRBConfig.webAppURL)
                        .buttonStyle(.borderedProminent)
                        .tint(.cyan)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22))
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(
                    bridge.isWatchAppInstalled ? "Watch-App bereit" : "Watch-App noch nicht erkannt",
                    systemImage: bridge.isWatchAppInstalled ? "applewatch.radiowaves.left.and.right" : "applewatch.slash"
                )
                .font(.headline)
                Spacer()
                Circle()
                    .fill(bridge.isWatchAppInstalled ? .green : .orange)
                    .frame(width: 10, height: 10)
            }
            Text(bridge.lastTransferMessage)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button("Erneut an Watch senden") {
                store.sendToWatchAgain()
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22))
    }
}

#Preview {
    ContentView()
}
