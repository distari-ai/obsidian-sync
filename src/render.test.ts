import assert from 'node:assert/strict';
import test from 'node:test';
import type { DistariNote, DistariPaper } from './api.ts';
import { renderNote, renderPaper, safeName } from './render.ts';

const paper: DistariPaper = {
  id: 7, project_id: 'research', title: 'A "quoted": study',
  authors: [{ full_name: 'Ada Lovelace' }, { full_name: '李' }, { full_name: '' }],
  year: 2026, venue: { name: 'Journal: Science' }, doi: '10.1000/example',
  tags: [{ name: 'methods' }, { name: 'line\nbreak' }, { name: null }],
  updated_at: '2026-01-01T00:00:00Z',
};
const note: DistariNote = {
  id: 'n1', project_id: 'research', file_id: 7, title: 'Reading | note]',
  body_md: '', tags: [], links: [], is_mine: true, updated_at: '2026-03-01T00:00:00Z',
};
const path = 'Research/Papers/Study.md';
const site = 'https://distari.com';

void test('renders an exact, stable paper with every bibliographic and summary field', () => {
  const summary = {
    overview: ' Overview. ', methodology: 'Method.', key_findings: ['Finding one', '', 'Finding two'],
    key_concepts: ['Concept'], contributions: ['Contribution'], strengths: ['Strength'],
    weaknesses: ['Weakness'], limitations: ['Limitation'], future_work: ['Future'],
    summarized_at: '2026-02-01T00:00:00Z',
  };
  const linked = { ...note, id: 'n2', file_id: null, links: [{ kind: 'paper' as const, id: '7', title: 'Study' }], updated_at: paper.updated_at };
  const cited = { ...note, id: 'n3', file_id: null, citations: [{ file_id: 7 }], title: null, updated_at: paper.updated_at };
  const unrelated = { ...note, id: 'n4', file_id: 99, updated_at: '2027-01-01T00:00:00Z' };
  const notes = [note, linked, cited, unrelated];
  const paths = new Map([['n1', 'Research/Notes/Reading.md'], ['n2', 'Research/Notes/Linked.md'], ['n3', 'Research/Notes/Cited.md']]);
  const expected = `---
title: "A \\"quoted\\": study"
authors:
  - "Ada Lovelace"
  - "李"
year: 2026
venue: "Journal: Science"
doi: "10.1000/example"
tags:
  - "methods"
  - "line\\nbreak"
distari: "https://distari.com/workspace/research/library?paper=7"
distari_id: 7
---
# A "quoted": study

## Overview

Overview.

## Methodology

Method.

## Key findings

- Finding one
- Finding two

## Key concepts

- Concept

## Contributions

- Contribution

## Strengths

- Strength

## Weaknesses

- Weakness

## Limitations

- Limitation

## Future work

- Future

## My notes

- [[Research/Notes/Reading|Reading  note]]
- [[Research/Notes/Linked|Reading  note]]
- [[Research/Notes/Cited|Untitled note]]

`;
  const rendered = renderPaper(paper, summary, notes, path, paths, site);
  assert.deepEqual(rendered, { key: 'paper:7', path, sourceUpdatedAt: note.updated_at, content: expected });
  assert.deepEqual(renderPaper(paper, summary, notes, path, paths, site), rendered);
  assert.equal(renderPaper(paper, summary, [], path, paths, site).sourceUpdatedAt, summary.summarized_at);
});

void test('renders explicit empty metadata and the unavailable-summary message', () => {
  const sparse = { ...paper, title: 'Untitled paper', authors: [], year: null, venue: null, doi: null, tags: [] };
  assert.deepEqual(renderPaper(sparse, null, [], path, new Map(), site), {
    key: 'paper:7', path, sourceUpdatedAt: paper.updated_at,
    content: `---
title: "Untitled paper"
authors: []
year: null
venue: null
doi: null
tags: []
distari: "https://distari.com/workspace/research/library?paper=7"
distari_id: 7
---
# Untitled paper

Summary is not available yet.

`,
  });
});

void test('omits empty summary sections and keeps the newest paper timestamp', () => {
  const result = renderPaper(paper, { overview: '  ', methodology: null, key_findings: ['', ''], summarized_at: '2025-01-01T00:00:00Z' }, [], path, new Map(), site);
  assert.equal(result.sourceUpdatedAt, paper.updated_at);
  assert.equal(result.content.slice(result.content.indexOf('# A')), '# A "quoted": study\n\n');
});

void test('renders note links, missing targets, citations and fallback title without duplicate paper links', () => {
  const result = renderNote({ ...note, id: 'n/1', title: ' ', tags: ['read'],
    body_md: ' See [[paper:7|the study]] and [[note:n2|next]]. [[paper:99|missing]] [[note:gone]] ',
    links: [{ kind: 'paper', id: '7', title: 'Study' }], citations: [{ file_id: 7 }, { file_id: 99 }],
  }, 'Research/Notes/Untitled.md', new Map([[7, path]]), new Map([['n2', 'Research/Notes/Next.md']]), site);
  assert.deepEqual(result, {
    key: 'note:n/1', path: 'Research/Notes/Untitled.md', sourceUpdatedAt: note.updated_at,
    content: `---
title: "Untitled note"
tags:
  - "read"
distari: "https://distari.com/workspace/research/library?note=n%2F1"
distari_id: "n/1"
---
# Untitled note

See [[Research/Papers/Study|the study]] and [[Research/Notes/Next|next]]. missing gone

## Papers

- [[Research/Papers/Study]]
`,
  });
});

void test('safe file names strip vault-reserved characters and truncate at Unicode character boundaries', () => {
  assert.equal(safeName('.. A / study: [draft] #^ ..'), ' A - study- -draft- -- ');
  assert.equal(safeName('...'), 'Untitled');
  assert.equal(safeName('😀'.repeat(101)), '😀'.repeat(100));
});
