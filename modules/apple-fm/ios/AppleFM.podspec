Pod::Spec.new do |s|
  s.name           = 'AppleFM'
  s.version        = '1.0.0'
  s.summary        = 'Apple Foundation Models bridge (on-device Apple Intelligence)'
  s.description    = 'Exposes the Foundation Models framework to React Native so tools can explain results offline.'
  s.author         = 'AppGallery'
  s.homepage       = 'https://example.com/appgallery'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :path => '.' }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
