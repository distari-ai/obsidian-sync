"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DistariPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/api.ts
function normalizeApiBase(value) {
  const url = new URL(value.trim());
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use an HTTPS API origin, or HTTP on localhost for development.");
  }
  return url.origin;
}
var DistariApi = class {
  base;
  token;
  transport;
  constructor(base, token, transport2) {
    this.base = base;
    this.token = token;
    this.transport = transport2;
  }
  async get(path, missingIsNull = false) {
    const response = await this.transport(`${this.base}/api/v1${path}`, this.token);
    if (missingIsNull && response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) {
      let message = `Distari API returned ${response.status}.`;
      try {
        const error = JSON.parse(response.body);
        if (error.error?.message) message = error.error.message;
      } catch {
      }
      throw new Error(message);
    }
    return JSON.parse(response.body);
  }
  async noteAsset(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid note image id.");
    const response = await this.transport(`${this.base}/api/v1/note-assets/${id}`, this.token);
    const mime = Object.entries(response.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1]?.split(";")[0];
    const extension = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" }[mime ?? ""];
    if (response.status !== 200 || !response.bytes || !extension || response.bytes.byteLength < 1 || response.bytes.byteLength > 10 * 1024 * 1024) throw new Error("Note image could not be downloaded. Retry sync; the note has not been replaced.");
    return { bytes: response.bytes, extension };
  }
  async projects() {
    return await this.get("/projects") ?? [];
  }
  async papers(projectId) {
    const papers = [];
    for (let page = 1; ; page += 1) {
      const result = await this.get(`/papers?project_id=${encodeURIComponent(projectId)}&page=${page}&page_size=100`);
      if (!result) throw new Error("Paper list was empty.");
      papers.push(...result.papers);
      if (page >= result.pagination.total_pages || result.papers.length === 0) break;
    }
    return papers;
  }
  async summary(paperId) {
    return this.get(`/papers/${paperId}/summary`, true);
  }
  async notes(projectId) {
    const notes = [];
    for (let offset = 0; ; offset += 200) {
      const page = await this.get(
        `/projects/${encodeURIComponent(projectId)}/notes?limit=200&offset=${offset}`
      );
      if (!page) throw new Error("Note list was empty.");
      notes.push(...page);
      if (page.length < 200) break;
    }
    return notes;
  }
};

// node_modules/@noble/hashes/_u64.js
var fromNumH = (n) => n / 2 ** 32 | 0;
var fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE ? l : h, isLE);
  view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
}

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle = (title) => title ? `"${title}" ` : "";
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
var aobject = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
var aopts = (value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
};
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    let processed = false;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        processed = true;
        continue;
      }
      buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
        processed = true;
      }
    }
    this.length += data.length;
    if (processed)
      this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    buffer.fill(0, pos);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      buffer.fill(0);
    }
    setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
    this.process(view, 0);
    this.roundClean();
    const oview = out === buffer ? view : createView(out);
    const len = this.outputLen;
    const outLen = len / 4;
    const state = this.get();
    if (len % 4 || outLen > state.length)
      throw new Error("invalid outputLen");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneIntoMeta(to) {
    const { buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (pos)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  // Numeric initializers matter: starting the fields as `undefined` changes
  // V8's field representation and makes sha256 3x slower (measured).
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(outputLen, IV) {
    super(64, outputLen, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  constructor() {
    super(32, SHA256_IV);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// src/render.ts
function safeName(value) {
  const cleaned = value.replace(/[\\/:*?"<>|[\]#^]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "");
  return Array.from(cleaned || "Untitled").slice(0, 100).join("");
}
function yaml(value) {
  return JSON.stringify(value);
}
function yamlList(values) {
  return values.length ? `
${values.map((value) => `  - ${yaml(value)}`).join("\n")}` : " []";
}
function newer(a, b) {
  return b && Date.parse(b) > Date.parse(a) ? b : a;
}
function wikilink(path, label) {
  const target = path.replace(/\.md$/, "");
  const cleanLabel = (label ?? "").replace(/[\]|]/g, "").trim();
  return `[[${target}${cleanLabel ? `|${cleanLabel}` : ""}]]`;
}
function section(title, content) {
  const text = Array.isArray(content) ? content.filter(Boolean).map((line) => `- ${line}`).join("\n") : content?.trim();
  return text ? `## ${title}

${text}

` : "";
}
function renderPaper(paper, summary, notes, path, notePaths, siteUrl) {
  const related = notes.filter((note) => note.file_id === paper.id || note.links.some((link2) => link2.kind === "paper" && link2.id === String(paper.id)) || (note.citations ?? []).some((citation) => citation.file_id === paper.id));
  let updatedAt = newer(paper.updated_at, summary?.summarized_at);
  for (const note of related) updatedAt = newer(updatedAt, note.updated_at);
  const authors = (paper.authors ?? []).map((author) => author.full_name).filter(Boolean);
  const tags = (paper.tags ?? []).map((tag) => tag.name).filter((name) => Boolean(name));
  const link = `${siteUrl}/workspace/${paper.project_id}/library?paper=${paper.id}`;
  const front = [
    "---",
    `title: ${yaml(paper.title)}`,
    `authors:${yamlList(authors)}`,
    `year: ${paper.year ?? "null"}`,
    `venue: ${paper.venue?.name ? yaml(paper.venue.name) : "null"}`,
    `doi: ${paper.doi ? yaml(paper.doi) : "null"}`,
    `tags:${yamlList(tags)}`,
    `distari: ${yaml(link)}`,
    `distari_id: ${paper.id}`,
    "---",
    ""
  ].join("\n");
  let body = `# ${paper.title}

`;
  body += section("Overview", summary?.overview);
  body += section("Methodology", summary?.methodology);
  body += section("Key findings", summary?.key_findings);
  body += section("Key concepts", summary?.key_concepts);
  body += section("Contributions", summary?.contributions);
  body += section("Strengths", summary?.strengths);
  body += section("Weaknesses", summary?.weaknesses);
  body += section("Limitations", summary?.limitations);
  body += section("Future work", summary?.future_work);
  if (!summary) body += "Summary is not available yet.\n\n";
  if (related.length) {
    body += `## My notes

${related.map((note) => `- ${wikilink(notePaths.get(note.id), note.title ?? "Untitled note")}`).join("\n")}

`;
  }
  return { key: `paper:${paper.id}`, path, sourceUpdatedAt: updatedAt, content: front + body };
}
function renderNote(note, path, paperPaths, notePaths, siteUrl) {
  const title = note.title?.trim() || "Untitled note";
  const source = `${siteUrl}/workspace/${note.project_id}/library?note=${encodeURIComponent(note.id)}`;
  const linkedPapers = /* @__PURE__ */ new Set();
  if (note.file_id != null) linkedPapers.add(note.file_id);
  for (const link of note.links) {
    if (link.kind === "paper") linkedPapers.add(Number(link.id));
  }
  for (const citation of note.citations ?? []) linkedPapers.add(citation.file_id);
  const front = [
    "---",
    `title: ${yaml(title)}`,
    `tags:${yamlList(note.tags ?? [])}`,
    `distari: ${yaml(source)}`,
    `distari_id: ${yaml(note.id)}`,
    "---",
    ""
  ].join("\n");
  const body = note.body_md.replace(/\[\[(paper|note):([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_whole, kind, id, label) => {
    const target = kind === "paper" ? paperPaths.get(Number(id)) : notePaths.get(id);
    return target ? wikilink(target, label) : label || id;
  }).replace(/(?<!!)\[([^\]]+)\]\(distari:\/\/(paper|note)\/([^\s)]+)\)/gi, (_whole, label, kind, id) => {
    const target = kind.toLowerCase() === "paper" ? paperPaths.get(Number(id)) : notePaths.get(id);
    return target ? wikilink(target, label) : `[${label}](distari://${kind.toLowerCase()}/${id})`;
  }).trim();
  const paperLinks = [...linkedPapers].map((id) => paperPaths.get(id)).filter((item) => Boolean(item));
  return {
    key: `note:${note.id}`,
    path,
    sourceUpdatedAt: note.updated_at,
    content: `${front}# ${title}

${body}${body ? "\n\n" : ""}${paperLinks.length ? `## Papers

${paperLinks.map((paper) => `- ${wikilink(paper)}`).join("\n")}
` : ""}`
  };
}

// src/sync.ts
function digest(content) {
  return bytesToHex(sha256(new TextEncoder().encode(content)));
}
function newPath(folder, kind, title, id) {
  return `${folder}/${kind}/${safeName(title)} [${id}].md`;
}
async function mapLimit(values, limit, fn) {
  const result = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (; ; ) {
      const index = cursor++;
      if (index >= values.length) return;
      result[index] = await fn(values[index]);
    }
  }));
  return result;
}
var VaultSync = class {
  vault;
  state;
  persist;
  rootFolder;
  siteUrl;
  constructor(vault, state, persist, rootFolder, siteUrl = "https://distari.com") {
    this.vault = vault;
    this.state = state;
    this.persist = persist;
    this.rootFolder = rootFolder;
    this.siteUrl = siteUrl;
  }
  async project(project, api) {
    const [papers, allNotes] = await Promise.all([api.papers(project.id), api.notes(project.id)]);
    const notes = allNotes.filter((note) => note.is_mine);
    const folder = this.state.projectFolders[project.id] ?? `${this.rootFolder}/${safeName(project.name)} [${project.id}]`;
    this.state.projectFolders[project.id] = folder;
    await this.persist();
    const paperPaths = /* @__PURE__ */ new Map();
    for (const paper of papers) {
      paperPaths.set(paper.id, this.state.files[`paper:${paper.id}`]?.path ?? await this.uniquePath(newPath(folder, "Papers", paper.title, String(paper.id))));
    }
    const notePaths = /* @__PURE__ */ new Map();
    for (const note of notes) {
      notePaths.set(note.id, this.state.files[`note:${note.id}`]?.path ?? await this.uniquePath(newPath(folder, "Notes", note.title ?? "Untitled note", note.id)));
    }
    const summaries = await mapLimit(papers, 4, (paper) => api.summary(paper.id));
    const items = papers.map((paper, index) => renderPaper(
      paper,
      summaries[index],
      notes,
      paperPaths.get(paper.id),
      notePaths,
      this.siteUrl
    ));
    for (const original of notes) {
      const note = { ...original };
      const ids = [...new Set([...note.body_md.matchAll(/distari:\/\/note-asset\/([0-9a-f-]{36})/g)].map((match) => match[1]))];
      for (const id of ids) {
        const asset = await api.noteAsset(id);
        await this.vault.ensureFolder(`${folder}/Assets`);
        let name = `${id}.${asset.extension}`;
        let existing = await this.vault.readBinary(`${folder}/Assets/${name}`);
        const hash = bytesToHex(sha256(new Uint8Array(asset.bytes)));
        if (existing && bytesToHex(sha256(new Uint8Array(existing))) !== hash) {
          name = `${id}-${hash}.${asset.extension}`;
          existing = await this.vault.readBinary(`${folder}/Assets/${name}`);
          if (existing && bytesToHex(sha256(new Uint8Array(existing))) !== hash) throw new Error("A note image path was changed locally. Preserve it and retry sync.");
        }
        if (!existing) await this.vault.createBinary(`${folder}/Assets/${name}`, asset.bytes);
        note.body_md = note.body_md.replaceAll(`distari://note-asset/${id}`, `../Assets/${name}`);
      }
      items.push(renderNote(note, notePaths.get(note.id), paperPaths, notePaths, this.siteUrl));
    }
    const counts = { created: 0, updated: 0, unchanged: 0, conflicts: 0 };
    for (const item of items) counts[await this.write(item)] += 1;
    return counts;
  }
  async uniquePath(path) {
    if (await this.vault.read(path) === null) return path;
    const stem = path.slice(0, -3);
    for (let number = 2; ; number += 1) {
      const candidate = `${stem} (Distari ${number}).md`;
      if (await this.vault.read(candidate) === null) return candidate;
    }
  }
  async conflict(item, hash, existing) {
    if (existing.pendingHash === hash) return "unchanged";
    const stem = existing.path.slice(0, -3);
    const path = await this.uniquePath(`${stem} (Distari conflict ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}).md`);
    await this.vault.ensureFolder(path.slice(0, path.lastIndexOf("/")));
    await this.vault.create(path, item.content);
    existing.pendingHash = hash;
    await this.persist();
    return "conflicts";
  }
  async write(item) {
    const hash = digest(item.content);
    const known = this.state.files[item.key];
    if (known && known.sourceUpdatedAt === item.sourceUpdatedAt && known.baseHash === hash) {
      return "unchanged";
    }
    if (!known) {
      const path = await this.uniquePath(item.path);
      await this.vault.ensureFolder(path.slice(0, path.lastIndexOf("/")));
      await this.vault.create(path, item.content);
      this.state.files[item.key] = { path, baseHash: hash, sourceUpdatedAt: item.sourceUpdatedAt };
      await this.persist();
      return "created";
    }
    const current = await this.vault.read(known.path);
    if (current === null) {
      return hash !== known.baseHash ? this.conflict(item, hash, known) : "unchanged";
    }
    const currentHash = digest(current);
    if (currentHash === hash) {
      known.baseHash = hash;
      known.sourceUpdatedAt = item.sourceUpdatedAt;
      delete known.pendingHash;
      await this.persist();
      return "unchanged";
    }
    if (currentHash !== known.baseHash) {
      return hash !== known.baseHash ? this.conflict(item, hash, known) : "unchanged";
    }
    if (hash === known.baseHash) return "unchanged";
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
    return "updated";
  }
};

// src/main.ts
var DEFAULT_DATA = {
  apiUrl: "https://api.distari.com",
  secretName: "",
  rootFolder: "Distari",
  selectedProjectIds: [],
  intervalMinutes: 30,
  sync: { projectFolders: {}, files: {} }
};
function validateFolder(value) {
  const path = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Choose a folder inside this vault, such as Distari or Research/Distari.");
  }
  return path;
}
var ObsidianVault = class {
  constructor(app) {
    this.app = app;
  }
  app;
  async readBinary(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!(file instanceof import_obsidian.TFile)) throw new Error(`${path} is a folder, not an image.`);
    return this.app.vault.readBinary(file);
  }
  async createBinary(path, bytes) {
    await this.app.vault.createBinary(path, bytes);
  }
  async read(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!(file instanceof import_obsidian.TFile)) throw new Error(`${path} is a folder, not a Markdown file.`);
    return this.app.vault.read(file);
  }
  async create(path, content) {
    await this.app.vault.create(path, content);
  }
  async process(path, update) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) throw new Error(`${path} is no longer a Markdown file.`);
    await this.app.vault.process(file, update);
  }
  async ensureFolder(path) {
    let current = "";
    for (const part of path.split("/")) {
      current = current ? `${current}/${part}` : part;
      const found = this.app.vault.getAbstractFileByPath(current);
      if (!found) await this.app.vault.createFolder(current);
      else if (!(found instanceof import_obsidian.TFolder)) throw new Error(`${current} is a file, not a folder.`);
    }
  }
};
var transport = async (url, token) => {
  const response = await (0, import_obsidian.requestUrl)({
    url,
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Accept-Encoding": "gzip" },
    throw: false
  });
  return { status: response.status, body: response.text, bytes: response.arrayBuffer, headers: response.headers };
};
var DistariPlugin = class extends import_obsidian.Plugin {
  data = structuredClone(DEFAULT_DATA);
  timer;
  running = false;
  async onload() {
    const stored = await this.loadData();
    this.data = {
      ...structuredClone(DEFAULT_DATA),
      ...stored,
      sync: {
        projectFolders: stored?.sync?.projectFolders ?? {},
        files: stored?.sync?.files ?? {}
      }
    };
    this.addCommand({ id: "import-from-distari", name: "Import from Distari", callback: () => void this.syncNow() });
    this.addRibbonIcon("download", "Import from Distari", () => void this.syncNow());
    this.registerEvent(this.app.workspace.on("file-menu", (menu) => {
      menu.addItem((item) => item.setTitle("Import from Distari").setIcon("download").onClick(() => void this.syncNow()));
    }));
    this.addSettingTab(new DistariSettings(this.app, this));
    this.resetTimer();
    this.app.workspace.onLayoutReady(() => {
      if (this.data.selectedProjectIds.length) void this.syncNow(true);
    });
  }
  onunload() {
    if (this.timer !== void 0) window.clearInterval(this.timer);
  }
  async save() {
    await this.saveData(this.data);
  }
  api() {
    const token = this.data.secretName && this.app.secretStorage.getSecret(this.data.secretName);
    if (!token) throw new Error("Choose a personal access token in Distari sync settings.");
    return new DistariApi(normalizeApiBase(this.data.apiUrl), token, transport);
  }
  resetTimer() {
    if (this.timer !== void 0) window.clearInterval(this.timer);
    this.timer = void 0;
    if (this.data.intervalMinutes > 0) {
      this.timer = window.setInterval(() => void this.syncNow(true), this.data.intervalMinutes * 6e4);
    }
  }
  async syncNow(quiet = false) {
    if (this.running) return;
    if (!this.data.selectedProjectIds.length) {
      if (!quiet) new import_obsidian.Notice("Choose at least one Distari project in plugin settings.");
      return;
    }
    this.running = true;
    try {
      const api = this.api();
      const root = validateFolder(this.data.rootFolder);
      const projects = await api.projects();
      const selected = projects.filter((project) => this.data.selectedProjectIds.includes(project.id));
      if (selected.length !== this.data.selectedProjectIds.length) {
        throw new Error("A selected project is unavailable. Refresh the project list in settings.");
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
        new import_obsidian.Notice(`Distari import: ${created} new, ${updated} updated, ${conflicts} conflict${conflicts === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      new import_obsidian.Notice(`Distari import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
};
var DistariSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  projectList = { state: "idle" };
  getSettingDefinitions() {
    return [
      { name: "Distari API", desc: "Use the hosted API, or a local development server.", render: (setting) => {
        setting.addText((field) => field.setValue(this.plugin.data.apiUrl).onChange(async (value) => {
          this.plugin.data.apiUrl = value.trim();
          await this.plugin.save();
        }));
      } },
      {
        name: "Personal access token",
        desc: "Create a read-only token in Distari Account settings, then link it through Obsidian Keychain.",
        render: (setting) => {
          setting.addComponent((el) => new import_obsidian.SecretComponent(this.app, el).setValue(this.plugin.data.secretName).onChange(async (name) => {
            this.plugin.data.secretName = name;
            await this.plugin.save();
            this.reloadProjects();
          }));
        }
      },
      { name: "Vault folder", desc: "Projects are saved in separate folders beneath this folder.", render: (setting) => {
        setting.addText((field) => field.setValue(this.plugin.data.rootFolder).onChange(async (value) => {
          this.plugin.data.rootFolder = value;
          await this.plugin.save();
        }));
      } },
      { name: "Automatic import", desc: "Refresh selected projects while Obsidian is open.", render: (setting) => {
        setting.addDropdown((dropdown) => dropdown.addOption("0", "Off").addOption("15", "Every 15 minutes").addOption("30", "Every 30 minutes").addOption("60", "Every hour").setValue(String(this.plugin.data.intervalMinutes)).onChange(async (value) => {
          this.plugin.data.intervalMinutes = Number(value);
          await this.plugin.save();
          this.plugin.resetTimer();
        }));
      } },
      { name: "Projects", desc: "Only selected projects are imported.", render: (setting) => {
        setting.addButton((button) => button.setButtonText("Refresh list").onClick(() => this.reloadProjects()));
        if (this.projectList.state === "idle") void this.loadProjects();
      } },
      ...this.projectRows(),
      { name: "Import now", render: (setting) => {
        setting.addButton((button) => button.setButtonText("Import from Distari").setCta().onClick(() => void this.plugin.syncNow()));
      } }
    ];
  }
  hide() {
    this.projectList = { state: "idle" };
    super.hide();
  }
  projectRows() {
    const list = this.projectList;
    if (list.state === "failed") return [{ name: list.message, searchable: false }];
    if (list.state !== "loaded") return [];
    if (!list.projects.length) return [{ name: "No active projects are available.", searchable: false }];
    return list.projects.map((project) => ({ name: project.name, render: (setting) => {
      setting.addToggle((toggle) => toggle.setValue(this.plugin.data.selectedProjectIds.includes(project.id)).onChange(async (enabled) => {
        const selected = new Set(this.plugin.data.selectedProjectIds);
        if (enabled) selected.add(project.id);
        else selected.delete(project.id);
        this.plugin.data.selectedProjectIds = [...selected];
        await this.plugin.save();
      }));
    } }));
  }
  reloadProjects() {
    this.projectList = { state: "idle" };
    void this.loadProjects();
  }
  async loadProjects() {
    const request = { state: "loading" };
    this.projectList = request;
    let next;
    try {
      next = { state: "loaded", projects: await this.plugin.api().projects() };
    } catch (error) {
      next = { state: "failed", message: error instanceof Error ? error.message : String(error) };
    }
    if (this.projectList !== request) return;
    this.projectList = next;
    this.update();
  }
};
/*
MIT License

Copyright (c) 2026 Oshan and Sumedhe Dissanayake

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

# Bundled dependency

`main.js` bundles SHA-256 from `@noble/hashes`, under the MIT license below. Obsidian provides its own API at runtime; no Obsidian SDK, Node or Electron implementation is bundled. Development dependencies retain the licenses in their installed packages.

## @noble/hashes

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
