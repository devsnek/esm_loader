{
  'targets': [
    {
      'target_name': 'module_wrap',
      'sources': [
        'src/module_wrap.cc',
        'src/module_wrap.h',
      ],
      'cflags': [ '-Werror', '-Wall', '-Wextra', '-Wpedantic', '-Wunused-parameter',  '-fno-exceptions' ],
      'cflags_cc': [ '-Werror', '-Wall', '-Wextra', '-Wpedantic', '-Wunused-parameter', '-fno-exceptions' ],
    }
  ],
}
