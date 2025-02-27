import { RollupOptions } from 'rollup'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
// @ts-ignore
import size from 'rollup-plugin-size'
import visualizer from 'rollup-plugin-visualizer'
import replace from '@rollup/plugin-replace'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'
// import svelte from 'rollup-plugin-svelte'
import dts from 'rollup-plugin-dts'
//
import { packages } from './scripts/config'
import { readJsonSync } from 'fs-extra'

type Options = {
  input: string
  packageDir: string
  umdExternal: RollupOptions['external']
  external: RollupOptions['external']
  banner: string
  jsName: string
  globals: Record<string, string>
}

const umdDevPlugin = (type: 'development' | 'production') =>
  replace({
    'process.env.NODE_ENV': `"${type}"`,
    delimiters: ['', ''],
    preventAssignment: true,
  })

const babelPlugin = babel({
  babelHelpers: 'bundled',
  exclude: /node_modules/,
  extensions: ['.ts', '.tsx'],
})

export function createRollupConfig(packageName: string): () => RollupOptions[] {
  const pkg = packages.find((p) => p.name === packageName)
  if (!pkg) {
    throw new Error(
      `Package ${packageName} not found - check the package name given in your package's rollup.config.js file.`,
    )
  }
  return () =>
    buildConfigs({
      name: pkg.packageDir,
      packageDir: `packages/${pkg.packageDir}`,
      jsName: pkg.jsName,
      outputFile: pkg.packageDir,
      entryFile: pkg.entryFile,
      globals: pkg.globals ?? {},
      esm: pkg.esm ?? true,
      cjs: pkg.cjs ?? true,
      umd: pkg.umd ?? true,
    })
}

function buildConfigs(opts: {
  esm: boolean
  cjs: boolean
  umd: boolean
  packageDir: string
  name: string
  jsName: string
  outputFile: string
  entryFile: string
  globals: Record<string, string>
}): RollupOptions[] {
  const input = path.resolve(opts.packageDir, opts.entryFile)

  const packageJson =
    readJsonSync(
      path.resolve(process.cwd(), opts.packageDir, 'package.json'),
    ) ?? {}

  const banner = createBanner(opts.name)

  const options: Options = {
    input,
    jsName: opts.jsName,
    packageDir: opts.packageDir,
    external: [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ],
    umdExternal: Object.keys(packageJson.peerDependencies ?? {}),
    banner,
    globals: opts.globals,
  }

  return [
    opts.esm ? esm(options) : null,
    opts.cjs ? cjs(options) : null,
    opts.umd ? umdDev(options) : null,
    opts.umd ? umdProd(options) : null,
    types(options),
  ].filter(Boolean) as any
}

function esm({ input, packageDir, external, banner }: Options): RollupOptions {
  return {
    // ESM
    external,
    input,
    output: {
      format: 'esm',
      sourcemap: true,
      dir: `${packageDir}/build/esm`,
      banner,
    },
    plugins: [
      // svelte({
      //   compilerOptions: {
      //     hydratable: true,
      //   },
      // }),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
    ],
  }
}

function cjs({ input, external, packageDir, banner }: Options): RollupOptions {
  return {
    // CJS
    external,
    input,
    output: {
      format: 'cjs',
      sourcemap: true,
      dir: `${packageDir}/build/cjs`,
      preserveModules: true,
      exports: 'named',
      banner,
    },
    plugins: [
      // svelte(),
      babelPlugin,
      commonjs(),
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
    ],
  }
}

function umdDev({
  input,
  umdExternal,
  packageDir,
  globals,
  banner,
  jsName,
}: Options): RollupOptions {
  return {
    // UMD (Dev)
    external: umdExternal,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/index.development.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      // svelte(),
      babelPlugin,
      commonjs(),
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      umdDevPlugin('development'),
    ],
  }
}

function umdProd({
  input,
  umdExternal,
  packageDir,
  globals,
  banner,
  jsName,
}: Options): RollupOptions {
  return {
    // UMD (Prod)
    external: umdExternal,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/index.production.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      // svelte(),
      babelPlugin,
      commonjs(),
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      umdDevPlugin('production'),
      terser(),
      size({}),
      visualizer({
        filename: `${packageDir}/build/stats-html.html`,
        gzipSize: true,
      }),
      visualizer({
        filename: `${packageDir}/build/stats-react.json`,
        template: 'raw-data',
        gzipSize: true,
      }),
    ],
  }
}

function types({
  input,
  packageDir,
  external,
  banner,
}: Options): RollupOptions {
  return {
    // TYPES
    external,
    input,
    output: {
      format: 'es',
      file: `${packageDir}/build/types/index.d.ts`,
      banner,
    },
    plugins: [dts()],
  }
}

function createBanner(libraryName: string) {
  return `/**
 * ${libraryName}
 *
 * Copyright (c) TanStack
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`
}
