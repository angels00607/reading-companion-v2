import SwiftUI

struct ContentView: View {
    @State private var status = "Not tested"
    private let documentation = URL(string: "https://developers.openai.com/siwc/quickstart")!

    var body: some View {
        NavigationStack {
            Form {
                Section("Connection feasibility") {
                    Label("Native iOS eligibility: unverified", systemImage: "questionmark.shield")
                    Text("A ChatGPT Plus subscription does not automatically authorize an iPhone app to use plan-backed inference.")
                        .font(.footnote)
                    Text("Status: \(status)")
                }
                Section("Step 1 · Verify support") {
                    Link("Open official Sign in with ChatGPT documentation", destination: documentation)
                    Button("Check integration readiness") {
                        status = "Waiting for official iOS OAuth and plan-usage support confirmation"
                    }
                }
                Section("Step 2 · Connect with ChatGPT") {
                    Button("Connect with ChatGPT") {}
                        .disabled(true)
                    Text("Disabled until an officially supported native iOS authorization flow is confirmed and implemented.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section("Step 3 · Test generation") {
                    Button("Generate Test Summary") {}
                        .disabled(true)
                    Text("No simulated success and no paid API fallback.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("RC · ChatGPT Test")
        }
    }
}
