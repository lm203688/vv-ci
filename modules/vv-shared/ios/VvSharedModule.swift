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
  }
}
