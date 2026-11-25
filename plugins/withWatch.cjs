/**
 * 自建 watchOS App target（single-target watch app，watchOS 7+ 的结构）。
 *
 * 只做三件事：把 targets/watch 的源码复制进 ios/VehicleVaultWatch、写 Info.plist、
 * 在 pbxproj 里建 application.watchapp2 target。**故意不嵌进主 App、不加依赖**：
 * 嵌入并归档需要 watch 自己的 App ID 与分发描述文件，没有它 archive 一定失败，
 * 所以先让 CI 单独编译这个 target（CODE_SIGNING_ALLOWED=NO）来保证代码不会腐烂。
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'VehicleVaultWatch';

const WATCH_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
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
  <string>__COMPANION__</string>
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
  const appBundle =
    (config.ios && config.ios.bundleIdentifier) || process.env.VV_BUNDLE_ID || 'com.example.vehiclevault';
  const watchBundle = process.env.VV_WATCH_BUNDLE_ID || `${appBundle}.watchkitapp`;
  const teamId = process.env.VV_TEAM_ID || (config.ios && config.ios.appleTeamId) || '';
  const marketingVersion = config.version || '1.0.0';
  const buildNumber = (config.ios && config.ios.buildNumber) || '1';

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, 'targets', 'watch');
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

  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    if (proj.pbxTargetByName(TARGET_NAME)) return cfg;

    const created = proj.addTarget(TARGET_NAME, 'watch2_app', TARGET_NAME, watchBundle);
    const targetUuid = created.uuid;

    // xcode 库会顺手给主 App 加一个 "Embed Watch Content" 拷贝阶段与依赖。等 watch 拿到
    // 自己的 App ID 与分发描述文件后才会真正嵌入；现在留着会让 archive 去拷一个还没签名的
    // 产物，直接报 no such file，所以先摘掉，只保留独立编译。
    const appUuid = proj.getFirstTarget().uuid;
    const native = proj.pbxNativeTargetSection();
    if (native[appUuid] && native[appUuid].buildPhases) {
      native[appUuid].buildPhases = native[appUuid].buildPhases.filter((p) => {
        const phase = proj.hash.project.objects['PBXCopyFilesBuildPhase'][p.value];
        if (!phase) return true;
        if (String(phase.dstPath || '').includes('Watch')) {
          delete proj.hash.project.objects['PBXCopyFilesBuildPhase'][p.value];
          return false;
        }
        return true;
      });
    }
    if (native[appUuid] && native[appUuid].dependencies) {
      native[appUuid].dependencies = native[appUuid].dependencies.filter((d) => {
        const dep = proj.hash.project.objects['PBXTargetDependency'][d.value];
        if (!dep) return true;
        const pointsAtWatch = (dep.target && dep.target === targetUuid) || (dep.target && dep.target.value === targetUuid);
        if (pointsAtWatch) {
          delete proj.hash.project.objects['PBXTargetDependency'][d.value];
          return false;
        }
        return true;
      });
    }
    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', TARGET_NAME);
    const swiftFiles = fs
      .readdirSync(dstDir)
      .filter((f) => f.endsWith('.swift'))
      .map((f) => `${TARGET_NAME}/${f}`);
    // addTarget 已经建好默认的 Sources 阶段；再建一个会让同一个 .swift 编出两份同名产物
    // （Multiple commands produce ... .app/<exe>），所以只往目标里挂文件。
    for (const f of swiftFiles) {
      proj.addSourceFile(f, { target: targetUuid });
    }

    eachBuildSetting(proj, targetUuid, (bs) => {
      Object.assign(bs, {
        SDKROOT: 'watchos',
        SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
        WATCHOS_DEPLOYMENT_TARGET: '"11.0"',
        TARGETED_DEVICE_FAMILY: '"4"',
        CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
        MARKETING_VERSION: `"${marketingVersion}"`,
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/${TARGET_NAME}-Info.plist"`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${watchBundle}"`,
        PRODUCT_NAME: `"${TARGET_NAME}"`,
        SWIFT_VERSION: '"5.0"',
        SKIP_INSTALL: 'YES',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
      });
      if (teamId) bs.DEVELOPMENT_TEAM = `"${teamId}"`;
    });

    return cfg;
  });
};
