import assert from 'node:assert/strict';
import test from 'node:test';
import { DistariApi, normalizeApiBase, type ApiTransport, type ApiResponse } from './api.ts';
import { VaultSync, type SyncState, type VaultPort } from './sync.ts';

const project = { id: '11111111-1111-4111-8111-111111111111', name: 'Research' };
const noteId = '22222222-2222-4222-8222-222222222222';
const paper = {
  id: 7, project_id: project.id, title: 'A / study',
  authors: [{ full_name: 'Ada Lovelace' }], year: 2025, venue: { name: 'Journal' },
  doi: '10.1000/example', tags: [{ name: 'methods' }], updated_at: '2026-01-01T00:00:00Z',
};
const note = {
  id: noteId, project_id: project.id, file_id: 7, title: 'Reading note',
  body_md: 'See [[paper:7|this paper]].', tags: ['methods'], links: [],
  updated_at: '2026-01-01T00:00:00Z', is_mine: true,
};

class MemoryVault implements VaultPort {
  binaries = new Map<string, ArrayBuffer>();
  async readBinary(path: string) { return this.binaries.get(path) ?? null; }
  async createBinary(path: string, bytes: ArrayBuffer) { if (this.binaries.has(path)) throw new Error('Already exists'); this.binaries.set(path, bytes); }
  files = new Map<string, string>();
  async read(path: string): Promise<string | null> { return this.files.get(path) ?? null; }
  async create(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error('Already exists');
    this.files.set(path, content);
  }
  async process(path: string, update: (current: string) => string): Promise<void> {
    const current = this.files.get(path);
    if (current === undefined) throw new Error('Missing file');
    this.files.set(path, update(current));
  }
  async ensureFolder(_path: string): Promise<void> {}
}

function api(summaryText = 'First overview', sourceNote = note): DistariApi {
  const transport: ApiTransport = async (url) => {
    const path = new URL(url).pathname;
    let body: unknown;
    if (path.endsWith('/papers')) body = { papers: [paper], pagination: { total_pages: 1 } };
    else if (path.endsWith('/summary')) body = { overview: summaryText, summarized_at: summaryText === 'First overview' ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z' };
    else if (path.endsWith('/notes')) body = [sourceNote];
    else throw new Error(`Unexpected path ${path}`);
    return { status: 200, body: JSON.stringify(body), headers: {} };
  };
  return new DistariApi('https://api.distari.com', 'pk_test', transport);
}

void test('imports a paper, its summary, and a separate linked note', async () => {
  const vault = new MemoryVault();
  const state: SyncState = { projectFolders: {}, files: {} };
  let saves = 0;
  const sync = new VaultSync(vault, state, async () => { saves += 1; }, 'Distari');
  assert.deepEqual(await sync.project(project, api()), { created: 2, updated: 0, unchanged: 0, conflicts: 0 });
  const paperText = vault.files.get(state.files['paper:7'].path)!;
  const noteText = vault.files.get(state.files[`note:${noteId}`].path)!;
  assert.match(paperText, /authors:\n {2}- "Ada Lovelace"/);
  assert.match(paperText, /doi: "10\.1000\/example"/);
  assert.match(paperText, /## Overview\n\nFirst overview/);
  assert.match(paperText, /## My notes\n\n- \[\[Distari\/Research/);
  assert.match(noteText, /\[\[Distari\/Research.*\|this paper\]\]/);
  assert.ok(saves >= 3);
  assert.deepEqual(await sync.project(project, api()), { created: 0, updated: 0, unchanged: 2, conflicts: 0 });
});

void test('updates only unchanged files and never overwrites an Obsidian edit', async () => {
  const vault = new MemoryVault();
  const state: SyncState = { projectFolders: {}, files: {} };
  const sync = new VaultSync(vault, state, async () => {}, 'Distari');
  await sync.project(project, api());
  const path = state.files['paper:7'].path;
  const edited = vault.files.get(path)! + '\nMy own observation.\n';
  vault.files.set(path, edited);
  const result = await sync.project(project, api('New overview'));
  assert.equal(result.conflicts, 1);
  assert.equal(vault.files.get(path), edited);
  const conflict = [...vault.files.entries()].find(([name]) => name.includes('Distari conflict'));
  assert.ok(conflict);
  assert.match(conflict[1], /New overview/);
  await sync.project(project, api('New overview'));
  assert.equal([...vault.files.keys()].filter((name) => name.includes('Distari conflict')).length, 1);
});

void test('an untouched managed file receives a later summary', async () => {
  const vault = new MemoryVault();
  const state: SyncState = { projectFolders: {}, files: {} };
  const sync = new VaultSync(vault, state, async () => {}, 'Distari');
  await sync.project(project, api());
  const counts = await sync.project(project, api('New overview'));
  assert.equal(counts.updated, 1);
  assert.match(vault.files.get(state.files['paper:7'].path)!, /New overview/);
});

void test('pages through more than 200 notes and rejects insecure API origins', async () => {
  const seen: number[] = [];
  const transport: ApiTransport = async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    seen.push(offset);
    const count = offset === 0 ? 200 : 5;
    return { status: 200, body: JSON.stringify(Array.from({ length: count }, (_, i) => ({ id: `${offset + i}` }))), headers: {} };
  };
  const client = new DistariApi('https://api.distari.com', 'pk_test', transport);
  assert.equal((await client.notes(project.id)).length, 205);
  assert.deepEqual(seen, [0, 200]);
  assert.throws(() => normalizeApiBase('http://example.com'));
  assert.equal(normalizeApiBase('http://localhost:4000/'), 'http://localhost:4000');
});


void test('syncs note images as portable binary assets and preserves local image edits', async () => {
  const id = '33333333-3333-4333-8333-333333333333';
  const imageNote = { ...note, body_md: `![Research figure](distari://note-asset/${id})\n[Paper](distari://paper/7) [Missing](distari://note/missing)\n[ref]: <distari://note/missing>` };
  const transport: ApiTransport = async (url): Promise<ApiResponse> => {
    if (url.includes('/note-assets/')) return { status: 200, body: '', bytes: Uint8Array.of(137, 80, 78, 71).buffer, headers: { 'content-type': 'image/png' } };
    return { status: 200, body: JSON.stringify(url.includes('/papers') ? { papers: [], pagination: { total_pages: 1 } } : [imageNote]), headers: {} };
  };
  const vault = new MemoryVault();
  const state: SyncState = { projectFolders: {}, files: {} };
  const sync = new VaultSync(vault, state, async () => {}, 'Distari');
  const client = new DistariApi('https://api.distari.com', 'pk_test', transport);
  await sync.project(project, client);
  const path = [...vault.binaries.keys()][0];
  assert.match([...vault.files.values()][0], new RegExp(`!\\[Research figure\\]\\(../Assets/${id}.png\\)`));
  assert.deepEqual(new Uint8Array(vault.binaries.get(path)!), Uint8Array.of(137, 80, 78, 71));
  vault.binaries.set(path, Uint8Array.of(1, 2).buffer);
  await sync.project(project, client);
  assert.deepEqual(new Uint8Array(vault.binaries.get(path)!), Uint8Array.of(1, 2));
  assert.equal(vault.binaries.size, 2);
  for (const text of vault.files.values()) {
    assert.doesNotMatch(text, /note-asset/);
    assert.match(text, /distari:\/\/note\/missing/);
  }
  assert.match(imageNote.body_md, /distari:\/\/note-asset\//);
});


void test('syncs current paper/note links and image together without changing source', async () => {
  const assetId = '33333333-3333-4333-8333-333333333333';
  const target = { ...note, id: '44444444-4444-4444-8444-444444444444', title: 'Related note', body_md: 'Target' };
  const source = { ...note, body_md: `[Paper](distari://paper/7) [Related](distari://note/${target.id})\n\n![Figure](distari://note-asset/${assetId})` };
  const transport: ApiTransport = async (url): Promise<ApiResponse> => {
    if (url.includes('/note-assets/')) return { status: 200, body: '', bytes: Uint8Array.of(137, 80, 78, 71).buffer, headers: { 'content-type': 'image/png' } };
    const path = new URL(url).pathname;
    const body = path.endsWith('/papers') ? { papers: [paper], pagination: { total_pages: 1 } }
      : path.endsWith('/summary') ? { overview: 'Overview', summarized_at: paper.updated_at } : [source, target];
    return { status: 200, body: JSON.stringify(body), headers: {} };
  };
  const original = source.body_md;
  const state: SyncState = { projectFolders: {}, files: {} };
  const vault = new MemoryVault();
  const sync = new VaultSync(vault, state, async () => {}, 'Distari');
  const client = new DistariApi('https://api.distari.com', 'pk_test', transport);
  assert.equal((await sync.project(project, client)).created, 3);
  const text = vault.files.get(state.files[`note:${source.id}`].path)!;
  assert.ok(text.includes(`[[${state.files['paper:7'].path.slice(0, -3)}|Paper]]`));
  assert.ok(text.includes(`[[${state.files[`note:${target.id}`].path.slice(0, -3)}|Related]]`));
  assert.ok(text.includes(`![Figure](../Assets/${assetId}.png)`));
  assert.deepEqual(new Uint8Array([...vault.binaries.values()][0]), Uint8Array.of(137, 80, 78, 71));
  assert.equal(source.body_md, original);
  assert.deepEqual(await sync.project(project, client), { created: 0, updated: 0, unchanged: 3, conflicts: 0 });
});
