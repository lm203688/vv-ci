import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

// Bridge for Apple's Foundation Models framework.
// On-device model runs fully offline; no data leaves the device and no quota applies.
// Everything is availability-guarded so the binary still builds on older SDKs / OS versions.
public class AppleFMModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleFM")

    // Cheap capability probe used to decide whether the UI shows the AI entry at all.
    Function("availability") { () -> [String: Any] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
          return ["available": true, "reason": "ready", "backend": "on-device"]
        case .unavailable(let reason):
          var why = "unavailable"
          switch reason {
          case .deviceNotEligible: why = "device-not-eligible"
          case .appleIntelligenceNotEnabled: why = "apple-intelligence-off"
          case .modelNotReady: why = "model-not-ready"
          @unknown default: why = "unavailable"
          }
          return ["available": false, "reason": why, "backend": "on-device"]
        @unknown default:
          return ["available": false, "reason": "unknown", "backend": "on-device"]
        }
      }
      #endif
      return ["available": false, "reason": "os-too-old", "backend": "none"]
    }

    // Single-shot answer. Guidance keeps the model inside the app's domain and
    // keeps replies short enough to read on a phone.
    AsyncFunction("respond") { (prompt: String, instructions: String?) async -> [String: Any] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let model = SystemLanguageModel.default
        guard case .available = model.availability else {
          return ["ok": false, "error": "model-unavailable"]
        }
        do {
          let guidance = instructions?.trimmingCharacters(in: .whitespacesAndNewlines)
          let session = LanguageModelSession(
            model: model,
            instructions: (guidance?.isEmpty == false) ? guidance! : nil
          )
          let response = try await session.respond(to: prompt)
          return ["ok": true, "text": response.content]
        } catch {
          return ["ok": false, "error": error.localizedDescription]
        }
      }
      #endif
      return ["ok": false, "error": "os-too-old"]
    }
  }
}
