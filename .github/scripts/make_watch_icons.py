#!/usr/bin/env python3
"""生成 watchOS 的 AppIcon.appiconset。

altool 会逐个校验 watchOS 的每档图标（notificationCenter / companionSettings / appLauncher /
quickLook / longLook / watch-marketing），缺任何一档都会 90394/90741 拒收。
这里从一张 1024x1024 无 alpha 的基准图缩放出全套，并写好 Contents.json。

用法：make_watch_icons.py <base 1024 png> <AppIcon.appiconset dir>
"""
import json
import os
import subprocess
import sys

# (filename, pixels, size, scale, role, subtype)
SPECS = [
    ('Icon-24@2x.png', 48, '24x24', '2x', 'notificationCenter', '38mm'),
    ('Icon-27.5@2x.png', 55, '27.5x27.5', '2x', 'notificationCenter', '42mm'),
    ('Icon-29@2x.png', 58, '29x29', '2x', 'companionSettings', None),
    ('Icon-29@3x.png', 87, '29x29', '3x', 'companionSettings', None),
    ('Icon-40@2x.png', 80, '40x40', '2x', 'appLauncher', '38mm'),
    ('Icon-44@2x.png', 88, '44x44', '2x', 'appLauncher', '40mm'),
    ('Icon-50@2x.png', 100, '50x50', '2x', 'appLauncher', '44mm'),
    ('Icon-86@2x.png', 172, '86x86', '2x', 'quickLook', '38mm'),
    ('Icon-98@2x.png', 196, '98x98', '2x', 'quickLook', '42mm'),
    ('Icon-108@2x.png', 216, '108x108', '2x', 'quickLook', '44mm'),
    ('Icon-44@2x-long.png', 88, '44x44', '2x', 'longLook', '42mm'),
    ('Icon-50@2x-long.png', 100, '50x50', '2x', 'longLook', '44mm'),
]


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    base, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    images = []
    for name, px, size, scale, role, subtype in SPECS:
        subprocess.run(['sips', '-z', str(px), str(px), base, '--out', os.path.join(out, name)],
                       check=True, capture_output=True)
        entry = {'filename': name, 'idiom': 'watch', 'scale': scale, 'size': size, 'role': role}
        if subtype:
            entry['subtype'] = subtype
        images.append(entry)
    subprocess.run(['sips', '-z', '1024', '1024', base, '--out', os.path.join(out, 'Icon-1024.png')],
                   check=True, capture_output=True)
    images.append({'filename': 'Icon-1024.png', 'idiom': 'watch-marketing', 'scale': '1x', 'size': '1024x1024'})
    with open(os.path.join(out, 'Contents.json'), 'w', encoding='utf-8') as f:
        json.dump({'images': images, 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)
    print('wrote %d icons into %s' % (len(images), out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
