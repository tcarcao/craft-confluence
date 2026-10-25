// Reader view: shows the diagram stored as a page attachment. Never calls the
// craft server, so readers need no access to it.
import { view, requestConfluence, router } from '@forge/bridge';
import './view.css';

const root = document.getElementById('root');

const placeholder = (text) => {
  const p = document.createElement('div');
  p.className = 'placeholder';
  p.textContent = text;
  root.replaceChildren(p);
};

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

const ctx = await view.getContext();
const cfg = ctx.extension.config ?? {};
const pageId = ctx.extension.content.id;

if (!cfg.attachmentId) {
  // Only editors normally see this: a freshly inserted, not yet saved macro.
  placeholder('arch-craft: edit this macro to add a model.');
} else {
  try {
    // version pins the exact render this macro config points at.
    const res = await requestConfluence(
      `/wiki/rest/api/content/${pageId}/child/attachment/${cfg.attachmentId}/download?version=${cfg.version}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const img = document.createElement('img');
    img.alt = cfg.title || 'Craft diagram';
    img.src = await toDataUrl(await res.blob());
    img.style.width = `${cfg.width ?? 100}%`;
    img.title = 'Open full size';
    // Full size in a new tab: Confluence's own viewer for the attachment.
    if (cfg.filename) {
      img.onclick = () => router.open(`${ctx.siteUrl}/wiki/download/attachments/${pageId}/${encodeURIComponent(cfg.filename)}?version=${cfg.version}`);
      img.classList.add('zoomable');
    }
    const parts = [img];
    // Git diagrams say where they came from: source, ref and commit.
    const refs = cfg.refs ?? {};
    const commits = Object.entries(cfg.commits ?? {});
    const origin = commits.length
      ? `From ${cfg.gitSource} ${commits.map(([repo, sha]) => `${commits.length > 1 ? `${repo} ` : ''}${refs[repo] ? `${refs[repo]} ` : ''}@ ${sha.slice(0, 7)}`).join(', ')}${cfg.mode === 'draft' ? ', with a draft' : ''}`
      : '';
    if (cfg.title || origin) {
      const caption = document.createElement('figcaption');
      caption.textContent = cfg.title;
      if (origin) {
        const from = document.createElement('span');
        from.className = 'origin';
        from.textContent = origin;
        caption.append(from);
      }
      parts.push(caption);
    }
    root.replaceChildren(...parts);
  } catch (e) {
    placeholder(`arch-craft diagram could not be loaded (${e.message}).`);
  }
}
