import ActivityKit
import Foundation

// 主 App 与 widget 扩展各编译一份同名同构的类型：ActivityKit 按类型名跨进程匹配，
// 两边的字段顺序与类型必须完全一致，所以这份文件只由 vv-shared 提供、由插件复制给扩展。
@available(iOS 16.1, *)
struct ServiceActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var headline: String
    var detail: String
    var days: Int
  }
  var car: String
}
