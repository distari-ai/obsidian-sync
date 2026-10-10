import assert from 'node:assert/strict';
import test from 'node:test';
import { DistariApi, normalizeApiBase, type ApiResponse } from './api.ts';

const base = 'https://api.distari.com';
const token = 'synthetic-token';
function response(body: unknown, status = 200): ApiResponse {
  return { status, body: JSON.stringify(body), headers: {} };
}
function fixture(responses: ApiResponse[]) {
  const calls: string[] = [];
  const api = new DistariApi(base, token, async (url, secret) => {
    assert.equal(secret, token);
    calls.push(url);
    const next = responses.shift();
    assert.ok(next, `Unexpected API call: ${url}`);
    return next;
  });
  return { api, calls };
}

for (const status of [401, 403, 429]) {
  void test(`stops on ${status}, surfaces the API error and makes no automatic retry`, async () => {
    const message = status === 429 ? 'Rate limit exceeded. Retry later.' : 'Invalid or unauthorized token.';
    const { api, calls } = fixture([response({ error: { code: 'refused', message } }, status)]);
    await assert.rejects(api.projects(), { message });
    assert.deepEqual(calls, [`${base}/api/v1/projects`]);
  });
}

void test('uses a status fallback for non-JSON and message-less errors', async () => {
  for (const body of ['upstream unavailable', '{}']) {
    const { api } = fixture([{ status: 503, body, headers: {} }]);
    await assert.rejects(api.projects(), { message: 'Distari API returned 503.' });
  }
});

void test('reads projects and summaries; only a missing summary becomes null', async () => {
  const projects = [{ id: 'p1', name: 'Research' }];
  const summary = { overview: 'Result', summarized_at: '2026-01-01' };
  const { api, calls } = fixture([response(projects), response(summary), response({}, 404), response({}, 404)]);
  assert.deepEqual(await api.projects(), projects);
  assert.deepEqual(await api.summary(7), summary);
  assert.equal(await api.summary(8), null);
  await assert.rejects(api.projects(), /404/);
  assert.deepEqual(calls, ['/projects', '/papers/7/summary', '/papers/8/summary', '/projects'].map((path) => `${base}/api/v1${path}`));
});

void test('paper pagination encodes the project, preserves page order and stops at total_pages', async () => {
  const { api, calls } = fixture([1, 2, 3].map((id) => response({ papers: [{ id }], pagination: { total_pages: 3 } })));
  assert.deepEqual(await api.papers('p /?&'), [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(calls, [1, 2, 3].map((page) => `${base}/api/v1/papers?project_id=p%20%2F%3F%26&page=${page}&page_size=100`));
});

void test('an empty paper page terminates even when the server reports more pages', async () => {
  const { api, calls } = fixture([response({ papers: [], pagination: { total_pages: 10 } })]);
  assert.deepEqual(await api.papers('p1'), []);
  assert.equal(calls.length, 1);
});

for (const finalCount of [0, 3]) {
  void test(`notes pagination reads full pages and terminates on a ${finalCount}-note page`, async () => {
    const pages = [200, 200, finalCount].map((count, page) => Array.from({ length: count }, (_, i) => ({ id: String(page * 200 + i) })));
    const { api, calls } = fixture(pages.map((page) => response(page)));
    assert.deepEqual(await api.notes('p /?&'), pages.flat());
    assert.deepEqual(calls, [0, 200, 400].map((offset) => `${base}/api/v1/projects/p%20%2F%3F%26/notes?limit=200&offset=${offset}`));
  });
}

void test('a later pagination failure rejects instead of returning an incomplete import', async () => {
  const papers = fixture([response({ papers: [{ id: 7 }], pagination: { total_pages: 2 } }), response({ error: { message: 'Slow down' } }, 429)]);
  await assert.rejects(papers.api.papers('p1'), /Slow down/);
  assert.equal(papers.calls.length, 2);
  const notes = fixture([response(Array.from({ length: 200 }, (_, id) => ({ id }))), response({}, 401)]);
  await assert.rejects(notes.api.notes('p1'), /401/);
  assert.equal(notes.calls.length, 2);
});

void test('propagates transport failures and malformed successful JSON', async () => {
  const api = new DistariApi(base, token, async () => { throw new Error('Offline'); });
  await assert.rejects(api.projects(), /Offline/);
  await assert.rejects(fixture([{ status: 200, body: 'not JSON', headers: {} }]).api.projects(), SyntaxError);
});

void test('normalizes secure origins and accepts HTTP only for loopback development', () => {
  for (const origin of ['https://api.distari.com', 'http://localhost:4000', 'http://127.0.0.1:4000', 'http://[::1]:4000']) {
    assert.equal(normalizeApiBase(` ${origin}/ `), origin);
  }
  for (const origin of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/api', 'https://example.com?key=test', 'https://example.com#fragment', 'ftp://localhost', 'invalid']) {
    assert.throws(() => normalizeApiBase(origin));
  }
});

void test('note assets validate IDs, MIME type, status and byte limits before returning bytes', async () => {
  const id = '33333333-3333-4333-8333-333333333333';
  for (const [mime, extension] of [['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/gif', 'gif']]) {
    const bytes = Uint8Array.of(1, 2, 3).buffer;
    const { api, calls } = fixture([{ status: 200, body: '', bytes, headers: { 'Content-Type': `${mime}; charset=binary` } }]);
    assert.deepEqual(await api.noteAsset(id), { bytes, extension });
    assert.deepEqual(calls, [`${base}/api/v1/note-assets/${id}`]);
  }
  const invalid = fixture([]);
  await assert.rejects(invalid.api.noteAsset('../private'), /Invalid note image id/);
  assert.equal(invalid.calls.length, 0);
  for (const result of [
    { status: 401, bytes: Uint8Array.of(1).buffer },
    { status: 200, bytes: undefined },
    { status: 200, bytes: new ArrayBuffer(0) },
    { status: 200, bytes: new ArrayBuffer(10 * 1024 * 1024 + 1) },
  ]) {
    await assert.rejects(fixture([{ ...result, body: '', headers: { 'content-type': 'image/png' } }]).api.noteAsset(id), /could not be downloaded/);
  }
  await assert.rejects(fixture([{ status: 200, body: '', bytes: Uint8Array.of(1).buffer, headers: { 'content-type': 'text/html' } }]).api.noteAsset(id), /could not be downloaded/);
});
