import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from 'rollup-plugin-typescript2';

export default [
  {
    input: 'index.ts',
    output: {
      dir: 'build',
      format: 'umd',
      name: 'doGet',
      globals: {
        // Dev only dependency
        "sync-request": "null",
      }
    },
    plugins: [
      json(),
      commonjs(),
      nodeResolve(),
      typescript(),
    ],
    external: ["sync-request"]
  },
];
