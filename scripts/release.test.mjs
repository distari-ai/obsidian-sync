import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import esbuild from 'esbuild';
import { buildOptions } from '../esbuild.config.mjs';
import { assetFiles, pluginRoot, prepareRelease, repositoryFiles, validateMetadata } from './prepare-release.mjs';

async function scratch(t) {
  const path = await mkdtemp(resolve(tmpdir(), 'distari-obsidian-release-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

async function metadata() {
  return Promise.all(['manifest.json', 'package.json', 'package-lock.json', 'versions.json']
    .map(async (file) => JSON.parse(await readFile(resolve(pluginRoot, file), 'utf8'))));
}

test('release metadata rejects mismatched versions and missing compatibility entries', async () => {
  const values = await metadata();
  validateMetadata(...values);
  for (const version of ['v0.1.0', '0.1.0-beta.1', '01.1.0']) {
    assert.throws(() => validateMetadata({ ...values[0], version }, ...values.slice(1)), /x.y.z/);
  }
  assert.throws(() => validateMetadata(values[0], { ...values[1], version: '9.0.0' }, ...values.slice(2)), /versions must agree/);
  assert.throws(() => validateMetadata(...values.slice(0, 3), {}), /current minimum/);
  assert.throws(() => validateMetadata({ ...values[0], id: 'a-new-id' }, ...values.slice(1)), /stable/);
  assert.throws(() => validateMetadata(values[0], values[1], { ...values[2], packages: {} }, values[3]), /versions must agree/);
});

test('export has root install metadata, exact release assets and no unlisted files', async (t) => {
  const path = await scratch(t);
  const release = await prepareRelease(resolve(path, 'candidate'));
  const root = resolve(path, 'candidate/repository');
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile()).map((entry) => resolve(entry.parentPath, entry.name).slice(root.length + 1)).sort();
  assert.deepEqual(files, [...repositoryFiles].sort());
  assert.deepEqual((await readdir(resolve(path, 'candidate/assets'))).sort(), [...assetFiles].sort());
  assert.equal(release.tag, (await metadata())[0].version);
  for (const name of assetFiles) {
    const asset = await readFile(resolve(path, 'candidate/assets', name));
    assert.deepEqual(asset, await readFile(resolve(root, name)));
    assert.equal(createHash('sha256').update(asset).digest('hex'), release.checksums[name]);
  }
  // The public README must remain useful without access to the private monorepo.
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  assert.ok(!readme.includes('../../docs/'));
  for (const [, link] of readme.matchAll(/\]\(([^)]+)\)/g)) {
    if (!link.includes('://') && !link.startsWith('#')) await readFile(resolve(root, link));
  }
});

test('export refuses source paths, symlinks, existing destinations and bad inputs', async (t) => {
  const path = await scratch(t);
  const root = resolve(path, 'source');
  await mkdir(root);
  for (const name of repositoryFiles) {
    const target = resolve(root, name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(pluginRoot, name), target);
  }
  await writeFile(resolve(root, '.env'), 'synthetic private input');
  await writeFile(resolve(root, 'data.json'), 'synthetic vault settings');
  await prepareRelease(resolve(path, 'candidate'), root);
  assert.ok(!(await readdir(resolve(path, 'candidate/repository'))).includes('.env'));
  await assert.rejects(prepareRelease(resolve(path, 'candidate'), root), /EEXIST/);
  await assert.rejects(prepareRelease(root, root), /outside/);
  await assert.rejects(prepareRelease(resolve(root, 'release'), root), /outside/);
  await symlink(root, resolve(path, 'source-alias'));
  await assert.rejects(prepareRelease(resolve(path, 'source-alias/release'), root), /outside/);
  await rm(resolve(root, 'main.js'));
  await symlink(resolve(pluginRoot, 'main.js'), resolve(root, 'main.js'));
  await assert.rejects(prepareRelease(resolve(path, 'bad-candidate'), root), /regular file/);
  await assert.rejects(readdir(resolve(path, 'bad-candidate')), /ENOENT/);
  await rm(resolve(root, 'main.js'));
  await copyFile(resolve(pluginRoot, 'main.js'), resolve(root, 'main.js'));
  await rm(resolve(root, 'src'), { recursive: true });
  await symlink(resolve(pluginRoot, 'src'), resolve(root, 'src'), 'dir');
  await assert.rejects(prepareRelease(resolve(path, 'linked-source-candidate'), root), /without symlinks/);
});

test('exported source rebuilds to identical licensed JavaScript with installed dependencies', async (t) => {
  const path = await scratch(t);
  await prepareRelease(resolve(path, 'candidate'));
  const root = resolve(path, 'candidate/repository');
  // Reuse the installed packages in place; never copy dependencies or caches.
  await symlink(resolve(pluginRoot, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  const built = await esbuild.build({
    ...buildOptions(root), absWorkingDir: root, write: false, logLevel: 'silent',
  });
  const asset = await readFile(resolve(path, 'candidate/assets/main.js'), 'utf8');
  assert.equal(built.outputFiles[0].text, asset);
  assert.ok(asset.includes('Copyright (c) 2026 Oshan and Sumedhe Dissanayake'));
  assert.ok(asset.includes('Copyright (c) 2022 Paul Miller'));
  assert.ok(asset.includes('Permission is hereby granted'));
});

// Run the shipped CommonJS asset against an Obsidian API double. It checks the
// packaging/lifecycle boundary, not native UI or the community downloader.
test('packaged install and simulated upgrade preserve settings, checkpoints and local edits', async (t) => {
  const path = await scratch(t);
  await prepareRelease(resolve(path, 'candidate'));
  const install = resolve(path, 'vault/.obsidian/plugins/distari-sync');
  await mkdir(install, { recursive: true });
  for (const name of assetFiles) await copyFile(resolve(path, 'candidate/assets', name), resolve(install, name));
  const dataFile = resolve(install, 'data.json');
  const files = new Map();
  const content = new Map();
  const notices = [];
  let revoked = false;
  let summary = 'Source one';
  const project = { id: 'fixture-project', name: 'Fixture project' };
  const paper = { id: 7, project_id: project.id, title: 'Fixture paper', authors: [], year: 2026,
    venue: null, doi: null, tags: [], updated_at: '2026-10-04T00:00:00Z' };
  class TFile { constructor(path) { this.path = path; } }
  class TFolder { constructor(path) { this.path = path; } }
  class Plugin {
    constructor(app) { this.app = app; }
    async loadData() { try { return JSON.parse(await readFile(dataFile, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
    async saveData(data) { await writeFile(dataFile, JSON.stringify(data)); }
    addCommand() {}
    addRibbonIcon() {}
    registerEvent() {}
    addSettingTab() {}
  }
  const app = {
    workspace: { on: () => ({}), onLayoutReady: () => {} },
    secretStorage: { getSecret: (name) => name === 'fixture-keychain-name' ? 'synthetic-token' : '' },
    vault: {
      getAbstractFileByPath: (path) => files.get(path),
      read: async (file) => content.get(file.path),
      create: async (path, value) => { assert.ok(!files.has(path)); files.set(path, new TFile(path)); content.set(path, value); },
      createFolder: async (path) => { files.set(path, new TFolder(path)); },
      process: async (file, update) => { content.set(file.path, update(content.get(file.path))); },
    },
  };
  const obsidian = {
    Plugin, TFile, TFolder, PluginSettingTab: class {}, SecretComponent: class {}, Setting: class {},
    Notice: class { constructor(message) { notices.push(message); } },
    requestUrl: async ({ url, headers }) => {
      assert.equal(headers.Authorization, 'Bearer synthetic-token');
      let body;
      if (revoked) return { status: 401, text: JSON.stringify({ error: { message: 'Invalid or expired token' } }), headers: {} };
      const request = new URL(url);
      if (request.pathname.endsWith('/projects')) body = [project];
      else if (request.pathname.endsWith('/papers')) body = { papers: [paper], pagination: { total_pages: 1 } };
      else if (request.pathname.endsWith('/summary')) body = { overview: summary };
      else if (request.pathname.endsWith('/notes')) body = [];
      else throw new Error(`Unexpected request ${url}`);
      return { status: 200, text: JSON.stringify(body), headers: {} };
    },
  };
  async function load() {
    const module = { exports: {} };
    const bundle = await readFile(resolve(install, 'main.js'), 'utf8');
    runInNewContext(bundle, { module, exports: module.exports, structuredClone, TextEncoder, Uint8Array, URL,
      window: { setInterval: () => 1, clearInterval: () => {} },
      require: (name) => { assert.equal(name, 'obsidian', 'No Node/Electron or missing runtime dependency'); return obsidian; },
    });
    const plugin = new module.exports.default(app);
    await plugin.onload();
    return plugin;
  }
  // Fresh installation starts without data.json or a token.
  let plugin = await load();
  assert.equal(plugin.data.secretName, '');
  plugin.onunload();
  // Use stored settings with automatic import disabled for the data journey.
  await writeFile(dataFile, JSON.stringify({ apiUrl: 'https://api.distari.com', secretName: 'fixture-keychain-name',
    rootFolder: 'Research', selectedProjectIds: [project.id], intervalMinutes: 0 }));
  plugin = await load();
  await plugin.syncNow();
  assert.ok(notices.at(-1).includes('1 new'), notices.at(-1));
  await plugin.syncNow();
  assert.ok(notices.at(-1).includes('0 new, 0 updated, 0 conflicts'));
  const paperPath = [...content.keys()][0];
  content.set(paperPath, `${content.get(paperPath)}\nMy local edit`);
  summary = 'Source two';
  await plugin.syncNow();
  assert.ok(notices.at(-1).includes('1 conflict'));
  const settingsBefore = await readFile(dataFile, 'utf8');
  const filesBefore = new Map(content);
  plugin.onunload();
  // Simulate asset-only successor installation, preserving the installed ID.
  for (const name of assetFiles) await copyFile(resolve(path, 'candidate/assets', name), resolve(install, name));
  const manifest = JSON.parse(await readFile(resolve(install, 'manifest.json'), 'utf8'));
  await writeFile(resolve(install, 'manifest.json'), JSON.stringify({ ...manifest, version: '0.1.1' }));
  plugin = await load();
  assert.equal(await readFile(dataFile, 'utf8'), settingsBefore);
  assert.equal(plugin.data.secretName, 'fixture-keychain-name');
  assert.equal(plugin.data.rootFolder, 'Research');
  assert.deepEqual(plugin.data.selectedProjectIds, [project.id]);
  assert.equal(plugin.data.intervalMinutes, 0);
  await plugin.syncNow();
  assert.ok(notices.at(-1).includes('0 new, 0 updated, 0 conflicts'));
  assert.deepEqual(content, filesBefore);
  revoked = true;
  const checkpointBefore = await readFile(dataFile, 'utf8');
  await plugin.syncNow();
  assert.ok(notices.at(-1).includes('Invalid or expired token'));
  assert.equal(await readFile(dataFile, 'utf8'), checkpointBefore);
  assert.deepEqual(content, filesBefore);
  plugin.onunload();
});
