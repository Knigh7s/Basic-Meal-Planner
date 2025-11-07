import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

const dev = process.env.ROLLUP_WATCH === 'true';

const plugins = [
  resolve({
    browser: true,
    preferBuiltins: false,
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    sourceMap: dev,
    inlineSources: dev,
  }),
  json(),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            browsers: ['last 2 versions', 'not dead'],
          },
        },
      ],
    ],
  }),
  !dev && terser(),
].filter(Boolean);

export default [
  // Custom Panel Bundle
  {
    input: 'src/panel/panel-main.ts',
    output: {
      file: '../dist/panel.js',
      format: 'es',
      sourcemap: dev,
    },
    plugins,
  },
  // Lovelace Cards Bundle
  {
    input: 'src/cards/cards-main.ts',
    output: {
      file: '../dist/cards.js',
      format: 'es',
      sourcemap: dev,
    },
    plugins,
  },
];
