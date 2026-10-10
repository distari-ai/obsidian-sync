import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { DistariApi, DistariProject, DistariSummary } from './api.ts';
import { renderNote, renderPaper, safeName, type ExportedItem } from './render.ts';

export interface FileState {
  path: string;
  baseHash: string;
  sourceUpdatedAt: string;
  pendingHash?: string;
}

export interface SyncState {
  projectFolders: Record<string, string>;
  files: Record<string, FileState>;
}

export interface VaultPort {
  readBinary(path: string): Promise<ArrayBuffer | null>;
  createBinary(path: string, bytes: ArrayBuffer): Promise<void>;
  read(path: string): Promise<string | null>;
  create(path: string, content: string): Promise<void>;
  process(path: string, update: (current: string) => string): Promise<void>;
  ensureFolder(path: string): Promise<void>;
}

export interface SyncCounts {
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
}

function digest(content: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(content)));
}

function newPath(folder: string, kind: 'Papers' | 'Notes', title: string, id: string): string {
  return `${folder}/${kind}/${safeName(title)} [${id}].md`;
}

async function mapLimit<T, U>(values: T[], limit: number, fn: (value: T) => Promise<U>): Promise<U[]> {
  const result = new Array<U>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) return;
      result[index] = await fn(values[index]);
    }
  }));
  return result;
}

export class VaultSync {
  private readonly vault: VaultPort;
  private readonly state: SyncState;
  private readonly persist: () => Promise<void>;
  private readonly rootFolder: string;
  private readonly siteUrl: string;

  constructor(
    vault: VaultPort,
    state: SyncState,
    persist: () => Promise<void>,
    rootFolder: string,
    siteUrl = 'https://distari.com',
  ) {
    this.vault = vault;
    this.state = state;
    this.persist = persist;
    this.rootFolder = rootFolder;
    this.siteUrl = siteUrl;
  }

  async project(project: DistariProject, api: DistariApi): Promise<SyncCounts> {
    const [papers, allNotes] = await Promise.all([api.papers(project.id), api.notes(project.id)]);
    const notes = allNotes.filter((note) => note.is_mine);
    const folder = this.state.projectFolders[project.id] ??
      `${this.rootFolder}/${safeName(project.name)} [${project.id}]`;
    this.state.projectFolders[project.id] = folder;
    await this.persist();

    const paperPaths = new Map<number, string>();
    for (const paper of papers) {
      paperPaths.set(paper.id, this.state.files[`paper:${paper.id}`]?.path ??
        await this.uniquePath(newPath(folder, 'Papers', paper.title, String(paper.id))));
    }
    const notePaths = new Map<string, string>();
    for (const note of notes) {
      notePaths.set(note.id, this.state.files[`note:${note.id}`]?.path ??
        await this.uniquePath(newPath(folder, 'Notes', note.title ?? 'Untitled note', note.id)));
    }
    const summaries = await mapLimit(papers, 4, (paper): Promise<DistariSummary | null> => api.summary(paper.id));
    const items: ExportedItem[] = papers.map((paper, index) => renderPaper(
      paper, summaries[index], notes, paperPaths.get(paper.id)!, notePaths, this.siteUrl,
    ));
    for (const original of notes) {
      const note = { ...original };
      const ids = [...new Set([...note.body_md.matchAll(/puskola:\/\/note-asset\/([0-9a-f-]{36})/g)].map((match) => match[1]))];
      for (const id of ids) {
        const asset = await api.noteAsset(id);
        await this.vault.ensureFolder(`${folder}/Assets`);
        let name = `${id}.${asset.extension}`;
        let existing = await this.vault.readBinary(`${folder}/Assets/${name}`);
        const hash = bytesToHex(sha256(new Uint8Array(asset.bytes)));
        if (existing && bytesToHex(sha256(new Uint8Array(existing))) !== hash) {
          // Preserve a locally edited image. Point this source at a new copy.
          name = `${id}-${hash}.${asset.extension}`;
          existing = await this.vault.readBinary(`${folder}/Assets/${name}`);
          if (existing && bytesToHex(sha256(new Uint8Array(existing))) !== hash) throw new Error('A note image path was changed locally. Preserve it and retry sync.');
        }
        if (!existing) await this.vault.createBinary(`${folder}/Assets/${name}`, asset.bytes);
        note.body_md = note.body_md.replaceAll(`puskola://note-asset/${id}`, `../Assets/${name}`);
      }
      items.push(renderNote(note, notePaths.get(note.id)!, paperPaths, notePaths, this.siteUrl));
    }
    const counts: SyncCounts = { created: 0, updated: 0, unchanged: 0, conflicts: 0 };
    for (const item of items) counts[await this.write(item)] += 1;
    return counts;
  }

  private async uniquePath(path: string): Promise<string> {
    if (await this.vault.read(path) === null) return path;
    const stem = path.slice(0, -3);
    for (let number = 2; ; number += 1) {
      const candidate = `${stem} (Distari ${number}).md`;
      if (await this.vault.read(candidate) === null) return candidate;
    }
  }

  private async conflict(item: ExportedItem, hash: string, existing: FileState): Promise<'conflicts' | 'unchanged'> {
    if (existing.pendingHash === hash) return 'unchanged';
    const stem = existing.path.slice(0, -3);
    const path = await this.uniquePath(`${stem} (Distari conflict ${new Date().toISOString().slice(0, 10)}).md`);
    await this.vault.ensureFolder(path.slice(0, path.lastIndexOf('/')));
    await this.vault.create(path, item.content);
    existing.pendingHash = hash;
    await this.persist();
    return 'conflicts';
  }

  private async write(item: ExportedItem): Promise<keyof SyncCounts> {
    const hash = digest(item.content);
    const known = this.state.files[item.key];
    if (known && known.sourceUpdatedAt === item.sourceUpdatedAt && known.baseHash === hash) {
      return 'unchanged';
    }
    if (!known) {
      const path = await this.uniquePath(item.path);
      await this.vault.ensureFolder(path.slice(0, path.lastIndexOf('/')));
      await this.vault.create(path, item.content);
      this.state.files[item.key] = { path, baseHash: hash, sourceUpdatedAt: item.sourceUpdatedAt };
      await this.persist();
      return 'created';
    }
    const current = await this.vault.read(known.path);
    if (current === null) {
      // A missing managed file was removed locally. Respect the deletion until
      // the source changes, and then put the new source in a conflict copy.
      return hash !== known.baseHash ? this.conflict(item, hash, known) : 'unchanged';
    }
    const currentHash = digest(current);
    if (currentHash === hash) {
      known.baseHash = hash;
      known.sourceUpdatedAt = item.sourceUpdatedAt;
      delete known.pendingHash;
      await this.persist();
      return 'unchanged';
    }
    if (currentHash !== known.baseHash) {
      return hash !== known.baseHash ? this.conflict(item, hash, known) : 'unchanged';
    }
    if (hash === known.baseHash) return 'unchanged';
    let changed = false;
    await this.vault.process(known.path, (fresh) => {
      if (digest(fresh) !== known.baseHash) return fresh;
      changed = true;
      return item.content;
    });
    if (!changed) return this.conflict(item, hash, known);
    known.baseHash = hash;
    known.sourceUpdatedAt = item.sourceUpdatedAt;
    delete known.pendingHash;
    await this.persist();
    return 'updated';
  }
}
