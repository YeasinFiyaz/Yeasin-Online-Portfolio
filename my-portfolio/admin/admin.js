/* ===== Portfolio editor (private) ===== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 80);
// site-relative image paths ("./assets/...") must resolve from the site root, not /admin/
const imgSrc = u => (u ? (u.startsWith("./") ? "/" + u.slice(2) : u) : "");
const mdHtml = t => DOMPurify.sanitize(marked.parse(String(t || ""), { breaks: true }));

/* ---------- what can be edited ---------- */
const SCHEMAS = {
  projects: {
    label: "Projects", icon: "fa-folder-open", hint: "Shown on the home page (featured) and the Projects page.",
    title: i => i.title, sub: i => [i.period, (i.tags || []).join(", ")].filter(Boolean).join(" · "), thumb: i => i.image,
    badges: i => (i.featured ? [["feat", "Featured"]] : []),
    fields: [
      { k: "title", t: "text", l: "Title", req: true },
      { k: "period", t: "text", l: "Period", ph: "e.g. 2025 or 01/2023 – Present", half: true },
      { k: "featured", t: "bool", l: "Show on the home page", half: true },
      { k: "short", t: "textarea", l: "Short description" },
      { k: "image", t: "image", l: "Cover image" },
      { k: "tags", t: "tags", l: "Tags", ph: "AI, Python, Web" },
      { k: "github", t: "url", l: "GitHub link", half: true },
      { k: "demo", t: "url", l: "Live demo link", half: true },
    ],
  },
  awards: {
    label: "Awards", icon: "fa-trophy", hint: "Awards, volunteering and activities on the Awards page.",
    title: i => i.title, sub: i => [i.org, i.period].filter(Boolean).join(" · "),
    fields: [
      { k: "title", t: "text", l: "Title", req: true },
      { k: "org", t: "text", l: "Organisation", half: true },
      { k: "period", t: "text", l: "Year / period", ph: "2024 - 2025", half: true },
      { k: "note", t: "textarea", l: "Note (optional)" },
    ],
  },
  experience: {
    label: "Experience", icon: "fa-briefcase", hint: "Leadership roles and the events under them (Cultural Exchange, Speakathon...). Open a role to edit its events and write-ups.",
    title: i => `${i.role || ""} — ${i.org || ""}`, sub: i => [i.start && `${i.start}${i.end ? " – " + i.end : ""}`, `${(i.events || []).length} event(s)`].filter(Boolean).join(" · "), thumb: i => i.logo,
    fields: [
      { k: "role", t: "text", l: "Role", req: true, half: true },
      { k: "tag", t: "text", l: "Label", ph: "Leadership", half: true },
      { k: "org", t: "text", l: "Organisation", req: true },
      { k: "start", t: "text", l: "Start", ph: "Mar 2024", half: true },
      { k: "end", t: "text", l: "End", ph: "Mar 2025 or Present", half: true },
      { k: "location", t: "text", l: "Location" },
      { k: "logo", t: "image", l: "Logo (optional)" },
      { k: "summary", t: "markdown", l: "Summary", rows: 4 },
      {
        k: "events", t: "items", l: "Events", add: "Add event", itemTitle: e => e.title || "New event",
        fields: [
          { k: "title", t: "text", l: "Event name", req: true },
          { k: "date", t: "text", l: "Date", ph: "2024", half: true },
          { k: "tagline", t: "text", l: "One-line description", half: true },
          { k: "cover", t: "image", l: "Cover photo" },
          { k: "link", t: "url", l: "Link (optional)", ph: "https://..." },
          { k: "body", t: "markdown", l: "Full write-up (shown when visitors open the event)" },
          { k: "photos", t: "photos", l: "Photo gallery" },
        ],
      },
    ],
  },
  blog: {
    label: "Blog", icon: "fa-pen-nib", hint: "Articles on the Blog page. Hidden posts are drafts — only you can see them here.",
    title: i => i.title, sub: i => [i.date, i.slug && "/post.html?slug=" + i.slug].filter(Boolean).join(" · "), thumb: i => i.cover,
    sort: (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
    fields: [
      { k: "title", t: "text", l: "Title", req: true },
      { k: "date", t: "date", l: "Date", half: true },
      { k: "slug", t: "text", l: "Web address", ph: "made from the title", help: "Letters, numbers and dashes only.", half: true },
      { k: "excerpt", t: "textarea", l: "Short summary (shown on the card)" },
      { k: "cover", t: "image", l: "Cover image" },
      { k: "tags", t: "tags", l: "Tags", ph: "AI, Research" },
      { k: "body", t: "markdown", l: "Article", rows: 18 },
    ],
  },
  publications: {
    label: "Publications", icon: "fa-book-open", hint: "Papers and articles on the Publications page (newest year first).",
    title: i => i.title, sub: i => [i.year, i.venue].filter(Boolean).join(" · "),
    fields: [
      { k: "title", t: "text", l: "Title", req: true },
      { k: "authors", t: "text", l: "Authors", ph: "Y. Fiyaz, A. Author" },
      { k: "venue", t: "text", l: "Journal / conference", half: true },
      { k: "year", t: "number", l: "Year", half: true },
      { k: "type", t: "select", l: "Type", opts: ["Journal", "Conference", "Preprint", "Thesis", "Book chapter", "Article", "Other"], half: true },
      { k: "link", t: "url", l: "Link to paper", half: true },
      { k: "pdf", t: "url", l: "PDF link (optional)" },
      { k: "abstract", t: "markdown", l: "Abstract", rows: 6 },
    ],
  },
};
const ORDER = ["projects", "awards", "experience", "blog", "publications"];

/* ---------- state ---------- */
let token = localStorage.getItem("pf_token") || "";
let current = "projects";
const data = {};
const fromServer = {};

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  let body = null;
  try { body = await res.json(); } catch {}
  if (res.status === 401 && path !== "/api/google") { signOut("Your session ended. Please sign in again."); throw new Error("signed out"); }
  if (!res.ok) throw new Error((body && body.error) || `Error ${res.status}`);
  return body;
}
async function load(type) {
  try {
    data[type] = await api(`/api/content/${type}`);
    fromServer[type] = true;
  } catch {
    // first time: start from the content currently bundled with the site
    const r = await fetch(`/data/${type}.json`, { cache: "no-store" });
    data[type] = r.ok ? await r.json() : [];
    fromServer[type] = false;
  }
  data[type].forEach(i => { if (!i.id) i.id = uid(); });
}
async function save(type) {
  await api(`/api/content/${type}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data[type]) });
  fromServer[type] = true;
}

/* ---------- toast ---------- */
let toastT;
function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), 3200);
}

/* ---------- auth: Sign in with Google ---------- */
let gReady = null;
async function showGoogleButton() {
  const box = $("#gBtn");
  try {
    const cfg = await (await fetch("/api/config", { cache: "no-store" })).json();
    if (!cfg.googleClientId) { box.innerHTML = '<p class="muted small">Google sign-in is not configured yet.</p>'; return; }
    await (gReady ||= new Promise(r => { const t = setInterval(() => { if (window.google?.accounts?.id) { clearInterval(t); r(); } }, 100); }));
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onGoogle, ux_mode: "popup", auto_select: false });
    box.innerHTML = "";
    google.accounts.id.renderButton(box, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", width: 300 });
  } catch { box.innerHTML = '<p class="login-err">Could not load Google sign-in. Check your internet and reload.</p>'; }
}
async function onGoogle(resp) {
  $("#loginErr").textContent = "";
  try {
    const r = await api("/api/google", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential: resp.credential }) });
    token = r.token; localStorage.setItem("pf_token", token);
    await start(r);
    toast(`Signed in as ${r.email}`);
  } catch (err) { $("#loginErr").textContent = err.message; }
}
function signOut(msg) {
  token = ""; localStorage.removeItem("pf_token");
  try { google.accounts.id.disableAutoSelect(); } catch {}
  $("#appView").hidden = true; $("#loginView").hidden = false;
  closeDrawer(true);
  $("#loginErr").textContent = msg || "";
  showGoogleButton();
}
$("#logoutBtn").addEventListener("click", () => signOut("Signed out."));

/* ---------- list view ---------- */
function renderTabs() {
  $("#tabs").innerHTML = ORDER.map(t => `<button class="tab ${t === current ? "active" : ""}" data-t="${t}" type="button"><i class="fa-solid ${SCHEMAS[t].icon}"></i>${SCHEMAS[t].label}<span class="count">${(data[t] || []).length}</span></button>`).join("");
  $("#tabs").querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { current = b.dataset.t; renderAll(); }));
}
function renderList() {
  const S = SCHEMAS[current], items = data[current] || [];
  $("#tabTitle").textContent = S.label;
  $("#tabHint").textContent = S.hint;
  $("#addBtn span").textContent = current === "blog" ? "New post" : "Add new";
  const n = $("#notice");
  n.hidden = fromServer[current] !== false;
  n.innerHTML = `<i class="fa-solid fa-circle-info"></i> This list is the content currently on your website. Your first save will move it into the editor.`;
  if (!items.length) { $("#list").innerHTML = `<div class="empty"><i class="fa-regular fa-folder-open fa-2x"></i><p>Nothing here yet. Click <b>${$("#addBtn span").textContent}</b> to add the first one.</p></div>`; return; }
  $("#list").innerHTML = items.map((it, i) => {
    const th = S.thumb ? imgSrc(S.thumb(it)) : "";
    const badges = [...(S.badges ? S.badges(it) : []), ...(it.hidden ? [["hid", current === "blog" ? "Draft" : "Hidden"]] : [])];
    return `<div class="row ${it.hidden ? "is-hidden" : ""}" data-i="${i}">
      <div class="thumb" ${th ? `style="background-image:url('${esc(th)}')"` : ""}>${th ? "" : `<i class="fa-solid ${S.icon}"></i>`}</div>
      <div><div class="row-title">${esc(S.title(it) || "(untitled)")}${badges.map(([c, t]) => `<span class="badge ${c}">${t}</span>`).join("")}</div><div class="row-sub">${esc(S.sub(it))}</div></div>
      <div class="row-actions">
        <button class="icon-btn" data-a="up" title="Move up" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-up"></i></button>
        <button class="icon-btn" data-a="down" title="Move down" ${i === items.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-down"></i></button>
        <button class="icon-btn" data-a="hide" title="${it.hidden ? "Show on website" : "Hide from website"}"><i class="fa-solid ${it.hidden ? "fa-eye-slash" : "fa-eye"}"></i></button>
        <button class="icon-btn" data-a="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-a="del" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></div>`;
  }).join("");
  $("#list").querySelectorAll(".row").forEach(row => {
    const i = +row.dataset.i;
    row.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); rowAction(b, b.dataset.a, i); }));
    row.addEventListener("dblclick", () => openDrawer(i));
  });
}
async function rowAction(btn, a, i) {
  const arr = data[current];
  if (a === "edit") return openDrawer(i);
  if (a === "del" && !btn.classList.contains("confirm-del")) {
    btn.classList.add("confirm-del"); btn.innerHTML = "Delete?";
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove("confirm-del"); btn.innerHTML = '<i class="fa-solid fa-trash"></i>'; } }, 3500);
    return;
  }
  const before = JSON.stringify(arr);
  if (a === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  if (a === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
  if (a === "hide") arr[i].hidden = !arr[i].hidden;
  if (a === "del") arr.splice(i, 1);
  try {
    await save(current);
    toast(a === "del" ? "Deleted" : a === "hide" ? (arr[i]?.hidden ? "Hidden from the website" : "Visible on the website") : "Order saved");
  } catch (err) {
    data[current] = JSON.parse(before);
    toast(err.message, true);
  }
  renderAll();
}
function renderAll() { renderTabs(); renderList(); }

/* ---------- form builder ---------- */
function fieldHtml(f, v, path) {
  const id = "f_" + path.replace(/\W/g, "_");
  const cls = `field ${f.req ? "req" : ""}`;
  const help = f.help ? `<span class="help">${esc(f.help)}</span>` : "";
  const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : "";
  switch (f.t) {
    case "text": case "url": case "date": case "number":
      return `<div class="${cls}" data-k="${path}"><label for="${id}">${esc(f.l)}</label><input id="${id}" type="${f.t}" value="${esc(v ?? "")}"${ph} />${help}</div>`;
    case "textarea":
      return `<div class="${cls}" data-k="${path}"><label for="${id}">${esc(f.l)}</label><textarea id="${id}" rows="${f.rows || 3}"${ph}>${esc(v ?? "")}</textarea>${help}</div>`;
    case "select":
      return `<div class="${cls}" data-k="${path}"><label for="${id}">${esc(f.l)}</label><select id="${id}"><option value=""></option>${f.opts.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
    case "bool":
      return `<div class="field" data-k="${path}"><span class="lbl">&nbsp;</span><label class="check"><input type="checkbox" ${v ? "checked" : ""} /> ${esc(f.l)}</label></div>`;
    case "tags":
      return `<div class="${cls}" data-k="${path}"><label for="${id}">${esc(f.l)}</label><input id="${id}" type="text" value="${esc((v || []).join(", "))}"${ph} /><span class="help">Separate with commas.</span></div>`;
    case "image":
      return `<div class="field" data-k="${path}"><span class="lbl">${esc(f.l)}</span><div class="img-field">
        <div class="img-prev" ${v ? `style="background-image:url('${esc(imgSrc(v))}')"` : ""}>${v ? "" : '<i class="fa-regular fa-image fa-lg"></i>'}</div>
        <div class="img-ctrl"><input type="text" value="${esc(v || "")}" placeholder="Upload a picture or paste an image link" />
          <div class="btns"><label class="btn btn-ghost"><i class="fa-solid fa-upload"></i> Upload<input type="file" accept="image/*" hidden /></label>
          <button type="button" class="btn btn-ghost img-clear"><i class="fa-solid fa-xmark"></i> Remove</button></div></div></div></div>`;
    case "photos":
      return `<div class="field" data-k="${path}"><span class="lbl">${esc(f.l)}</span><div class="photos">
        ${(v || []).map((p, i) => `<div class="photo" style="background-image:url('${esc(imgSrc(p))}')" data-url="${esc(p)}"><button type="button" class="icon-btn danger" data-rm="${i}" aria-label="Remove photo"><i class="fa-solid fa-xmark"></i></button></div>`).join("")}
        <label class="photo-add"><span><i class="fa-solid fa-plus"></i><br>Add photos</span><input type="file" accept="image/*" multiple hidden /></label></div></div>`;
    case "markdown":
      return `<div class="field" data-k="${path}"><span class="lbl">${esc(f.l)}</span>
        <div class="md-tools">
          <button type="button" data-md="b" title="Bold"><i class="fa-solid fa-bold"></i></button>
          <button type="button" data-md="i" title="Italic"><i class="fa-solid fa-italic"></i></button>
          <button type="button" data-md="h" title="Heading">H</button>
          <button type="button" data-md="ul" title="Bullet list"><i class="fa-solid fa-list-ul"></i></button>
          <button type="button" data-md="q" title="Quote"><i class="fa-solid fa-quote-left"></i></button>
          <button type="button" data-md="a" title="Link"><i class="fa-solid fa-link"></i></button>
          <label title="Insert picture" style="cursor:pointer;padding:6px 10px;border-radius:8px"><i class="fa-regular fa-image"></i><input type="file" accept="image/*" hidden data-mdimg /></label>
          <span class="sp"></span>
          <button type="button" data-md="prev" title="Preview"><i class="fa-solid fa-eye"></i> Preview</button>
        </div>
        <textarea class="md-area" rows="${f.rows || 10}" placeholder="Write here. Leave a blank line between paragraphs.">${esc(v ?? "")}</textarea>
        <div class="md-prev" hidden></div></div>`;
    case "items":
      return `<div class="field" data-k="${path}"><span class="lbl">${esc(f.l)}</span><div class="sub-items">
        ${(v || []).map((it, i) => `<div class="sub-item" data-i="${i}"><div class="sub-head"><i class="fa-solid fa-grip-lines muted"></i><span class="t">${esc(f.itemTitle(it))}</span>
          <button type="button" class="icon-btn" data-sub="up" ${i === 0 ? "disabled" : ""} title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" class="icon-btn" data-sub="down" ${i === v.length - 1 ? "disabled" : ""} title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" class="icon-btn danger" data-sub="del" title="Delete event"><i class="fa-solid fa-trash"></i></button>
          <i class="fa-solid fa-chevron-down muted"></i></div>
          <div class="sub-body">${layout(f.fields, it, `${path}.${i}`)}</div></div>`).join("")}
        <button type="button" class="btn btn-ghost" data-sub="add"><i class="fa-solid fa-plus"></i> ${esc(f.add)}</button></div></div>`;
  }
  return "";
}
function layout(fields, obj, prefix) {
  let html = "", buf = [];
  const flush = () => { if (buf.length) { html += buf.length === 2 ? `<div class="grid2">${buf.join("")}</div>` : buf.join(""); buf = []; } };
  fields.forEach(f => {
    const h = fieldHtml(f, obj[f.k], prefix ? `${prefix}.${f.k}` : f.k);
    if (f.half) { buf.push(h); if (buf.length === 2) flush(); } else { flush(); html += h; }
  });
  flush();
  return html;
}

/* read the form back into an object */
function readFields(fields, root, prefix, target) {
  fields.forEach(f => {
    const path = prefix ? `${prefix}.${f.k}` : f.k;
    const el = root.querySelector(`[data-k="${CSS.escape(path)}"]`);
    if (!el) return;
    if (f.t === "items") {
      target[f.k] = (draft._items[path] || []).map((it, i) => readFields(f.fields, el, `${path}.${i}`, { ...it }));
      return;
    }
    if (f.t === "bool") target[f.k] = el.querySelector("input").checked;
    else if (f.t === "tags") target[f.k] = el.querySelector("input").value.split(",").map(s => s.trim()).filter(Boolean);
    else if (f.t === "photos") target[f.k] = [...el.querySelectorAll(".photo")].map(p => p.dataset.url);
    else if (f.t === "image") target[f.k] = el.querySelector("input[type=text]").value.trim();
    else if (f.t === "markdown") target[f.k] = el.querySelector("textarea").value;
    else if (f.t === "number") { const n = el.querySelector("input").value; target[f.k] = n === "" ? "" : +n; }
    else target[f.k] = el.querySelector("input,textarea,select").value.trim();
  });
  return target;
}

/* ---------- image upload (resized in the browser first) ---------- */
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const max = 2000, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.5e6) return file;
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(b => r(b || file), "image/webp", 0.85));
}
async function upload(file) {
  const blob = await shrink(file);
  const r = await api("/api/media", { method: "POST", headers: { "content-type": blob.type || file.type }, body: blob });
  return r.url;
}

/* ---------- drawer ---------- */
let draft = null;   // { index, obj, _items:{path: array} }
function openDrawer(index) {
  const S = SCHEMAS[current];
  const obj = index == null ? { id: uid() } : JSON.parse(JSON.stringify(data[current][index]));
  if (index == null && current === "blog") obj.date = new Date().toISOString().slice(0, 10);
  draft = { index, obj, _items: {} };
  S.fields.filter(f => f.t === "items").forEach(f => (draft._items[f.k] = obj[f.k] || []));
  $("#drawerTitle").textContent = index == null ? `New ${S.label.replace(/s$/, "").toLowerCase()}` : `Edit ${S.label.replace(/s$/, "").toLowerCase()}`;
  renderForm();
  $("#drawerStatus").textContent = obj.hidden ? (current === "blog" ? "Draft — not visible on the website" : "Hidden from the website") : "";
  $("#drawerBg").hidden = false;
  $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#itemForm input, #itemForm textarea")?.focus(), 250);
}
function renderForm() {
  const S = SCHEMAS[current];
  // keep any typed values before re-rendering (e.g. after adding an event)
  const f = $("#itemForm");
  f.innerHTML = layout(S.fields, draft.obj, "");
  wireForm(f);
}
function syncDraft() { readFields(SCHEMAS[current].fields, $("#itemForm"), "", draft.obj); SCHEMAS[current].fields.filter(f => f.t === "items").forEach(f => (draft._items[f.k] = draft.obj[f.k])); }
function wireForm(form) {
  // images
  form.querySelectorAll(".img-field").forEach(box => {
    const prev = box.querySelector(".img-prev"), txt = box.querySelector("input[type=text]");
    const show = () => { prev.style.backgroundImage = txt.value ? `url('${imgSrc(txt.value)}')` : ""; prev.innerHTML = txt.value ? "" : '<i class="fa-regular fa-image fa-lg"></i>'; };
    txt.addEventListener("change", show);
    box.querySelector(".img-clear").addEventListener("click", () => { txt.value = ""; show(); });
    box.querySelector("input[type=file]").addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      prev.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try { txt.value = await upload(file); show(); toast("Picture uploaded"); }
      catch (err) { toast(err.message, true); show(); }
      e.target.value = "";
    });
  });
  // galleries
  form.querySelectorAll(".photos").forEach(g => {
    g.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) b.closest(".photo").remove(); });
    g.querySelector("input[type=file]").addEventListener("change", async e => {
      const files = [...e.target.files]; e.target.value = "";
      const add = g.querySelector(".photo-add");
      for (const file of files) {
        const ph = document.createElement("div"); ph.className = "photo"; ph.innerHTML = '<span style="display:grid;place-items:center;height:100%"><i class="fa-solid fa-spinner fa-spin"></i></span>';
        g.insertBefore(ph, add);
        try {
          const url = await upload(file);
          ph.dataset.url = url; ph.style.backgroundImage = `url('${url}')`;
          ph.innerHTML = '<button type="button" class="icon-btn danger" data-rm="x" aria-label="Remove photo"><i class="fa-solid fa-xmark"></i></button>';
        } catch (err) { ph.remove(); toast(err.message, true); }
      }
    });
  });
  // markdown editors
  form.querySelectorAll(".md-tools").forEach(bar => {
    const ta = bar.nextElementSibling, pv = ta.nextElementSibling;
    const wrap = (a, b = a, ph = "text") => {
      const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph;
      ta.setRangeText(a + sel + b, s, e, "end"); ta.focus();
    };
    const line = pre => {
      const s = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      ta.setRangeText(pre, s, s, "end"); ta.focus();
    };
    bar.querySelectorAll("[data-md]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.md;
      if (k === "b") wrap("**"); if (k === "i") wrap("_");
      if (k === "h") line("## "); if (k === "ul") line("- "); if (k === "q") line("> ");
      if (k === "a") { const u = prompt("Link address (https://...)"); if (u) wrap("[", `](${u})`, "link text"); }
      if (k === "prev") {
        const on = pv.hidden; pv.hidden = !on; ta.hidden = on; b.classList.toggle("on", on);
        if (on) pv.innerHTML = mdHtml(ta.value) || '<span class="muted">Nothing written yet.</span>';
        pv.querySelectorAll("img").forEach(i => (i.src = imgSrc(i.getAttribute("src"))));
      }
    }));
    bar.querySelector("[data-mdimg]").addEventListener("change", async e => {
      const file = e.target.files[0]; e.target.value = ""; if (!file) return;
      toast("Uploading picture…");
      try { const url = await upload(file); ta.setRangeText(`\n![](${url})\n`, ta.selectionStart, ta.selectionStart, "end"); toast("Picture added"); }
      catch (err) { toast(err.message, true); }
    });
  });
  // nested items (events)
  form.querySelectorAll(".sub-items").forEach(box => {
    const path = box.closest("[data-k]").dataset.k;
    box.querySelectorAll(".sub-head").forEach(h => h.addEventListener("click", e => { if (!e.target.closest("button")) h.parentElement.classList.toggle("open"); }));
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-sub]"); if (!b) return;
      syncDraft();
      const arr = draft._items[path], i = +b.closest(".sub-item")?.dataset.i;
      const openSet = new Set([...box.querySelectorAll(".sub-item.open")].map(x => +x.dataset.i));
      if (b.dataset.sub === "add") { arr.push({ id: uid() }); openSet.clear(); openSet.add(arr.length - 1); }
      if (b.dataset.sub === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (b.dataset.sub === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      if (b.dataset.sub === "del") {
        if (!b.classList.contains("confirm-del")) { b.classList.add("confirm-del"); b.textContent = "Delete?"; return; }
        arr.splice(i, 1);
      }
      draft.obj[path] = arr;
      renderForm();
      $("#itemForm").querySelectorAll(`[data-k="${path}"] .sub-item`).forEach(x => { if (openSet.has(+x.dataset.i)) x.classList.add("open"); });
    });
  });
  // blog: web address follows the title until you edit it yourself
  if (current === "blog") {
    const t = form.querySelector('[data-k="title"] input'), s = form.querySelector('[data-k="slug"] input');
    let auto = !s.value || s.value === slugify(t.value);
    s.addEventListener("input", () => (auto = false));
    t.addEventListener("input", () => { if (auto) s.value = slugify(t.value); });
  }
}
function validate(fields, root, prefix) {
  let ok = true;
  fields.forEach(f => {
    const path = prefix ? `${prefix}.${f.k}` : f.k;
    const el = root.querySelector(`[data-k="${CSS.escape(path)}"]`);
    if (!el) return;
    if (f.t === "items") { (draft._items[path] || []).forEach((_, i) => { if (!validate(f.fields, el, `${path}.${i}`)) { ok = false; el.querySelector(`.sub-item[data-i="${i}"]`)?.classList.add("open"); } }); return; }
    const input = el.querySelector("input,textarea,select");
    const bad = f.req && !input.value.trim();
    el.classList.toggle("invalid", bad);
    if (bad) ok = false;
  });
  return ok;
}
function closeDrawer(force) {
  $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true");
  $("#drawerBg").hidden = true; draft = null;
  if (!force) $("#itemForm").innerHTML = "";
}
$("#drawerClose").addEventListener("click", () => closeDrawer());
$("#cancelBtn").addEventListener("click", () => closeDrawer());
$("#drawerBg").addEventListener("click", () => closeDrawer());
addEventListener("keydown", e => { if (e.key === "Escape" && draft) closeDrawer(); });
$("#addBtn").addEventListener("click", () => openDrawer(null));
$("#saveBtn").addEventListener("click", async () => {
  if (!draft) return;
  const S = SCHEMAS[current];
  if (!validate(S.fields, $("#itemForm"), "")) { toast("Please fill in the required fields (marked *)", true); return; }
  syncDraft();
  const obj = draft.obj;
  if (current === "blog") {
    obj.slug = slugify(obj.slug || obj.title) || obj.id;
    const clash = data.blog.some((p, i) => i !== draft.index && p.slug === obj.slug);
    if (clash) obj.slug += "-" + obj.id.slice(-4);
  }
  const arr = data[current], before = JSON.stringify(arr);
  if (draft.index == null) (S.sort ? arr.push(obj) : arr.push(obj)); else arr[draft.index] = obj;
  if (S.sort) arr.sort(S.sort);
  const btn = $("#saveBtn"); btn.disabled = true; $("#drawerStatus").textContent = "Saving…";
  try {
    await save(current);
    closeDrawer();
    toast("Saved — it's live on your website");
  } catch (err) {
    data[current] = JSON.parse(before);
    $("#drawerStatus").textContent = "";
    toast(err.message, true);
  } finally { btn.disabled = false; renderAll(); }
});

/* ---------- start ---------- */
async function start(me) {
  $("#loginView").hidden = true; $("#appView").hidden = false;
  if (me) $("#who").innerHTML = `<i class="fa-solid fa-circle-user"></i> <span>${esc(me.email)}<small>${me.role === "superadmin" ? "Super admin" : "Editor"}</small></span>`;
  await Promise.all(ORDER.map(load));
  renderAll();
}
(async () => {
  if (!token) return signOut();
  try { await start(await api("/api/me")); } catch { if (token) signOut(); }
})();
