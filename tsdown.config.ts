/**
 * dsh-gallery build: node-half lib (host plugin: fence teaching + tools +
 * vision/sources) + browser client bundle (the ```dsh-gallery fence renderer)
 * speaking the dsh module-loader protocol (`window.__ModuleLoader__.load`).
 * Mirrors the dsh repo's packages/client/tsdown.client.ts preset, simplified:
 * no lazy assets, no CSS modules (inline styles in the card component).
 */
import type { UserConfig } from 'tsdown'

const ID = 'dsh-gallery'

/** Module-table entries the client bundle may leave external: platform seed
 * rows (react family) answered by the loader's require. Everything else is
 * bundled — the client half has no other third-party imports. */
const EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom/client']

const libConfig: UserConfig = {
  name: ID,
  entry: { index: 'src/plugin/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
  // undici/schemastery resolve from the plugin's own node_modules at runtime.
  deps: {
    neverBundle: ['undici', '@deepseek-ai/schemastery'],
  },
  outputOptions: { entryFileNames: '[name].js' },
}

const clientConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  // Dev readability first; flip to true for release builds.
  minify: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: [...EXTERNALS],
    alwaysBundle: (id: string) => !EXTERNALS.includes(id),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
const testClientConfig: UserConfig = {
  name: `${ID}/test-client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'output/browser-test',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  minify: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: [],
    alwaysBundle: () => true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [libConfig, clientConfig, testClientConfig]
