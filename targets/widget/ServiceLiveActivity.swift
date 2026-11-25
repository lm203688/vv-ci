import ActivityKit
import SwiftUI
import WidgetKit

// 锁屏与灵动岛共用的实时活动：临期保养倒计时，点开回到车库。
@available(iOS 16.1, *)
struct ServiceLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ServiceActivityAttributes.self) { context in
      HStack(spacing: 12) {
        Image(systemName: "wrench.and.screwdriver.fill")
          .font(.title3)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.car)
            .font(.caption)
            .foregroundStyle(.secondary)
          Text(context.state.headline)
            .font(.headline)
          Text(context.state.detail)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        Text(daysLabel(context.state.days))
          .font(.system(.title3, design: .rounded).weight(.bold))
      }
      .padding()
      .activityBackgroundTint(Color(red: 0.07, green: 0.09, blue: 0.11))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.car).font(.caption)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(daysLabel(context.state.days)).font(.caption.bold())
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.state.headline).font(.subheadline.bold())
        }
      } compactLeading: {
        Image(systemName: "wrench.and.screwdriver")
      } compactTrailing: {
        Text(daysLabel(context.state.days)).font(.caption2.bold())
      } minimal: {
        Text(daysLabel(context.state.days)).font(.caption2.bold())
      }
    }
  }

  private func daysLabel(_ days: Int) -> String {
    if days < 0 { return "\(-days)d late" }
    return "\(days)d"
  }
}
