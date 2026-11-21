Pod::Spec.new do |s|
  s.name           = 'VvShared'
  s.version        = '1.0.0'
  s.summary        = 'App Group bridge for the VehicleVault widget'
  s.description    = 'Writes the next-due summary into the shared App Group and reloads widget timelines.'
  s.author         = 'VehicleVault Maintainers'
  s.homepage       = 'https://example.com/vehiclevault'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
