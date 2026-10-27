// Editor panel. The model is written here (inline), read from a git source
// the craft server knows (git), or written here and rendered on top of a git
// source (draft). Save renders through the approved craft server, uploads the
// SVG as a page attachment and stores its id in the macro config; an
// unchanged render is not uploaded again. Size and title are display-only.
import { view, requestConfluence, permissions } from '@forge/bridge';
import { EditorView, basicSetup } from 'codemirror';
import { setDiagnostics } from '@codemirror/lint';
import { craftLanguage } from './craft-lang.js';
import './config.css';

const EGRESS_KEY = 'craft-server';
const TYPES = {
  c4: { label: 'containers', request: (dsl) => ['/preview/c4', { dsl }] },
  'c4-flat': { label: 'containers', request: (dsl) => ['/preview/c4', { dsl, boundariesMode: 'transparent' }] },
  architecture: { label: 'domain architecture', request: (dsl) => ['/preview/domain', { dsl, diagramType: 'domain', domainMode: 'architecture' }] },
  flow: { label: 'domain flow', request: (dsl) => ['/preview/domain', { dsl, diagramType: 'domain' }] },
  sequence: { label: 'sequence', request: (dsl) => ['/preview/domain', { dsl, diagramType: 'sequence' }] },
  // The preview endpoint answers plain SVG text; source renders answer base64.
  board: { label: 'scenario board', plain: true, request: (dsl, useCase) => ['/preview/board/domain', { dsl, useCase }] },
};

const $ = (id) => document.getElementById(id);
const status = (msg, isError = false) => {
  $('status').textContent = msg;
  $('status').className = isError ? 'muted error' : 'muted';
};

const ctx = await view.getContext();
const cfg = ctx.extension.config ?? {};
const pageId = ctx.extension.content.id;

// Forge's CSP blocks <style> tags. CodeMirror injects its CSS with
// constructable stylesheets only inside a shadow root, so mount it in one.
const shadow = $('editor').attachShadow({ mode: 'open' });
const editor = new EditorView({
  doc: cfg.source ?? '',
  root: shadow,
  parent: shadow,
  extensions: [
    basicSetup,
    craftLanguage,
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    }),
    EditorView.updateListener.of((u) => u.docChanged && (refreshUseCases(), refreshTitle())),
  ],
});
const source = () => editor.state.doc.toString();

$('mode').value = cfg.mode ?? 'inline';
$('type').value = cfg.type ?? 'c4';
$('size').value = String(cfg.width ?? 60);
$('title').value = cfg.title ?? '';

// The title follows the model until the user types their own.
let titleIsAuto = cfg.titleAuto ?? true;
const autoTitle = () => {
  const src = source();
  const useCase = src.match(/use_case\s+"([^"]+)"/)?.[1];
  const domains = [...src.matchAll(/^\s*domain\s+(\w+)/gm)].map((m) => m[1]);
  const type = $('type').value;
  if (type === 'board' && mode() !== 'git') {
    return $('useCase').value ? `${$('useCase').value}: ${TYPES.board.label}` : '';
  }
  if (mode() === 'git') {
    const picked = checked();
    const subject = picked.length && !type.startsWith('c4') ? picked.join(', ') : $('gitSource').value;
    return subject ? `${subject}: ${TYPES[type].label}` : '';
  }
  const subject = type.startsWith('c4') || type === 'architecture'
    ? domains.join(' and ')
    : useCase ?? domains.join(' and ');
  return subject ? `${subject}: ${TYPES[type].label}` : '';
};
const refreshTitle = () => { if (titleIsAuto) $('title').value = autoTitle(); };
$('title').oninput = () => { titleIsAuto = $('title').value === ''; };
$('type').onchange = () => { showUseCase(); refreshTitle(); };
$('useCase').onchange = refreshTitle;

// The board's use case: a select over the use cases written in the editor.
// Git mode picks it from the ticked list instead.
const showUseCase = () => { $('useCaseLabel').hidden = $('type').value !== 'board' || mode() === 'git'; };
const refreshUseCases = (keep = $('useCase').value) => {
  const names = [...new Set([...source().matchAll(/use_case\s+"([^"]+)"/g)].map((m) => m[1]))];
  $('useCase').replaceChildren(...names.map((n) => new Option(n, n)));
  $('useCase').value = names.includes(keep) ? keep : names[0] ?? '';
};
const boardUseCase = () => ($('type').value === 'board' ? $('useCase').value : '');

// The approved server is the first client-side egress domain the admin set.
const { results } = await permissions.egress.get({ keys: [EGRESS_KEY] });
const server = results?.[0]?.configured?.find((c) => c.type.includes('FETCH_CLIENT_SIDE'))?.domain;
$('server').textContent = server ? `via ${new URL(server).host}` : '';
$('approve').hidden = Boolean(server);

const mode = () => $('mode').value;
// A notice can carry one action button.
const notice = (msg, action) => {
  const parts = [msg];
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.onclick = action.run;
    parts.push(b);
  }
  $('notice').replaceChildren(...parts);
  $('notice').hidden = !msg;
};
const call = async (path, body) => {
  const res = await fetch(`${server}${path}`, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

// Git sources: the server's list, and the catalog of the chosen source and refs.
let sources = [];
let catalog = null;
let picked = new Set(cfg.useCases ?? []);
const checked = () => [...picked];
// One branch or MR field per repo of the source; empty means its branch.
const refs = () => Object.fromEntries([...$('refs').querySelectorAll('input')]
  .filter((i) => i.value.trim())
  .map((i) => [i.dataset.repo, i.value.trim()]));
// Reload once typing pauses: a change event needs a blur, and Preview can come first.
let refTimer;
const showRefs = (values) => {
  const repos = sources.find((x) => x.name === $('gitSource').value)?.repos ?? [];
  $('refs').replaceChildren(...repos.map((r) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.size = 12;
    input.dataset.repo = r.name;
    input.value = values[r.name] ?? '';
    input.placeholder = `${r.branch}, or !12`;
    input.oninput = () => { clearTimeout(refTimer); refTimer = setTimeout(() => { notice(''); loadCatalog(); }, 400); };
    label.append(repos.length > 1 ? r.name : 'Branch or MR', input);
    return label;
  }));
};

const showUseCases = () => {
  const q = $('filter').value.toLowerCase();
  $('useCases').replaceChildren(...(catalog?.useCases ?? [])
    .filter((uc) => uc.name.toLowerCase().includes(q))
    .map((uc) => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = picked.has(uc.name);
      box.onchange = () => { box.checked ? picked.add(uc.name) : picked.delete(uc.name); refreshTitle(); };
      const file = document.createElement('span');
      file.className = 'file';
      file.textContent = uc.file;
      label.append(box, uc.name, file);
      return label;
    }));
};
$('filter').oninput = showUseCases;

const loadCatalog = async () => {
  catalog = null;
  showUseCases();
  if (mode() === 'inline' || !$('gitSource').value) return;
  status('Reading the model from git...');
  try {
    catalog = await call(`/sources/${encodeURIComponent($('gitSource').value)}/catalog`, { refs: refs() });
    const names = new Set(catalog.useCases.map((uc) => uc.name));
    const gone = checked().filter((n) => !names.has(n));
    if (gone.length) notice(`Not found at this ref: ${gone.join(', ')}. Untick them or pick another branch.`);
    if (mode() === 'draft') offerPromotion(names);
    status('');
  } catch (e) {
    status(e instanceof TypeError ? `Could not reach ${server}: ${e.message}` : e.message, true);
  }
  showUseCases();
};

// A draft whose use cases are all in git now (its MR merged) should be read
// from git instead of kept as a copy that drifts.
const offerPromotion = (inGit) => {
  const drafted = [...source().matchAll(/use_case\s+"([^"]+)"/g)].map((m) => m[1]);
  if (!drafted.length || !drafted.every((n) => inGit.has(n))) return;
  notice(`${drafted.join(', ')} ${drafted.length > 1 ? 'are' : 'is'} in git now.`, {
    label: 'Read from git instead',
    run: () => {
      $('mode').value = 'git';
      picked = new Set(drafted);
      notice('Switched to reading from git. Preview, then Save.');
      showMode();
      showUseCases();
    },
  });
};

const showMode = () => {
  const m = mode();
  for (const el of document.querySelectorAll('.git-only')) el.hidden = m === 'inline';
  $('editor').hidden = m === 'git';
  $('picker').hidden = m !== 'git';
  showUseCase();
  refreshTitle();
};
$('mode').onchange = () => { notice(''); showMode(); loadCatalog(); };
$('gitSource').onchange = () => { picked = new Set(); notice(''); showRefs({}); loadCatalog(); refreshTitle(); };

if (server) {
  try {
    sources = (await call('/sources')).sources;
  } catch {
    // An older server without git sources: only inline models.
  }
}
if (!sources.length) {
  for (const v of ['git', 'draft']) $('mode').querySelector(`[value=${v}]`).disabled = true;
}
$('gitSource').replaceChildren(...sources.map((x) => new Option(x.name, x.name)));
$('gitSource').value = cfg.gitSource ?? sources[0]?.name ?? '';
// Older configs kept one ref, for the first repo.
const firstRepo = sources.find((x) => x.name === $('gitSource').value)?.repos[0]?.name;
showRefs(cfg.refs ?? (cfg.ref && firstRepo ? { [firstRepo]: cfg.ref } : {}));
refreshUseCases(cfg.useCase);
showMode();
await loadCatalog();
// Opening a stored git diagram: say when git has moved on since it was saved.
if (cfg.contentId && catalog && mode() !== 'inline' && catalog.contentId !== cfg.contentId && $('notice').hidden) {
  notice('The model in git changed since this diagram was saved. Preview, then Save to update it.');
}

$('approveBtn').onclick = async () => {
  try {
    const domain = new URL($('serverUrl').value.trim()).origin;
    await permissions.egress.set({
      egresses: [{
        key: EGRESS_KEY,
        description: 'Craft diagram server',
        configured: [{ domain, type: ['FETCH_CLIENT_SIDE', 'IMAGES'] }],
      }],
    });
    // The iframe's CSP is fixed at load, so the new domain only works after a reload.
    status('Server approved. Reload the page, then edit this macro again.');
  } catch (e) {
    status(`Approval failed: ${e.message}`, true);
  }
};

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
// Everything that changes the rendered file; the format is in it so diagrams
// stored as PNG by older versions re-render once.
const renderKey = (type, dsl, useCase = '') => sha256(`svg\n${type}\n${dsl}${useCase && `\n${useCase}`}`);

// Diagnostics that belong in the editor: an inline model's, or a draft's own
// (git files carry their repo path as sourceUri).
const inEditor = (d) => !d.sourceUri || d.sourceUri === 'inline.craft' || d.sourceUri === 'preview.craft';

// Craft diagnostics carry 0-based LSP ranges; map them onto editor offsets.
const showDiagnostics = (diags) => {
  const doc = editor.state.doc;
  const pos = (p) => Math.min(doc.line(Math.min(p.line + 1, doc.lines)).from + p.character, doc.length);
  editor.dispatch(setDiagnostics(editor.state, diags.map((d) => ({
    from: pos(d.range.start),
    to: Math.max(pos(d.range.end), pos(d.range.start) + 1),
    severity: d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info',
    message: d.message,
  }))));
};

// Last render, reused by Save when nothing changed since Preview.
let rendered = null;

// What to ask the server for. Git renders always go to the server, since
// only it knows whether git changed; the response's contentId says.
const request = () => {
  const type = $('type').value;
  if (mode() === 'inline') return TYPES[type].request(source(), $('useCase').value);
  return [`/sources/${encodeURIComponent($('gitSource').value)}/render`, {
    refs: refs(),
    view: type,
    ...(mode() === 'git' ? { useCases: checked() } : { dsl: source(), ...(type === 'board' && { useCases: [$('useCase').value] }) }),
  }];
};

const render = async () => {
  const [path, body] = request();
  const reqKey = JSON.stringify([path, body]);
  if (rendered?.reqKey === reqKey) return rendered;

  const slow = setTimeout(() => status(
    'Still waiting for the craft server. If your browser asks to access devices on your local network, allow it.',
  ), 4000);
  try {
    const json = await call(path, { ...body, format: 'svg' });
    const diags = json.diagnostics ?? [];
    showDiagnostics(diags.filter(inEditor));
    const errors = diags.filter((d) => d.severity === 'error' && inEditor(d));
    if (errors.length) throw new Error(`${errors.length} error(s) in the model, see the highlighted lines.`);
    const plain = mode() === 'inline' && TYPES[$('type').value].plain;
    const svg = plain ? json.data : new TextDecoder().decode(Uint8Array.from(atob(json.data), (c) => c.charCodeAt(0)));
    const hash = mode() === 'inline'
      ? await renderKey($('type').value, source(), boardUseCase())
      : await sha256(`svg\n${reqKey}\n${json.contentId}`);
    rendered = { reqKey, hash, svg, contentId: json.contentId, commits: json.commits };
    return rendered;
  } finally {
    clearTimeout(slow);
  }
};

const showPreview = (svg) => {
  const img = document.createElement('img');
  img.alt = $('title').value || 'Craft diagram';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  $('preview').replaceChildren(img);
};

const upload = async (svg) => {
  const form = new FormData();
  form.append('file', new Blob([svg], { type: 'image/svg+xml' }), `craft-${ctx.localId}.svg`);
  form.append('minorEdit', 'true');
  // PUT creates the attachment or adds a new version of the same file.
  const res = await requestConfluence(`/wiki/rest/api/content/${pageId}/child/attachment`, {
    method: 'PUT',
    headers: { 'X-Atlassian-Token': 'no-check' },
    body: form,
  });
  if (!res.ok) throw new Error(`attachment upload failed: HTTP ${res.status} ${await res.text()}`);
  const att = (await res.json()).results[0];
  return { attachmentId: att.id, version: att.version.number, filename: att.title };
};

const guard = (fn) => async () => {
  if (!server) return status('No craft server approved yet.', true);
  for (const b of ['previewBtn', 'save']) $(b).disabled = true;
  try {
    await fn();
  } catch (e) {
    status(e instanceof TypeError ? `Could not reach ${server}: ${e.message}` : e.message, true);
  } finally {
    for (const b of ['previewBtn', 'save']) $(b).disabled = false;
  }
};

// A board draws one use case; in git mode that is the single ticked one.
const needOneTick = () => {
  if ($('type').value !== 'board' || mode() !== 'git' || checked().length === 1) return false;
  status('A board draws one use case: tick exactly one.', true);
  return true;
};

$('previewBtn').onclick = guard(async () => {
  if (needOneTick()) return;
  status('Rendering...');
  showPreview((await render()).svg);
  status('');
});

$('cancel').onclick = () => view.close();

$('save').onclick = guard(async () => {
  const display = { width: Number($('size').value), title: $('title').value, titleAuto: titleIsAuto };
  const type = $('type').value;
  if (needOneTick()) return;

  // Inline and only size or title changed: keep the stored diagram, skip the server.
  if (mode() === 'inline' && (cfg.mode ?? 'inline') === 'inline' && await renderKey(type, source(), boardUseCase()) === cfg.hash && cfg.attachmentId) {
    await view.submit({ config: { ...cfg, ...display } });
    return;
  }
  status('Rendering...');
  const { svg, hash, contentId, commits } = await render();
  const model = mode() === 'inline'
    ? { mode: 'inline', source: source(), ...(type === 'board' && { useCase: boardUseCase() }) }
    : { mode: mode(), gitSource: $('gitSource').value, refs: refs(), useCases: checked(), contentId, commits, ...(mode() === 'draft' && { source: source(), ...(type === 'board' && { useCase: boardUseCase(), useCases: [boardUseCase()] }) }) };
  // Same render as stored (git unchanged): keep the attachment.
  if (hash === cfg.hash && cfg.attachmentId) {
    await view.submit({ config: { ...cfg, ...model, ...display } });
    return;
  }
  status('Saving diagram to the page...');
  const stored = await upload(svg);
  await view.submit({ config: { ...model, type, hash, ...stored, ...display } });
});

// Editing an existing diagram: show what is stored without calling the server.
if (cfg.attachmentId) {
  const res = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment/${cfg.attachmentId}/download?version=${cfg.version}`,
  );
  if (res.ok) {
    const blob = await res.blob();
    const img = document.createElement('img');
    img.alt = cfg.title || 'Craft diagram';
    img.src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    $('preview').replaceChildren(img);
  }
}
