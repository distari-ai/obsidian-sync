import {
  Notice,
  Plugin,
  PluginSettingTab,
  SecretComponent,
  Setting,
  TFile,
  TFolder,
  requestUrl,
  type App,
  type SettingDefinitionItem,
} from 'obsidian';
import { DistariApi, normalizeApiBase, type ApiTransport, type DistariProject } from './api.ts';
import { VaultSync, type SyncState, type VaultPort } from './sync.ts';

interface PluginData {
  apiUrl: string;
  secretName: string;
  rootFolder: string;
  selectedProjectIds: string[];
  intervalMinutes: number;
  sync: SyncState;
}

const DEFAULT_DATA: PluginData = {
  apiUrl: 'https://api.distari.com',
  secretName: '',
  rootFolder: 'Distari',
  selectedProjectIds: [],
  intervalMinutes: 30,
  sync: { projectFolders: {}, files: {} },
};

function validateFolder(value: string): string {
  const path = value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!path || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Choose a folder inside this vault, such as Distari or Research/Distari.');
  }
  return path;
}

class ObsidianVault implements VaultPort {
  constructor(private readonly app: App) {}

  async readBinary(path: string): Promise<ArrayBuffer | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!(file instanceof TFile)) throw new Error(`${path} is a folder, not an image.`);
    return this.app.vault.readBinary(file);
  }
  async createBinary(path: string, bytes: ArrayBuffer): Promise<void> { await this.app.vault.createBinary(path, bytes); }

  async read(path: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!(file instanceof TFile)) throw new Error(`${path} is a folder, not a Markdown file.`);
    return this.app.vault.read(file);
  }

  async create(path: string, content: string): Promise<void> {
    await this.app.vault.create(path, content);
  }

  async process(path: string, update: (current: string) => string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`${path} is no longer a Markdown file.`);
    await this.app.vault.process(file, update);
  }

  async ensureFolder(path: string): Promise<void> {
    let current = '';
    for (const part of path.split('/')) {
      current = current ? `${current}/${part}` : part;
      const found = this.app.vault.getAbstractFileByPath(current);
      if (!found) await this.app.vault.createFolder(current);
      else if (!(found instanceof TFolder)) throw new Error(`${current} is a file, not a folder.`);
    }
  }
}

const transport: ApiTransport = async (url, token) => {
  const response = await requestUrl({
    url,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
    throw: false,
  });
  return { status: response.status, body: response.text, bytes: response.arrayBuffer, headers: response.headers };
};

export default class DistariPlugin extends Plugin {
  data: PluginData = structuredClone(DEFAULT_DATA);
  private timer: number | undefined;
  private running = false;

  async onload(): Promise<void> {
    const stored = await this.loadData() as Partial<PluginData> | null;
    this.data = {
      ...structuredClone(DEFAULT_DATA),
      ...stored,
      sync: {
        projectFolders: stored?.sync?.projectFolders ?? {},
        files: stored?.sync?.files ?? {},
      },
    };
    this.addCommand({ id: 'import-from-distari', name: 'Import from Distari', callback: () => void this.syncNow() });
    this.addRibbonIcon('download', 'Import from Distari', () => void this.syncNow());
    this.registerEvent(this.app.workspace.on('file-menu', (menu) => {
      menu.addItem((item) => item.setTitle('Import from Distari').setIcon('download')
        .onClick(() => void this.syncNow()));
    }));
    this.addSettingTab(new DistariSettings(this.app, this));
    this.resetTimer();
    this.app.workspace.onLayoutReady(() => {
      if (this.data.selectedProjectIds.length) void this.syncNow(true);
    });
  }

  onunload(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
  }

  async save(): Promise<void> {
    await this.saveData(this.data);
  }

  api(): DistariApi {
    const token = this.data.secretName && this.app.secretStorage.getSecret(this.data.secretName);
    if (!token) throw new Error('Choose a personal access token in Distari sync settings.');
    return new DistariApi(normalizeApiBase(this.data.apiUrl), token, transport);
  }

  resetTimer(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    if (this.data.intervalMinutes > 0) {
      this.timer = window.setInterval(() => void this.syncNow(true), this.data.intervalMinutes * 60_000);
    }
  }

  async syncNow(quiet = false): Promise<void> {
    if (this.running) return;
    if (!this.data.selectedProjectIds.length) {
      if (!quiet) new Notice('Choose at least one Distari project in plugin settings.');
      return;
    }
    this.running = true;
    try {
      const api = this.api();
      const root = validateFolder(this.data.rootFolder);
      const projects = await api.projects();
      const selected = projects.filter((project) => this.data.selectedProjectIds.includes(project.id));
      if (selected.length !== this.data.selectedProjectIds.length) {
        throw new Error('A selected project is unavailable. Refresh the project list in settings.');
      }
      const sync = new VaultSync(new ObsidianVault(this.app), this.data.sync, () => this.save(), root);
      let created = 0, updated = 0, conflicts = 0;
      for (const project of selected) {
        const count = await sync.project(project, api);
        created += count.created;
        updated += count.updated;
        conflicts += count.conflicts;
      }
      if (!quiet || created || updated || conflicts) {
        new Notice(`Distari import: ${created} new, ${updated} updated, ${conflicts} conflict${conflicts === 1 ? '' : 's'}.`);
      }
    } catch (error) {
      new Notice(`Distari import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}

// Declarative settings (Obsidian 1.13+) so every row appears in settings search.
type ProjectList =
  | { state: 'idle' | 'loading' }
  | { state: 'loaded'; projects: DistariProject[] }
  | { state: 'failed'; message: string };

class DistariSettings extends PluginSettingTab {
  private projectList: ProjectList = { state: 'idle' };

  constructor(app: App, private readonly plugin: DistariPlugin) { super(app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { name: 'Distari API', desc: 'Use the hosted API, or a local development server.', render: (setting) => {
        setting.addText((field) => field.setValue(this.plugin.data.apiUrl).onChange(async (value) => {
          this.plugin.data.apiUrl = value.trim();
          await this.plugin.save();
        }));
      } },
      { name: 'Personal access token',
        desc: 'Create a read-only token in Distari Account settings, then link it through Obsidian Keychain.',
        render: (setting) => {
          setting.addComponent((el) => new SecretComponent(this.app, el)
            .setValue(this.plugin.data.secretName)
            .onChange(async (name) => {
              this.plugin.data.secretName = name;
              await this.plugin.save();
              this.reloadProjects();
            }));
        } },
      { name: 'Vault folder', desc: 'Projects are saved in separate folders beneath this folder.', render: (setting) => {
        setting.addText((field) => field.setValue(this.plugin.data.rootFolder).onChange(async (value) => {
          this.plugin.data.rootFolder = value;
          await this.plugin.save();
        }));
      } },
      { name: 'Automatic import', desc: 'Refresh selected projects while Obsidian is open.', render: (setting) => {
        setting.addDropdown((dropdown) => dropdown
          .addOption('0', 'Off').addOption('15', 'Every 15 minutes')
          .addOption('30', 'Every 30 minutes').addOption('60', 'Every hour')
          .setValue(String(this.plugin.data.intervalMinutes))
          .onChange(async (value) => {
            this.plugin.data.intervalMinutes = Number(value);
            await this.plugin.save();
            this.plugin.resetTimer();
          }));
      } },
      { name: 'Projects', desc: 'Only selected projects are imported.', render: (setting) => {
        setting.addButton((button) => button.setButtonText('Refresh list').onClick(() => this.reloadProjects()));
        // Rendering means the tab is open; the search index never fetches.
        if (this.projectList.state === 'idle') void this.loadProjects();
      } },
      ...this.projectRows(),
      { name: 'Import now', render: (setting) => {
        setting.addButton((button) => button.setButtonText('Import from Distari')
          .setCta().onClick(() => void this.plugin.syncNow()));
      } },
    ];
  }

  hide(): void {
    // Reopening the tab fetches a fresh project list, as display() used to.
    this.projectList = { state: 'idle' };
    super.hide();
  }

  private projectRows(): SettingDefinitionItem[] {
    const list = this.projectList;
    if (list.state === 'failed') return [{ name: list.message, searchable: false }];
    if (list.state !== 'loaded') return [];
    if (!list.projects.length) return [{ name: 'No active projects are available.', searchable: false }];
    return list.projects.map((project) => ({ name: project.name, render: (setting: Setting) => {
      setting.addToggle((toggle) => toggle
        .setValue(this.plugin.data.selectedProjectIds.includes(project.id))
        .onChange(async (enabled) => {
          const selected = new Set(this.plugin.data.selectedProjectIds);
          if (enabled) selected.add(project.id); else selected.delete(project.id);
          this.plugin.data.selectedProjectIds = [...selected];
          await this.plugin.save();
        }));
    } }));
  }

  private reloadProjects(): void {
    this.projectList = { state: 'idle' };
    void this.loadProjects();
  }

  private async loadProjects(): Promise<void> {
    const request: ProjectList = { state: 'loading' };
    this.projectList = request;
    let next: ProjectList;
    try {
      next = { state: 'loaded', projects: await this.plugin.api().projects() };
    } catch (error) {
      next = { state: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
    // A newer reload or a closed tab supersedes this result.
    if (this.projectList !== request) return;
    this.projectList = next;
    this.update();
  }
}
