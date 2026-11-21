/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'VehicleVaultWidget',
  displayName: 'Service due',
  deploymentTarget: '17.0',
  colors: {
    $widgetBackground: '#F7F8F5',
    $accent: '#2F6B3C',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.example.vehiclevault'],
  },
};
