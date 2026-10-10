import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import type DistariPlugin from './main.ts';

// Compile the real entry point in memory: Node's type stripping does not support
// its parameter properties, and the Obsidian npm package supplies types only.
// Keep all plugin code real and replace only the host's runtime API.
const built = await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./main.ts', import.meta.url))], bundle: true,
  external: ['obsidian'], platform: 'node', format: 'cjs', target: 'es2022', write: false,
});

type Callback = () => void;
class Container {
  isConnected = true;
  text = '';
  children: Container[] = [];
  empty() { this.children.forEach((child) => { child.isConnected = false; }); this.children = []; }
  createDiv() { const child = new Container(); this.children.push(child); return child; }
  setText(text: string) { this.text = text; }
}
class Control {
  value: string | boolean = '';
  options: Record<string, string> = {};
  label = '';
  change?: (value: never) => Promise<void>;
  click?: Callback;
  setValue(value: string | boolean) { this.value = value; return this; }
  onChange(callback: (value: never) => Promise<void>) { this.change = callback; return this; }
  addOption(value: string, label: string) { this.options[value] = label; return this; }
  setButtonText(label: string) { this.label = label; return this; }
  setCta() { return this; }
  onClick(callback: Callback) { this.click = callback; return this; }
  async update(value: string | boolean) { assert.ok(this.change); await this.change(value as never); }
}

function fixture(stored: object | null = null) {
  const notices: string[] = [];
  const commands: Array<{ id: string; name: string; callback: Callback }> = [];
  const ribbons: Array<{ icon: string; title: string; callback: Callback }> = [];
  const tabs: Array<{ containerEl: Container; settingItems: Array<{ name: string }>; display(): void; hide(): void; update(): void }> = [];
  const settings: Array<{ name: string; container: Container; control?: Control }> = [];
  const rows: string[] = [];
  const intervals = new Map<number, { callback: Callback; delay: number }>();
  const cleared: number[] = [];
  const saved: object[] = [];
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; throw: boolean }> = [];
  const files = new Map<string, { path: string }>();
  const contents = new Map<string, string>();
  let timerId = 0;
  let layoutReady: Callback = () => {};
  let fileMenu: (menu: unknown) => void = () => {};
  let event: unknown;
  let status = 200;
  let projects = [{ id: 'p1', name: 'Research' }, { id: 'p2', name: 'Other' }];
  let secret = 'synthetic-token';
  class TFile { path: string; constructor(path: string) { this.path = path; } }
  class TFolder { path: string; constructor(path: string) { this.path = path; } }
  const app = {
    workspace: {
      on(name: string, callback: typeof fileMenu) { assert.equal(name, 'file-menu'); fileMenu = callback; return 'file-menu-event'; },
      onLayoutReady(callback: Callback) { layoutReady = callback; },
    },
    secretStorage: { getSecret(name: string) { assert.ok(['distari-secret', 'replacement-secret'].includes(name)); return secret; } },
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path),
      read: async (file: TFile) => contents.get(file.path),
      create: async (path: string, content: string) => { assert.ok(!files.has(path)); files.set(path, new TFile(path)); contents.set(path, content); },
      process: async (file: TFile, update: (content: string) => string) => { contents.set(file.path, update(contents.get(file.path)!)); },
      createFolder: async (path: string) => { assert.ok(!files.has(path)); files.set(path, new TFolder(path)); },
    },
  };
  class Plugin {
    app = app;
    async loadData() { return stored; }
    async saveData(data: object) { saved.push(structuredClone(data)); }
    addCommand(command: typeof commands[number]) { commands.push(command); }
    addRibbonIcon(icon: string, title: string, callback: Callback) { ribbons.push({ icon, title, callback }); }
    registerEvent(value: unknown) { event = value; }
    addSettingTab(tab: typeof tabs[number]) { tabs.push(tab); tab.update(); }
  }
  // Mirrors Obsidian 1.13: update() stores the definitions (search indexing),
  // display() renders them when the tab opens, and update() on an open tab re-renders.
  type Definition = { name: string; searchable?: boolean; render?: (setting: Setting) => void };
  class PluginSettingTab {
    app = app;
    containerEl = new Container();
    settingItems: Definition[] = [];
    open = false;
    getSettingDefinitions(): Definition[] { return []; }
    update() { this.settingItems = this.getSettingDefinitions(); if (this.open) this.render(); }
    display() { this.open = true; this.render(); }
    hide() { this.open = false; this.containerEl.empty(); }
    render() {
      this.containerEl.empty();
      for (const item of this.settingItems) item.render?.(new Setting(this.containerEl).setName(item.name));
      for (const item of this.settingItems) if (!item.render) rows.push(item.name);
    }
  }
  class Setting {
    entry: typeof settings[number];
    constructor(container: Container) { this.entry = { name: '', container }; settings.push(this.entry); }
    setName(name: string) { this.entry.name = name; return this; }
    setDesc(_description: string) { return this; }
    addText(callback: (field: Control) => unknown) { return this.addControl(callback); }
    addDropdown(callback: (field: Control) => unknown) { return this.addControl(callback); }
    addToggle(callback: (field: Control) => unknown) { return this.addControl(callback); }
    addButton(callback: (field: Control) => unknown) { return this.addControl(callback); }
    addComponent(callback: (el: Container) => Control) { this.entry.control = callback(this.entry.container); return this; }
    addControl(callback: (field: Control) => unknown) { this.entry.control = new Control(); callback(this.entry.control); return this; }
  }
  const obsidian = {
    Plugin, PluginSettingTab, Setting, TFile, TFolder,
    SecretComponent: class extends Control {},
    Notice: class { constructor(message: string) { notices.push(message); } },
    requestUrl: async (request: typeof calls[number]) => {
      calls.push(request);
      const url = new URL(request.url);
      let body: unknown;
      if (status !== 200) body = { error: { message: 'Token revoked' } };
      else if (url.pathname === '/api/v1/projects') body = projects;
      else if (url.pathname === '/api/v1/papers') body = { papers: [{ id: 7, project_id: 'p1', title: 'Study', authors: [], year: null, venue: null, doi: null, tags: [], updated_at: '2026-01-01' }], pagination: { total_pages: 1 } };
      else if (url.pathname === '/api/v1/papers/7/summary') body = { overview: 'An overview.' };
      else if (url.pathname === '/api/v1/projects/p1/notes') body = [];
      else throw new Error(`Unexpected request: ${request.url}`);
      return { status, text: JSON.stringify(body), headers: {}, arrayBuffer: new ArrayBuffer(0) };
    },
  };
  const module = { exports: {} as { default: new () => DistariPlugin } };
  runInNewContext(built.outputFiles[0].text, {
    module, exports: module.exports, structuredClone, URL, TextEncoder, Uint8Array,
    window: {
      setInterval(callback: Callback, delay: number) { const id = ++timerId; intervals.set(id, { callback, delay }); return id; },
      clearInterval(id: number) { cleared.push(id); intervals.delete(id); },
    },
    require(name: string) { assert.equal(name, 'obsidian'); return obsidian; },
  });
  const plugin = new module.exports.default();
  return {
    plugin, commands, ribbons, tabs, settings, rows, intervals, cleared, saved, notices, calls, contents, files,
    get event() { return event; }, layoutReady: () => layoutReady(), fileMenu: (menu: unknown) => fileMenu(menu),
    setStatus(value: number) { status = value; }, setProjects(value: typeof projects) { projects = value; },
    setSecret(value: string) { secret = value; },
    control(name: string) { const entry = [...settings].reverse().find((setting) => setting.name === name); assert.ok(entry?.control, name); return entry.control; },
  };
}

async function until(outcome: () => boolean) {
  for (let i = 0; i < 20 && !outcome(); i++) await setImmediate();
  assert.ok(outcome(), 'Expected asynchronous settings outcome');
}
const configured = { secretName: 'distari-secret', selectedProjectIds: ['p1'], intervalMinutes: 0 };

void test('fresh load registers every manual entry point and automatic import lifecycle', async () => {
  const f = fixture();
  await f.plugin.onload();
  assert.deepEqual(structuredClone(f.plugin.data), { apiUrl: 'https://api.distari.com', secretName: '', rootFolder: 'Distari', selectedProjectIds: [], intervalMinutes: 30, sync: { files: {}, projectFolders: {} } });
  assert.equal(f.commands.length, 1);
  assert.equal(f.commands[0].id, 'import-from-distari');
  assert.equal(f.commands[0].name, 'Import from Distari');
  assert.equal(f.ribbons[0].icon, 'download');
  assert.equal(f.ribbons[0].title, 'Import from Distari');
  assert.equal(f.event, 'file-menu-event');
  assert.equal(f.tabs.length, 1);
  const imports: boolean[] = [];
  f.plugin.syncNow = async (quiet = false) => { imports.push(quiet); };
  f.commands[0].callback();
  f.ribbons[0].callback();
  let menuCallback: Callback | undefined;
  const item = { setTitle(title: string) { assert.equal(title, 'Import from Distari'); return this; }, setIcon(icon: string) { assert.equal(icon, 'download'); return this; }, onClick(callback: Callback) { menuCallback = callback; return this; } };
  f.fileMenu({ addItem(callback: (menuItem: typeof item) => void) { callback(item); } });
  assert.ok(menuCallback);
  menuCallback();
  f.layoutReady();
  assert.deepEqual(imports, [false, false, false]);
  assert.equal(f.intervals.get(1)?.delay, 30 * 60_000);
  f.intervals.get(1)!.callback();
  f.plugin.data.selectedProjectIds = ['p1'];
  f.layoutReady();
  assert.deepEqual(imports, [false, false, false, true, true]);
  f.plugin.data.intervalMinutes = 15;
  f.plugin.resetTimer();
  assert.deepEqual(f.cleared, [1]);
  assert.equal(f.intervals.get(2)?.delay, 15 * 60_000);
  f.plugin.data.intervalMinutes = 0;
  f.plugin.resetTimer();
  assert.equal(f.intervals.size, 0);
  f.plugin.data.intervalMinutes = 60;
  f.plugin.resetTimer();
  f.plugin.onunload();
  assert.equal(f.intervals.size, 0);
});

void test('settings load persisted values, save edits, select projects and invoke import', async () => {
  const f = fixture({ ...configured, rootFolder: 'Research', sync: { projectFolders: { p1: 'Existing' } } });
  await f.plugin.onload();
  assert.equal(f.intervals.size, 0);
  assert.deepEqual(structuredClone(f.plugin.data.sync), { projectFolders: { p1: 'Existing' }, files: {} });
  const tab = f.tabs[0];
  tab.display();
  await until(() => f.settings.some((setting) => setting.name === 'Other'));
  assert.equal(f.control('Distari API').value, 'https://api.distari.com');
  assert.equal(f.control('Personal access token').value, 'distari-secret');
  assert.equal(f.control('Vault folder').value, 'Research');
  assert.deepEqual(f.control('Automatic import').options, { 0: 'Off', 15: 'Every 15 minutes', 30: 'Every 30 minutes', 60: 'Every hour' });
  assert.equal(f.control('Research').value, true);
  assert.equal(f.control('Other').value, false);
  await f.control('Distari API').update(' https://local.example ');
  await f.control('Vault folder').update('Papers/Distari');
  await f.control('Automatic import').update('15');
  assert.equal([...f.intervals.values()][0].delay, 15 * 60_000);
  await f.control('Automatic import').update('0');
  assert.equal(f.intervals.size, 0);
  await f.control('Other').update(true);
  await f.control('Other').update(true);
  await f.control('Research').update(false);
  assert.deepEqual(structuredClone(f.plugin.data.selectedProjectIds), ['p2']);
  await f.control('Personal access token').update('replacement-secret');
  assert.equal(f.plugin.data.secretName, 'replacement-secret');
  await until(() => f.calls.length >= 2 && f.control('Personal access token').value === 'replacement-secret');
  let imports = 0;
  f.plugin.syncNow = async () => { imports++; };
  f.control('Import now').click!();
  assert.equal(imports, 1);
  f.control('Projects').click!();
  await until(() => f.calls.length >= 3);
  assert.deepEqual(f.saved.at(-1), structuredClone(f.plugin.data));
  assert.equal(f.plugin.data.apiUrl, 'https://local.example');
  assert.equal(f.plugin.data.rootFolder, 'Papers/Distari');
  assert.ok(!JSON.stringify(f.saved).includes('synthetic-token'));
  f.plugin.onunload();
});

void test('project settings show empty, revoked-token and missing-Keychain states', async () => {
  const f = fixture(configured);
  await f.plugin.onload();
  assert.equal(f.calls.length, 0, 'indexing the settings for search must not fetch projects');
  assert.ok(f.tabs[0].settingItems.some((item) => item.name === 'Vault folder'));
  f.setProjects([]);
  f.tabs[0].display();
  await until(() => f.rows.includes('No active projects are available.'));
  f.tabs[0].hide();
  f.setStatus(401);
  f.tabs[0].display();
  await until(() => f.rows.includes('Token revoked'));
  f.tabs[0].hide();
  f.setSecret('');
  f.tabs[0].display();
  await until(() => f.rows.some((row) => row.includes('Choose a personal access token')));
  const closed = fixture(configured);
  await closed.plugin.onload();
  closed.tabs[0].display();
  closed.tabs[0].hide();
  await setImmediate();
  await setImmediate();
  assert.ok(!closed.settings.some((setting) => setting.name === 'Research'), 'a closed tab drops a late project list');
});

void test('uses Keychain and authenticated requestUrl; refuses missing secrets and unsafe origins', async () => {
  const f = fixture(configured);
  await f.plugin.onload();
  await f.plugin.api().projects();
  assert.deepEqual(f.calls.map((call) => ({ ...call, headers: { ...call.headers } })), [{
    url: 'https://api.distari.com/api/v1/projects', method: 'GET', throw: false,
    headers: { Authorization: 'Bearer synthetic-token', Accept: 'application/json', 'Accept-Encoding': 'gzip' },
  }]);
  f.plugin.data.apiUrl = 'http://untrusted.example';
  assert.throws(() => f.plugin.api(), /HTTPS API origin/);
  f.setSecret('');
  assert.throws(() => f.plugin.api(), /Choose a personal access token/);
  f.plugin.data.secretName = '';
  assert.throws(() => f.plugin.api(), /Choose a personal access token/);
});

void test('manual import handles missing selection, invalid folder, lost access and revocation without writes', async () => {
  const f = fixture({ intervalMinutes: 0 });
  await f.plugin.onload();
  await f.plugin.syncNow(true);
  assert.deepEqual(f.notices, []);
  await f.plugin.syncNow();
  assert.match(f.notices.at(-1)!, /Choose at least one/);
  f.plugin.data.secretName = 'distari-secret';
  f.plugin.data.selectedProjectIds = ['p1'];
  for (const folder of ['', '/outside', '../outside', 'Research//papers', './papers']) {
    f.plugin.data.rootFolder = folder;
    await f.plugin.syncNow();
    assert.match(f.notices.at(-1)!, /Choose a folder inside this vault/);
  }
  f.plugin.data.rootFolder = 'Research';
  f.plugin.data.selectedProjectIds = ['gone'];
  await f.plugin.syncNow();
  assert.match(f.notices.at(-1)!, /selected project is unavailable/);
  f.plugin.data.selectedProjectIds = ['p1'];
  f.setStatus(401);
  await f.plugin.syncNow(true);
  assert.match(f.notices.at(-1)!, /Distari import failed: Token revoked/);
  assert.equal(f.contents.size, 0);
  assert.equal(f.saved.length, 0);
});

void test('import prevents overlap, resets after failure and runs the real vault sync', async () => {
  const f = fixture(configured);
  await f.plugin.onload();
  f.setStatus(401);
  const failed = f.plugin.syncNow();
  await f.plugin.syncNow();
  await failed;
  assert.equal(f.calls.length, 1);
  assert.equal(f.notices.length, 1);
  f.setStatus(200);
  await f.plugin.syncNow();
  assert.match(f.notices.at(-1)!, /1 new, 0 updated, 0 conflicts/);
  assert.equal(f.contents.size, 1);
  assert.match([...f.contents.values()][0], /## Overview\n\nAn overview\./);
  assert.ok(f.saved.length > 0);
  const notices = f.notices.length;
  await f.plugin.syncNow(true);
  assert.equal(f.notices.length, notices);
  assert.equal(f.contents.size, 1);
});
