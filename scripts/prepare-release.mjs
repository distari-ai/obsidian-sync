import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Export only reviewed plugin files, never a monorepo tree, vault, or node_modules.
export const repositoryFiles = [
  'README.md', 'RELEASE.md', 'VERSIONS.md', 'LICENSE', 'THIRD_PARTY_LICENSES.md',
  'manifest.json', 'versions.json', 'main.js', 'package.json', 'package-lock.json',
  'tsconfig.json', 'esbuild.config.mjs',
  'src/api.ts', 'src/main.ts', 'src/render.ts', 'src/sync.ts', 'src/sync.test.ts',
  'src/api.test.ts', 'src/render.test.ts', 'src/main.test.ts',
  'scripts/prepare-release.mjs', 'scripts/release.test.mjs',
];
export const assetFiles = ['main.js', 'manifest.json'];

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateMetadata(manifest, pkg, lock, versions) {
  if (manifest.id !== 'distari-sync') throw new Error('Keep the stable distari-sync plugin ID.');
  if (!semver.test(manifest.version) || !semver.test(manifest.minAppVersion)) {
    throw new Error('Manifest versions must use x.y.z, without a v prefix.');
  }
  for (const field of ['name', 'description', 'author']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw new Error(`Missing manifest ${field}.`);
  }
  if (typeof manifest.isDesktopOnly !== 'boolean') throw new Error('Set isDesktopOnly explicitly.');
  if (pkg.version !== manifest.version || lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('Manifest, package and lockfile versions must agree.');
  }
  if (pkg.license !== 'MIT') throw new Error('The plugin export uses the MIT license.');
  if (versions[manifest.version] !== manifest.minAppVersion) throw new Error('versions.json must include the current minimum app version.');
  for (const [version, minimum] of Object.entries(versions)) {
    if (!semver.test(version) || !semver.test(minimum)) throw new Error('Invalid versions.json compatibility entry.');
  }
}

export async function prepareRelease(output, root = pluginRoot) {
  if (!output || !isAbsolute(output)) throw new Error('Pass an absolute --output directory, preferably beneath TMPDIR.');
  // Resolve an existing ancestor so a symlink cannot place the export in the source.
  let ancestor = resolve(output);
  const missing = [];
  while (true) {
    try { ancestor = await realpath(ancestor); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
  const destination = resolve(ancestor, ...missing);
  const source = await realpath(root);
  const inside = relative(source, destination);
  if (!inside || (!inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside))) {
    throw new Error('The release output must be outside the plugin source.');
  }
  const json = async (name) => JSON.parse(await readFile(resolve(source, name), 'utf8'));
  const [manifest, pkg, lock, versions] = await Promise.all([
    json('manifest.json'), json('package.json'), json('package-lock.json'), json('versions.json'),
  ]);
  validateMetadata(manifest, pkg, lock, versions);
  for (const name of repositoryFiles) {
    const input = resolve(source, name);
    if (!(await lstat(input)).isFile() || await realpath(input) !== input) {
      throw new Error(`Export input must be a regular file without symlinks: ${name}`);
    }
  }
  // Do not overwrite an earlier candidate, even an empty directory.
  await mkdir(destination, { recursive: false });
  try {
    for (const name of repositoryFiles) {
      const target = resolve(destination, 'repository', name);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(resolve(source, name), target);
    }
    await mkdir(resolve(destination, 'assets'));
    const checksums = {};
    for (const name of assetFiles) {
      await copyFile(resolve(source, name), resolve(destination, 'assets', name));
      checksums[name] = createHash('sha256').update(await readFile(resolve(source, name))).digest('hex');
    }
    const release = { repository: 'distari-ai/obsidian-sync', tag: manifest.version, pluginId: manifest.id, checksums };
    await writeFile(resolve(destination, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
    return release;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--output') {
      throw new Error('Usage: npm run release:prepare -- --output "$TMPDIR/obsidian-release"');
    }
    const release = await prepareRelease(process.argv[3]);
    console.log(`Prepared ${release.repository} tag ${release.tag} in ${process.argv[3]}; nothing was published.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
