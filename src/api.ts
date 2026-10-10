export interface DistariProject {
  id: string;
  name: string;
}

export interface DistariPaper {
  id: number;
  project_id: string;
  title: string;
  authors: Array<{ full_name: string }>;
  year: number | null;
  venue: { name: string } | null;
  doi: string | null;
  tags: Array<{ name: string | null }>;
  updated_at: string;
}

export interface DistariSummary {
  overview?: string | null;
  methodology?: string | null;
  key_findings?: string[];
  key_concepts?: string[];
  limitations?: string[];
  future_work?: string[];
  contributions?: string[];
  strengths?: string[];
  weaknesses?: string[];
  summarized_at?: string | null;
}

export interface DistariNote {
  id: string;
  project_id: string;
  file_id: number | null;
  title: string | null;
  body_md: string;
  citations?: Array<{ file_id: number }>;
  tags: string[];
  links: Array<{ kind: 'paper' | 'note'; id: string; title: string }>;
  updated_at: string;
  is_mine: boolean;
}

export interface ApiResponse {
  status: number;
  bytes?: ArrayBuffer;
  body: string;
  headers: Record<string, string>;
}

export type ApiTransport = (url: string, token: string) => Promise<ApiResponse>;

export function normalizeApiBase(value: string): string {
  const url = new URL(value.trim());
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use an HTTPS API origin, or HTTP on localhost for development.');
  }
  return url.origin;
}

export class DistariApi {
  private readonly base: string;
  private readonly token: string;
  private readonly transport: ApiTransport;

  constructor(
    base: string,
    token: string,
    transport: ApiTransport,
  ) {
    this.base = base;
    this.token = token;
    this.transport = transport;
  }

  private async get<T>(path: string, missingIsNull = false): Promise<T | null> {
    const response = await this.transport(`${this.base}/api/v1${path}`, this.token);
    if (missingIsNull && response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) {
      let message = `Distari API returned ${response.status}.`;
      try {
        const error = JSON.parse(response.body) as { error?: { message?: string } };
        if (error.error?.message) message = error.error.message;
      } catch { /* The response may not be JSON. */ }
      throw new Error(message);
    }
    return JSON.parse(response.body) as T;
  }

  async noteAsset(id: string): Promise<{ bytes: ArrayBuffer; extension: string }> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid note image id.');
    const response = await this.transport(`${this.base}/api/v1/note-assets/${id}`, this.token);
    const mime = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1]?.split(';')[0];
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' } as Record<string, string>)[mime ?? ''];
    if (response.status !== 200 || !response.bytes || !extension || response.bytes.byteLength < 1 || response.bytes.byteLength > 10 * 1024 * 1024) throw new Error('Note image could not be downloaded. Retry sync; the note has not been replaced.');
    return { bytes: response.bytes, extension };
  }

  async projects(): Promise<DistariProject[]> {
    return (await this.get<DistariProject[]>('/projects')) ?? [];
  }

  async papers(projectId: string): Promise<DistariPaper[]> {
    const papers: DistariPaper[] = [];
    for (let page = 1; ; page += 1) {
      const result = await this.get<{
        papers: DistariPaper[];
        pagination: { total_pages: number };
      }>(`/papers?project_id=${encodeURIComponent(projectId)}&page=${page}&page_size=100`);
      if (!result) throw new Error('Paper list was empty.');
      papers.push(...result.papers);
      if (page >= result.pagination.total_pages || result.papers.length === 0) break;
    }
    return papers;
  }

  async summary(paperId: number): Promise<DistariSummary | null> {
    return this.get<DistariSummary>(`/papers/${paperId}/summary`, true);
  }

  async notes(projectId: string): Promise<DistariNote[]> {
    const notes: DistariNote[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await this.get<DistariNote[]>(
        `/projects/${encodeURIComponent(projectId)}/notes?limit=200&offset=${offset}`,
      );
      if (!page) throw new Error('Note list was empty.');
      notes.push(...page);
      if (page.length < 200) break;
    }
    return notes;
  }
}
