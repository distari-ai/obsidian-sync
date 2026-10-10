import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildOptions(root = process.cwd()) {
  return {
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'main.js',
    external: ['obsidian', 'electron'],
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    sourcemap: false,
    // Keep dependency source labels stable when the installed packages are linked.
    preserveSymlinks: true,
    logLevel: 'info',
    footer: { js: `/*\n${readFileSync(resolve(root, 'LICENSE'), 'utf8')}\n${readFileSync(resolve(root, 'THIRD_PARTY_LICENSES.md'), 'utf8')}\n*/` },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await esbuild.build(buildOptions());
}
