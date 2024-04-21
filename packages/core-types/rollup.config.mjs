import { Addon } from '@embroider/addon-dev/rollup';
import ts from 'rollup-plugin-ts';
import babelConfig from './babel.config.mjs';

import { external } from '@warp-drive/internal-config/rollup/external.js';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

export default {
  // This provides defaults that work well alongside `publicEntrypoints` below.
  // You can augment this if you need to.
  output: addon.output(),

  external: external(),

  plugins: [
    // everything should be public in this package
    addon.publicEntrypoints([
      'index.js',
      'identifier.js',
      'request.js',
      'symbols.js',
      'schema.js',
      'params.js',
      'record.js',
      'cache.js',
      'cache/*',
      'json/*',
      'spec/*',
    ]),

    ts({
      transpiler: 'babel',
      babelConfig,
      // transpileOnly: true,
      browserslist: false,
    }),

    // Remove leftover build artifacts when starting a new build.
    addon.clean(),
  ],
};
