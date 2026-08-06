//
//  CPRBOSApp.swift
//  CPRBOS Watch App
//
//  Created by Christian Hofstätter on 06.08.26.
//

import SwiftUI

@main
struct CPRBOS_Watch_AppApp: App {
    @StateObject private var store = WatchWorkoutStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
