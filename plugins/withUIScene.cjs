/**
 * withUIScene — Expo config plugin that makes an Expo/React Native app adopt the
 * UIScene life cycle.
 *
 * Why: apps built against the iOS 26/27 SDK that still drive the legacy
 * `didFinishLaunching` window get killed at launch by UIKit
 * (UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption -> EXC_BREAKPOINT).
 * Xcode 27 simulator reproduces it 100%; older SDK builds are unaffected.
 *
 * What it does:
 *  1. Writes UIApplicationSceneManifest into Info.plist (single scene, delegate = SceneDelegate).
 *  2. Appends a SceneDelegate class to the generated AppDelegate.swift (same file, so no
 *     pbxproj registration is needed) which re-parents the root view controller that
 *     Expo's factory already built into a real UIWindowScene-backed window.
 *
 * Usage in app.json:
 *   "plugins": ["./plugins/withUIScene"]
 */
const { withInfoPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE_SWIFT = `

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let appDelegate = UIApplication.shared.delegate as? AppDelegate
    let sceneWindow = UIWindow(windowScene: windowScene)
    sceneWindow.backgroundColor = UIColor.white
    if let root = appDelegate?.window?.rootViewController {
      sceneWindow.rootViewController = root
    }
    self.window = sceneWindow
    appDelegate?.window = sceneWindow
    sceneWindow.makeKeyAndVisible()
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    plist.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName;
      const appDelegate = path.join(projectRoot, projectName, 'AppDelegate.swift');
      if (fs.existsSync(appDelegate)) {
        const src = fs.readFileSync(appDelegate, 'utf8');
        if (!src.includes('class SceneDelegate')) {
          fs.writeFileSync(appDelegate, src + SCENE_DELEGATE_SWIFT);
        }
      }
      return cfg;
    },
  ]);
}

module.exports = function withUIScene(config) {
  config = withSceneManifest(config);
  config = withSceneDelegate(config);
  return config;
};
