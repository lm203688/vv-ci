import ActivityKit
import ExpoModulesCore
import WidgetKit

public class VvSharedModule: Module {
  // App Group 约定为 "group." + 主 App bundle id；扩展的 bundle id 多一个 ".widget" 后缀，去掉后同源。
  private var appGroup: String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
    return "group." + id
  }

  public func definition() -> ModuleDefinition {
    Name("VvShared")

    Function("setWidgetData") { (car: String, label: String, days: Int) in
      let d = UserDefaults(suiteName: self.appGroup)
      d?.set(car, forKey: "car")
      d?.set(label, forKey: "label")
      d?.set(days, forKey: "days")
      d?.synchronize()
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      return true
    }

    Function("clearWidgetData") {
      let d = UserDefaults(suiteName: self.appGroup)
      d?.removeObject(forKey: "car")
      d?.removeObject(forKey: "label")
      d?.removeObject(forKey: "days")
      d?.synchronize()
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      return true
    }

    // 实时活动：只有临期（含逾期）才值得占用锁屏，由 JS 侧判断后调用。
    Function("liveActivityEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("startServiceActivity") { (car: String, headline: String, detail: String, days: Int) -> Bool in
      guard #available(iOS 16.1, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      for activity in Activity<ServiceActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let attributes = ServiceActivityAttributes(car: car)
      let state = ServiceActivityAttributes.ContentState(headline: headline, detail: detail, days: days)
      do {
        _ = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: nil)
        )
        return true
      } catch {
        return false
      }
    }

    AsyncFunction("endServiceActivity") { () -> Bool in
      guard #available(iOS 16.1, *) else { return false }
      for activity in Activity<ServiceActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      return true
    }
  }
}
