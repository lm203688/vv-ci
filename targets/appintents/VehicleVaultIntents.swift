import AppIntents
import Foundation

// VehicleVault：只做「打开 App」这一条，不带任何数据读取——该产品没有与扩展共享的存储。
@available(iOS 16.0, *)
struct VehicleVaultOpenIntent: AppIntent {
  static var title: LocalizedStringResource = "Open VehicleVault"
  static var description: IntentDescription? = IntentDescription(
    "Opens VehicleVault: service records, reminders and documents for your vehicles."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

@available(iOS 16.0, *)
struct VehicleVaultShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: VehicleVaultOpenIntent(),
      phrases: ["Open \(.applicationName)", "Launch \(.applicationName)"],
      shortTitle: "Open VehicleVault",
      systemImageName: "car"
    )
  }
}
