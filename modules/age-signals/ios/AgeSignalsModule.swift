import ExpoModulesCore
import UIKit

#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

public class AgeSignalsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AgeSignals")

    AsyncFunction("fetchBounds") { () async -> [String: Any]? in
      await AgeSignalsModule.requestBounds()
    }
  }

  // Gates at 13 and 18. Each resulting span is at least two years, which the API requires.
  // A nil lower bound is below the lowest gate. A nil upper bound is at or above the highest.
  @MainActor
  private static func requestBounds() async -> [String: Any]? {
    #if canImport(DeclaredAgeRange)
    guard #available(iOS 26.0, *) else {
      return nil
    }
    guard let controller = topViewController() else {
      return nil
    }
    do {
      let response = try await AgeRangeService.shared.requestAgeRange(ageGates: 13, 18, in: controller)
      switch response {
      case .sharing(let range):
        var payload: [String: Any] = [:]
        if let lower = range.lowerBound {
          payload["lower"] = lower
        }
        if let upper = range.upperBound {
          payload["upper"] = upper
        }
        return payload
      case .declinedSharing:
        return nil
      @unknown default:
        return nil
      }
    } catch {
      return nil
    }
    #else
    return nil
    #endif
  }

  @MainActor
  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    let root = scene?.windows.first { $0.isKeyWindow }?.rootViewController
    var top = root
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}
