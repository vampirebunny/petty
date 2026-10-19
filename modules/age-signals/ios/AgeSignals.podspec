Pod::Spec.new do |s|
  s.name           = 'AgeSignals'
  s.version        = '0.1.0'
  s.summary        = 'Store age-range signals'
  s.description    = 'Store age-range signals'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'DeclaredAgeRange'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
