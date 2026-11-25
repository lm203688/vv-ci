import SwiftUI
import WidgetKit
import AppIntents

// App Group 约定为 "group." + 主 App bundle id；本扩展的 bundle id 带 ".widget" 后缀，去掉后同源。
private var appGroup: String {
  var id = Bundle.main.bundleIdentifier ?? ""
  if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
  return "group." + id
}

struct DueEntry: TimelineEntry {
  let date: Date
  let car: String
  let label: String
  let days: Int
  let hasData: Bool
}

struct DueProvider: TimelineProvider {
  private func defaults() -> UserDefaults? { UserDefaults(suiteName: appGroup) }

  func placeholder(in context: Context) -> DueEntry {
    DueEntry(date: Date(), car: "Daily Camry", label: "Oil & filter", days: 12, hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (DueEntry) -> Void) {
    completion(read())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DueEntry>) -> Void) {
    let entry = read()
    // 每天早八点刷新一次；App 内改动会主动 reloadTimelines。
    let next = Calendar.current.date(byAdding: .hour, value: 8, to: Date()) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func read() -> DueEntry {
    let d = defaults()
    let car = d?.string(forKey: "car") ?? ""
    let label = d?.string(forKey: "label") ?? ""
    let days = d?.integer(forKey: "days") ?? 0
    let hasData = !car.isEmpty && !label.isEmpty && d != nil
    return DueEntry(date: Date(), car: car, label: label, days: days, hasData: hasData)
  }
}

struct DueView: View {
  var entry: DueEntry

  private var daysText: String {
    if entry.days > 0 { return "\(entry.days)" }
    if entry.days == 0 { return "today" }
    return "\(-entry.days)"
  }

  private var caption: String {
    if entry.days > 0 { return "days left" }
    if entry.days == 0 { return "due now" }
    return "days overdue"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Next service")
        .font(.caption2)
        .foregroundStyle(Color(red: 0.42, green: 0.45, blue: 0.42))
      if entry.hasData {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(daysText)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(entry.days <= 0 ? Color(red: 0.72, green: 0.15, blue: 0.12) : Color(red: 0.13, green: 0.26, blue: 0.18))
          Text(caption)
            .font(.caption2)
            .foregroundStyle(Color(red: 0.42, green: 0.45, blue: 0.42))
        }
        Text(entry.label)
          .font(.caption)
          .lineLimit(1)
          .foregroundStyle(Color(red: 0.13, green: 0.26, blue: 0.18))
        Text(entry.car)
          .font(.caption2)
          .lineLimit(1)
          .foregroundStyle(Color(red: 0.42, green: 0.45, blue: 0.42))
      } else {
        Text("Open app")
          .font(.system(size: 24, weight: .bold, design: .rounded))
          .foregroundStyle(Color(red: 0.13, green: 0.26, blue: 0.18))
        Text("Add a car to see days left")
          .font(.caption2)
          .foregroundStyle(Color(red: 0.42, green: 0.45, blue: 0.42))
      }
      Spacer(minLength: 0)
    }
    .padding(12)
    .containerBackground(Color(red: 0.97, green: 0.97, blue: 0.96), for: .widget)
  }
}

// Control Centre 的按钮要打开主 App，所以动作是一个声明了 openAppWhenRun 的 AppIntent。
@available(iOS 18.0, *)
struct OpenVehicleVaultControlIntent: AppIntent {
  static var title: LocalizedStringResource = "Open VehicleVault"
  static var description = IntentDescription("Opens the garage from Control Centre.")
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    .result()
  }
}

// 控制中心 / 锁屏的一键入口：不用解锁翻页，按下去就回到"下次保养"。
@available(iOS 18.0, *)
struct NextServiceControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "NextServiceControl") {
      ControlWidgetButton(action: OpenVehicleVaultControlIntent()) {
        Label("Next service", systemImage: "wrench.and.screwdriver")
      }
    }
    .displayName("Next service")
    .description("Opens the garage at the next service.")
  }
}

struct VehicleVaultDueWidget: Widget {
  let kind = "VehicleVaultDue"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DueProvider()) { entry in
      DueView(entry: entry)
    }
    .configurationDisplayName("Next service")
    .description("Shows how many days are left until the next service on your most recent car.")
    .supportedFamilies([.systemSmall])
  }
}

// 扩展成一个 bundle：iOS 17 只有主 widget，iOS 18 起多一个控制中心控件。
@main
struct VehicleVaultWidgetBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    VehicleVaultDueWidget()
    if #available(iOS 18.0, *) {
      NextServiceControl()
    }
    if #available(iOS 16.2, *) {
      ServiceLiveActivityWidget()
    }
  }
}
