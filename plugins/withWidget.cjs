/**
 * 自建 WidgetKit 扩展 target。
 *
 * 用它的原因：@bacons/apple-targets 3.x / 4.x / 5.x 全部依赖 SDK 55+ 的 xcode 工程 mod 内部模块，
 * 在 SDK 54 的 prebuild 上分别报 MODULE_NOT_FOUND(@expo/prebuild-config/AssetContents) 与
 * xcodeProjectBeta2 的 removeFromProject，升级插件这条路在本工程不可用。
 *
 * 做的事：
 *  1. 把 targets/widget/*.swift 复制进 ios/VehicleVaultWidget/，并写扩展的 Info.plist 与 entitlements
 *  2. 在 pbxproj 里新建 app_extension target（product type com.apple.product-type.app-extension），
 *     编译 swift、通过 Copy Files(PlugIns) 阶段嵌进主 App，并给主 target 加上依赖
 *  3. 主 App 与扩展都写 com.apple.security.application-groups，供共享 UserDefaults 使用
 *
 * 归档签名需要两个描述文件（主 App 与 .widget 扩展），见 release.yml 的 PROFILE_WIDGET_UUID。
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');

const TARGET_NAME = 'VehicleVaultWidget';

// 标识全部来自配置／环境变量，仓库里不写真实 bundle id、team id 与 App Group。
function identifiers(config) {
  const appBundle =
    (config.ios && config.ios.bundleIdentifier) || process.env.VV_BUNDLE_ID || 'com.example.vehiclevault';
  const widgetBundle = process.env.VV_WIDGET_BUNDLE_ID || `${appBundle}.widget`;
  const appGroup = process.env.VV_APP_GROUP || `group.${appBundle}`;
  const teamId = process.env.VV_TEAM_ID || (config.ios && config.ios.appleTeamId) || '';
  return { appBundle, widgetBundle, appGroup, teamId };
}

const entitlementsXml = (appGroup) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroup}</string>
  </array>
</dict>
</plist>
`;

const WIDGET_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Service due</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;

function copySources(config, appGroup) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, 'targets', 'widget');
      const iosDir = path.join(root, 'ios');
      const dstDir = path.join(iosDir, TARGET_NAME);
      fs.mkdirSync(dstDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        if (f.endsWith('.swift')) fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      }
      // 实时活动的属性类型要在主 App 与扩展各编译一份，两边必须同源。
      const attrSrc = path.join(root, 'modules', 'vv-shared', 'ios', 'ServiceActivityAttributes.swift');
      if (fs.existsSync(attrSrc)) {
        fs.copyFileSync(attrSrc, path.join(dstDir, 'ServiceActivityAttributes.swift'));
      }
      const entitlements = entitlementsXml(appGroup);
      fs.writeFileSync(path.join(dstDir, `${TARGET_NAME}-Info.plist`), WIDGET_INFO_PLIST);
      fs.writeFileSync(path.join(dstDir, `${TARGET_NAME}.entitlements`), entitlements);

      const appName = cfg.modRequest.projectName || 'VehicleVault';
      const appDir = path.join(iosDir, appName);
      if (fs.existsSync(appDir)) {
        fs.writeFileSync(path.join(appDir, `${appName}.entitlements`), entitlements);
        // 主 target 的 build setting 在下面的 xcode mod 里指向这个文件
        cfg._vvAppEntitlements = `${appName}/${appName}.entitlements`;
        // 锁屏实时活动需要主 App 的 Info.plist 显式声明，缺了系统直接不显示。
        const infoPath = path.join(appDir, 'Info.plist');
        if (fs.existsSync(infoPath)) {
          let info = fs.readFileSync(infoPath, 'utf8');
          if (!info.includes('NSSupportsLiveActivities')) {
            info = info.replace('<dict>', '<dict>\n\t<key>NSSupportsLiveActivities</key>\n\t<true/>');
            fs.writeFileSync(infoPath, info);
          }
        }
      }
      return cfg;
    },
  ]);
}

function eachBuildSetting(proj, targetUuid, fn) {
  const targets = proj.pbxNativeTargetSection();
  const listId = targets[targetUuid].buildConfigurationList;
  const list = proj.pbxXCConfigurationList()[listId];
  const configs = proj.pbxXCBuildConfigurationSection();
  for (const c of (list.buildConfigurations || []).map((x) => x.value)) {
    if (configs[c] && configs[c].buildSettings) fn(configs[c].buildSettings, configs[c].name);
  }
}

module.exports = function withWidget(config) {
  const appName = config.name || 'VehicleVault';
  const marketingVersion = config.version || '1.0.0';
  const buildNumber = (config.ios && config.ios.buildNumber) || '1';
  const ids = identifiers(config);
  // 仅在 CI 归档时注入（模拟器探针不设这两个 env，保持自动签名）
  const profileMain = process.env.VV_PROFILE_MAIN || '';
  const profileWidget = process.env.VV_PROFILE_WIDGET || '';
  config = copySources(config, ids.appGroup);

  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    if (proj.pbxTargetByName(TARGET_NAME)) return cfg;

    const appTarget = proj.getFirstTarget();
    const created = proj.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, ids.widgetBundle);
    const targetUuid = created.uuid;

    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', TARGET_NAME);
    const swiftFiles = fs
      .readdirSync(dstDir)
      .filter((f) => f.endsWith('.swift'))
      .map((f) => `${TARGET_NAME}/${f}`);
    proj.addBuildPhase(swiftFiles, 'PBXSourcesBuildPhase', 'Sources', targetUuid);


    eachBuildSetting(proj, targetUuid, (bs) => {
      Object.assign(bs, {
        CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
        CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/${TARGET_NAME}-Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '"17.0"',
        MARKETING_VERSION: `"${marketingVersion}"`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${ids.widgetBundle}"`,
        SWIFT_VERSION: '"5.0"',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        LD_RUNPATH_SEARCH_PATHS:
          '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      });
      if (ids.teamId) bs.DEVELOPMENT_TEAM = `"${ids.teamId}"`;
      if (profileWidget) {
        Object.assign(bs, {
          CODE_SIGN_STYLE: 'Manual',
          CODE_SIGN_IDENTITY: '"Apple Distribution"',
          PROVISIONING_PROFILE_SPECIFIER: `"${profileWidget}"`,
        });
      }
    });

    eachBuildSetting(proj, appTarget.uuid, (bs) => {
      bs.CODE_SIGN_ENTITLEMENTS = `"${appName}/${appName}.entitlements"`;
      if (profileMain) {
        Object.assign(bs, {
          CODE_SIGN_STYLE: 'Manual',
          CODE_SIGN_IDENTITY: '"Apple Distribution"',
          PROVISIONING_PROFILE_SPECIFIER: `"${profileMain}"`,
        });
      }
    });

    return cfg;
  });
};
