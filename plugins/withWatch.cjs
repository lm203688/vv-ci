/**
 * 自建 watchOS App target（watch2_app）。
 *
 * 与 withWidget.cjs 同样的原因：@bacons/apple-targets 在 SDK 54 的 prebuild 上不可用，这里直接造 pbxproj。
 *
 * 做的事：
 *  1. 把 targets/watch/*.swift 复制进 ios/VehicleVaultWatch/，写 Info.plist（WKApplication + WKCompanionAppBundleIdentifier）
 *  2. 新建 product type com.apple.product-type.application.watchapp2 的 target，只编 swift，SDKROOT=watchos
 *  3. 主 App 侧由 xcode 库自动补 Embed Watch Content（dstPath $(CONTENTS_FOLDER_PATH)/Watch）与 target 依赖
 *
 * 签名：watch app 必须有自己的一套 App Store 描述文件（ASC 里的 com.<bundle>.watchkitapp）。
 * 该描述文件的 application-groups 目前是空数组（App ID 只勾了能力、还没挂具体 group），
 * 所以这里**故意不写 CODE_SIGN_ENTITLEMENTS**，否则 codesign 会因 entitlement 值不在 profile 里而失败。
 * 手表端代码在拿不到 suite 时会自己降级成“先到 iPhone 打开 App”，不会崩。等 portal 把 App Group 挂上，
 * 再把 VV_WATCH_APP_GROUP 传进来即可打开共享数据。
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');

const TARGET_NAME = 'VehicleVaultWatch';

function identifiers(config) {
  const appBundle =
    (config.ios && config.ios.bundleIdentifier) || process.env.VV_BUNDLE_ID || 'com.example.vehiclevault';
  const watchBundle = process.env.VV_WATCH_BUNDLE_ID || `${appBundle}.watchkitapp`;
  const teamId = process.env.VV_TEAM_ID || (config.ios && config.ios.appleTeamId) || '';
  return { appBundle, watchBundle, teamId };
}

const watchInfoPlist = (appBundle) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>VehicleVault</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>WKApplication</key>
  <true/>
  <key>WKCompanionAppBundleIdentifier</key>
  <string>${appBundle}</string>
</dict>
</plist>
`;

function eachBuildSetting(proj, targetUuid, fn) {
  const targets = proj.pbxNativeTargetSection();
  const listId = targets[targetUuid].buildConfigurationList;
  const list = proj.pbxXCConfigurationList()[listId];
  const configs = proj.pbxXCBuildConfigurationSection();
  for (const c of (list.buildConfigurations || []).map((x) => x.value)) {
    if (configs[c] && configs[c].buildSettings) fn(configs[c].buildSettings, configs[c].name);
  }
}

module.exports = function withWatch(config) {
  const ids = identifiers(config);
  const marketingVersion = config.version || '1.0.0';
  const buildNumber = (config.ios && config.ios.buildNumber) || '1';
  // 仅在 CI 归档时注入；模拟器探针不设，保持自动签名
  const profileWatch = process.env.VV_PROFILE_WATCH || '';

  config = withDangerousMod(config, [
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
      fs.writeFileSync(path.join(dstDir, `${TARGET_NAME}-Info.plist`), watchInfoPlist(ids.appBundle));
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    if (proj.pbxTargetByName(TARGET_NAME)) return cfg;

    const created = proj.addTarget(TARGET_NAME, 'watch2_app', TARGET_NAME, ids.watchBundle);
    const targetUuid = created.uuid;

    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', TARGET_NAME);
    const swiftFiles = fs
      .readdirSync(dstDir)
      .filter((f) => f.endsWith('.swift'))
      .map((f) => `${TARGET_NAME}/${f}`);
    proj.addBuildPhase(swiftFiles, 'PBXSourcesBuildPhase', 'Sources', targetUuid);

    eachBuildSetting(proj, targetUuid, (bs) => {
      Object.assign(bs, {
        SDKROOT: '"watchos"',
        SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
        WATCHOS_DEPLOYMENT_TARGET: '"11.0"',
        TARGETED_DEVICE_FAMILY: '"4"',
        CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
        MARKETING_VERSION: `"${marketingVersion}"`,
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/${TARGET_NAME}-Info.plist"`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${ids.watchBundle}"`,
        SWIFT_VERSION: '"5.0"',
        SKIP_INSTALL: 'YES',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
      });
      if (ids.teamId) bs.DEVELOPMENT_TEAM = `"${ids.teamId}"`;
      if (profileWatch) {
        Object.assign(bs, {
          CODE_SIGN_STYLE: 'Manual',
          CODE_SIGN_IDENTITY: '"Apple Distribution"',
          PROVISIONING_PROFILE_SPECIFIER: `"${profileWatch}"`,
        });
      }
    });

    return cfg;
  });
};
