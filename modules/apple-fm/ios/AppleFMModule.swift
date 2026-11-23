import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

// Bridge for Apple's Foundation Models framework.
//
// Answer path: on-device model first (unlimited, works with no network), and Apple
// Private Cloud Compute as the fallback when the on-device model is unavailable on
// this device. Nothing is sent anywhere unless the PCC path is the one being used,
// and PCC has no account requirement and no per-user billing.
public class AppleFMModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleFM")

    // Cheap capability probe; drives whether the UI shows the AI entry and what it
    // promises the user.
    Function("availability") { () -> [String: Any] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let local = SystemLanguageModel.default
        if case .available = local.availability {
          return ["available": true, "reason": "ready", "backend": "on-device"]
        }
        let why = Self.reasonText(local.availability)
        if #available(iOS 27.0, *) {
          let cloud = PrivateCloudComputeLanguageModel()
          if cloud.isAvailable {
            return [
              "available": true,
              "reason": why,
              "backend": "pcc",
              "quota": String(describing: cloud.quotaUsage.status),
            ]
          }
        }
        return ["available": false, "reason": why, "backend": "none"]
      }
      #endif
      return ["available": false, "reason": "os-too-old", "backend": "none"]
    }

    // Single-shot answer. Guidance keeps the model inside the app's domain and keeps
    // replies short enough to read on a phone.
    AsyncFunction("respond") { (prompt: String, instructions: String?) async -> [String: Any] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let guidance = (instructions ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        if case .available = SystemLanguageModel.default.availability {
          do {
            let session = LanguageModelSession(
              model: SystemLanguageModel.default,
              instructions: guidance.isEmpty ? nil : guidance
            )
            let response = try await session.respond(to: prompt)
            return ["ok": true, "text": response.content, "backend": "on-device"]
          } catch {
            return ["ok": false, "error": error.localizedDescription, "backend": "on-device"]
          }
        }

        if #available(iOS 27.0, *) {
          let cloud = PrivateCloudComputeLanguageModel()
          guard cloud.isAvailable else {
            return ["ok": false, "error": "model-unavailable", "backend": "none"]
          }
          do {
            let session = LanguageModelSession(
              model: cloud,
              instructions: guidance.isEmpty ? nil : guidance
            )
            let response = try await session.respond(to: prompt)
            return ["ok": true, "text": response.content, "backend": "pcc"]
          } catch {
            return ["ok": false, "error": error.localizedDescription, "backend": "pcc"]
          }
        }

        return ["ok": false, "error": "model-unavailable", "backend": "none"]
      }
      #endif
      return ["ok": false, "error": "os-too-old", "backend": "none"]
    }
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func reasonText(_ availability: SystemLanguageModel.Availability) -> String {
    switch availability {
    case .available:
      return "ready"
    case .unavailable(let reason):
      switch reason {
      case .deviceNotEligible: return "device-not-eligible"
      case .appleIntelligenceNotEnabled: return "apple-intelligence-off"
      case .modelNotReady: return "model-not-ready"
      @unknown default: return "unavailable"
      }
    @unknown default:
      return "unknown"
    }
  }
  #endif
}
