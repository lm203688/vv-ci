/**
 * watchOS 端源码落位。
 *
 * 这里**故意不建 Xcode target**：watch app 要嵌进主 App 归档，必须先在 ASC 为它单独建
 * App ID 与分发描述文件，否则 archive 一定红。target 的 pbxproj 造法已经验证过（xcode 库
 * 支持 watch2_app），但会与主 App 抢同一个产物路径，需要专门排一次。
 *
 * 现在做的是：把 targets/watch 的源码复制进 ios/VehicleVaultWatch 便于本地开发，
 * 由 CI 用 watchOS SDK 直接 typecheck 保证不腐烂；拿到 watch 描述文件后再把 target 打开。
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const TARGET_NAME = 'VehicleVaultWatch';

const WATCH_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>VehicleVault</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</key>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>WKApplication</key>
  <true/>
  <key>WKCompanionAppBundleIdentifier</key>
  <string>__COMPANION__</string>
</dict>
</plist>
`;

module.exports = function withWatch(config) {
  const appBundle =
    (config.ios && config.ios.bundleIdentifier) || process.env.VV_BUNDLE_ID || 'com.example.vehiclevault';
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, 'targets', 'watch');
      if (!fs.existsSync(srcDir)) return cfg;
      const dstDir = path.join(root, 'ios', TARGET_NAME);
      fs.mkdirSync(dstDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        if (f.endsWith('.swift')) fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      }
      fs.writeFileSync(
        path.join(dstDir, `${TARGET_NAME}-Info.plist`),
        WATCH_INFO_PLIST.replace('__COMPANION__', appBundle)
      );
      return cfg;
    },
  ]);
};
