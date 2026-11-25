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
    if len(sys.argv) != 6:
        print(__doc__)
        return 2
    src, out, bundle_id, version, build = sys.argv[1:6]
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
    if '$(MinimumOSVersion)' in plist or 'MinimumOSVersion' not in plist:
        plist = plist.replace('</dict>', '\t<key>MinimumOSVersion</key>\n\t<string>11.0</string>\n\t<key>UIDeviceFamily</key>\n\t<array>\n\t\t<integer>4</integer>\n\t</array>\n</dict>')
    with open(os.path.join(out, 'Info.plist'), 'w', encoding='utf-8') as f:
        f.write(plist)
    print('wrote %s/Info.plist (%d bytes)' % (out, len(plist)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
