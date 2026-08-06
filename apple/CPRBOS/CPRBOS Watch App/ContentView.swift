import SwiftUI
import Foundation

struct ContentView: View {
    @EnvironmentObject private var store: WatchWorkoutStore

    var body: some View {
        NavigationStack {
            Group {
                if store.isLoading {
                    loadingView
                } else if let session = store.session {
                    workoutList(session: session)
                } else {
                    emptyView
                }
            }
            .navigationTitle("CPRB")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await store.loadWorkout() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .tint(.cyan)
        .task {
            if store.isConnected { await store.loadWorkout() }
        }
    }

    private var loadingView: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Training laden…")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var emptyView: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image(systemName: store.isConnected ? "figure.strengthtraining.traditional" : "iphone.and.arrow.forward")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(store.isConnected ? .cyan : .orange)
                Text(store.isConnected ? "Kein Training aktiv" : "iPhone verbinden")
                    .font(.headline)
                    .multilineTextAlignment(.center)
                Text(store.message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Aktualisieren") {
                    Task { await store.loadWorkout() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!store.isConnected)
            }
            .padding(.horizontal, 4)
        }
    }

    private func workoutList(session: WatchFitnessSession) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.planName)
                        .font(.headline)
                    ProgressView(value: Double(store.completedSetCount), total: Double(max(store.sets.count, 1)))
                        .tint(.green)
                    Text("\(store.completedSetCount)/\(store.sets.count) Sätze")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Übungen") {
                ForEach(store.exercises) { exercise in
                    NavigationLink {
                        ExerciseDetailView(exercise: exercise)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exercise.exerciseName)
                                .font(.body.weight(.semibold))
                            Text("\(store.sets(for: exercise.id).filter(\.isCompleted).count)/\(store.sets(for: exercise.id).count) Sätze")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

private struct ExerciseDetailView: View {
    @EnvironmentObject private var store: WatchWorkoutStore
    let exercise: WatchExercise

    var body: some View {
        List {
            if !exercise.muscleGroup.isEmpty {
                Text(exercise.muscleGroup)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ForEach(store.sets(for: exercise.id)) { set in
                NavigationLink {
                    SetDetailView(setID: set.id)
                } label: {
                    HStack {
                        Image(systemName: set.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(set.isCompleted ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Satz \(set.setNumber)")
                                .font(.headline)
                            Text("\(set.weightKg, specifier: "%.1f") kg × \(set.actualReps)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(exercise.exerciseName)
    }
}

private struct SetDetailView: View {
    @EnvironmentObject private var store: WatchWorkoutStore
    let setID: String

    var body: some View {
        if let set = store.set(with: setID) {
            ScrollView {
                VStack(spacing: 10) {
                    Text("Satz \(set.setNumber)")
                        .font(.headline)

                    valueControl(
                        title: "Gewicht",
                        value: "\(String(format: "%.1f", set.weightKg)) kg",
                        minus: { Task { await store.changeWeight(setID: setID, by: -0.5) } },
                        plus: { Task { await store.changeWeight(setID: setID, by: 0.5) } }
                    )

                    valueControl(
                        title: "Wiederholungen",
                        value: "\(set.actualReps)",
                        minus: { Task { await store.changeReps(setID: setID, by: -1) } },
                        plus: { Task { await store.changeReps(setID: setID, by: 1) } }
                    )

                    if let previousWeight = set.previousWeightKg,
                       let previousReps = set.previousReps {
                        Text("Letztes Mal: \(previousWeight, specifier: "%.1f") kg × \(previousReps)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Button {
                        Task { await store.toggleSet(setID: setID) }
                    } label: {
                        Label(
                            set.isCompleted ? "Satz öffnen" : "Satz erledigt",
                            systemImage: set.isCompleted ? "arrow.uturn.backward" : "checkmark"
                        )
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(set.isCompleted ? .orange : .green)
                }
            }
            .navigationTitle("CPRB")
        } else {
            Text("Satz nicht gefunden")
        }
    }

    private func valueControl(
        title: String,
        value: String,
        minus: @escaping () -> Void,
        plus: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            HStack {
                Button(action: minus) { Image(systemName: "minus") }
                    .buttonStyle(.bordered)
                Text(value)
                    .font(.headline.monospacedDigit())
                    .frame(maxWidth: .infinity)
                Button(action: plus) { Image(systemName: "plus") }
                    .buttonStyle(.bordered)
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchWorkoutStore())
}
