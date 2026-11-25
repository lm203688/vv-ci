import SwiftUI

// 手表端只读主 App 写进 App Group 的那一条「下次保养」：不在手表上重算里程，
// 避免两端出现两个不同的数字。
struct WatchDueSnapshot {
  let car: String
  let label: String
  let days: Int

  // 手表 App 的 bundle id 多一个 .watchkitapp 后缀，去掉后与主 App 同源，才能读到同一个 App Group。
  private static var companionGroup: String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".watchkitapp") { id = String(id.dropLast(".watchkitapp".count)) }
    return "group." + id
  }

  static func read() -> WatchDueSnapshot? {
    guard let store = UserDefaults(suiteName: companionGroup) else { return nil }
    let car = store.string(forKey: "car") ?? ""
    let label = store.string(forKey: "label") ?? ""
    guard !car.isEmpty, !label.isEmpty else { return nil }
    return WatchDueSnapshot(car: car, label: label, days: store.integer(forKey: "days"))
  }
}

@main
struct VehicleVaultWatchApp: App {
  var body: some Scene {
    WindowGroup {
      WatchDueView()
    }
  }
}

struct WatchDueView: View {
  @State private var snapshot: WatchDueSnapshot?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        Text("NEXT SERVICE")
          .font(.caption2)
          .foregroundStyle(.secondary)
        if let snapshot {
          Text(snapshot.car).font(.headline)
          Text(snapshot.label).font(.body)
          Text(daysText(snapshot.days))
            .font(.system(.title2, design: .rounded).weight(.bold))
            .foregroundStyle(snapshot.days < 0 ? Color.red : Color.primary)
        } else {
          Text("Open VehicleVault on your iPhone to sync the garage.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal)
    }
    .onAppear { snapshot = WatchDueSnapshot.read() }
  }

  private func daysText(_ days: Int) -> String {
    if days < 0 { return "\(-days)d overdue" }
    if days == 0 { return "Due today" }
    return "\(days)d"
  }
}
