import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'main.ts',
  output: {
    dir: 'build',
    format: 'iife',
    name: 'doGet',
  },
  plugins: [
    json(),
    commonjs(),
    nodeResolve(),
    typescript(),
  ]
};
