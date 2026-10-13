import type { DistariNote, DistariPaper, DistariSummary } from './api.ts';

export type ExportedItem = {
  key: string;
  path: string;
  sourceUpdatedAt: string;
  content: string;
};

export function safeName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|[\]#^]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '');
  return Array.from(cleaned || 'Untitled').slice(0, 100).join('');
}

function yaml(value: string): string {
  return JSON.stringify(value);
}

function yamlList(values: string[]): string {
  return values.length ? `\n${values.map((value) => `  - ${yaml(value)}`).join('\n')}` : ' []';
}

function newer(a: string, b?: string | null): string {
  return b && Date.parse(b) > Date.parse(a) ? b : a;
}

function wikilink(path: string, label?: string): string {
  const target = path.replace(/\.md$/, '');
  const cleanLabel = (label ?? '').replace(/[\]|]/g, '').trim();
  return `[[${target}${cleanLabel ? `|${cleanLabel}` : ''}]]`;
}

function section(title: string, content: string | string[] | null | undefined): string {
  const text = Array.isArray(content) ? content.filter(Boolean).map((line) => `- ${line}`).join('\n') : content?.trim();
  return text ? `## ${title}\n\n${text}\n\n` : '';
}

export function renderPaper(
  paper: DistariPaper,
  summary: DistariSummary | null,
  notes: DistariNote[],
  path: string,
  notePaths: Map<string, string>,
  siteUrl: string,
): ExportedItem {
  const related = notes.filter((note) => note.file_id === paper.id ||
    note.links.some((link) => link.kind === 'paper' && link.id === String(paper.id)) ||
    (note.citations ?? []).some((citation) => citation.file_id === paper.id));
  let updatedAt = newer(paper.updated_at, summary?.summarized_at);
  for (const note of related) updatedAt = newer(updatedAt, note.updated_at);
  const authors = (paper.authors ?? []).map((author) => author.full_name).filter(Boolean);
  const tags = (paper.tags ?? []).map((tag) => tag.name).filter((name): name is string => Boolean(name));
  const link = `${siteUrl}/workspace/${paper.project_id}/library?paper=${paper.id}`;
  const front = [
    '---',
    `title: ${yaml(paper.title)}`,
    `authors:${yamlList(authors)}`,
    `year: ${paper.year ?? 'null'}`,
    `venue: ${paper.venue?.name ? yaml(paper.venue.name) : 'null'}`,
    `doi: ${paper.doi ? yaml(paper.doi) : 'null'}`,
    `tags:${yamlList(tags)}`,
    `distari: ${yaml(link)}`,
    `distari_id: ${paper.id}`,
    '---',
    '',
  ].join('\n');
  let body = `# ${paper.title}\n\n`;
  body += section('Overview', summary?.overview);
  body += section('Methodology', summary?.methodology);
  body += section('Key findings', summary?.key_findings);
  body += section('Key concepts', summary?.key_concepts);
  body += section('Contributions', summary?.contributions);
  body += section('Strengths', summary?.strengths);
  body += section('Weaknesses', summary?.weaknesses);
  body += section('Limitations', summary?.limitations);
  body += section('Future work', summary?.future_work);
  if (!summary) body += 'Summary is not available yet.\n\n';
  if (related.length) {
    body += `## My notes\n\n${related.map((note) => `- ${wikilink(notePaths.get(note.id)!, note.title ?? 'Untitled note')}`).join('\n')}\n\n`;
  }
  return { key: `paper:${paper.id}`, path, sourceUpdatedAt: updatedAt, content: front + body };
}

export function renderNote(
  note: DistariNote,
  path: string,
  paperPaths: Map<number, string>,
  notePaths: Map<string, string>,
  siteUrl: string,
): ExportedItem {
  const title = note.title?.trim() || 'Untitled note';
  const source = `${siteUrl}/workspace/${note.project_id}/library?note=${encodeURIComponent(note.id)}`;
  const linkedPapers = new Set<number>();
  if (note.file_id != null) linkedPapers.add(note.file_id);
  for (const link of note.links) {
    if (link.kind === 'paper') linkedPapers.add(Number(link.id));
  }
  for (const citation of note.citations ?? []) linkedPapers.add(citation.file_id);
  const front = [
    '---',
    `title: ${yaml(title)}`,
    `tags:${yamlList(note.tags ?? [])}`,
    `distari: ${yaml(source)}`,
    `distari_id: ${yaml(note.id)}`,
    '---',
    '',
  ].join('\n');
  const body = note.body_md.replace(/\[\[(paper|note):([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_whole, kind: string, id: string, label?: string) => {
    const target = kind === 'paper' ? paperPaths.get(Number(id)) : notePaths.get(id);
    return target ? wikilink(target, label) : (label || id);
  }).replace(/(?<!!)\[([^\]]+)\]\(distari:\/\/(paper|note)\/([^\s)]+)\)/gi, (_whole, label: string, kind: string, id: string) => {
    const target = kind.toLowerCase() === 'paper' ? paperPaths.get(Number(id)) : notePaths.get(id);
    return target ? wikilink(target, label) : `[${label}](distari://${kind.toLowerCase()}/${id})`;
  }).trim();
  const paperLinks = [...linkedPapers].map((id) => paperPaths.get(id)).filter((item): item is string => Boolean(item));
  return {
    key: `note:${note.id}`,
    path,
    sourceUpdatedAt: note.updated_at,
    content: `${front}# ${title}\n\n${body}${body ? '\n\n' : ''}${paperLinks.length ? `## Papers\n\n${paperLinks.map((paper) => `- ${wikilink(paper)}`).join('\n')}\n` : ''}`,
  };
}
