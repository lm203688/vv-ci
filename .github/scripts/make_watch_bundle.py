#!/usr/bin/env python3
"""把 xcodebuild 的怪癖绕开：手工组装 watchOS .app bundle。

用法：
    make_watch_bundle.py <src dir> <out .app> <bundle id> <marketing version> <build number>

src dir 里是 prebuild 生成的 VehicleVaultWatchApp.swift 与 VehicleVaultWatch-Info.plist，
二进制由调用方先用 swiftc 编好放进 out .app。
"""
import os
import sys


def main():
    if len(sys.argv) != 7:
        print(__doc__)
        return 2
    src, out, bundle_id, version, build, sdk_version = sys.argv[1:7]
    os.makedirs(out, exist_ok=True)

    with open(os.path.join(src, 'VehicleVaultWatch-Info.plist'), encoding='utf-8') as f:
        plist = f.read()
    repl = {
        '$(DEVELOPMENT_LANGUAGE)': 'en',
        '$(EXECUTABLE_NAME)': 'VehicleVaultWatch',
        '$(PRODUCT_BUNDLE_IDENTIFIER)': bundle_id,
        '$(PRODUCT_NAME)': 'VehicleVaultWatch',
        '$(MARKETING_VERSION)': version,
        '$(CURRENT_PROJECT_VERSION)': build,
    }
    for k, v in repl.items():
        plist = plist.replace(k, v)
    # 手工组装的 bundle 没有 Xcode 注入的平台元数据，altool 要求 DTPlatformName 等键（错误码 90507）。
    extra = (
        '\t<key>MinimumOSVersion</key>\n\t<string>11.0</string>\n'
        '\t<key>UIDeviceFamily</key>\n\t<array>\n\t\t<integer>4</integer>\n\t</array>\n'
        '\t<key>CFBundleSupportedPlatforms</key>\n\t<array>\n\t\t<string>WatchOS</string>\n\t</array>\n'
        '\t<key>DTPlatformName</key>\n\t<string>watchos</string>\n'
        f'\t<key>DTPlatformVersion</key>\n\t<string>{sdk_version}</string>\n'
        f'\t<key>DTSDKName</key>\n\t<string>watchos{sdk_version}</string>\n'
        '\t<key>IsSimulatorBuild</key>\n\t<false/>\n'
    )
    plist = plist.replace('</dict>', '\t<key>CFBundleIconName</key>\n\t<string>AppIcon</string>\n</dict>')
    if 'DTPlatformName' not in plist:
        plist = plist.replace('</dict>', extra + '</dict>')
    with open(os.path.join(out, 'Info.plist'), 'w', encoding='utf-8') as f:
        f.write(plist)
    print('wrote %s/Info.plist (%d bytes)' % (out, len(plist)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
