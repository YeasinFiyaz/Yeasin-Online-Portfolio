/* ===== Yeasin Fiyaz Portfolio — main.js ===== */

// 1) CV link (default; Site Settings can change it)
const CV_LINK = "https://drive.google.com/uc?export=download&id=1twtHTj5geSqqibd8J6Qvk490hM08cCRl";
document.querySelectorAll("[data-cv]").forEach(a => (a.href = CV_LINK));

// 2) Navbar: shadow on scroll, progress bar, active link, close on tap (mobile)
const nav = document.querySelector(".nav-top");
const navMenu = document.getElementById("navMenu");
const navLinks = [...document.querySelectorAll("#navMenu .nav-link[href^='#']")];
const sections = navLinks.map(l => document.querySelector(l.getAttribute("href"))).filter(Boolean);

function onScroll() {
  const y = window.scrollY;
  if (nav) nav.classList.toggle("scrolled", y > 30);
  const bar = document.querySelector(".scroll-progress");
  if (bar) {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
  }
  document.querySelector(".to-top")?.classList.toggle("show", y > 500);
  if (sections.length) {
    let current = sections[0];
    for (const s of sections) if (s.offsetTop - 160 <= y) current = s;
    navLinks.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + current.id));
  }
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (navMenu) {
  navMenu.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (navMenu.classList.contains("show")) bootstrap.Collapse.getOrCreateInstance(navMenu).hide();
    });
  });
}
document.querySelector(".to-top")?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

// 3) Custom cursor (desktop only)
const dot = document.querySelector(".cursor-dot"), ring = document.querySelector(".cursor-ring");
if (dot && ring && matchMedia("(hover:hover)").matches) {
  let rx = -100, ry = -100, tx = -100, ty = -100;
  addEventListener("pointermove", e => {
    tx = e.clientX; ty = e.clientY;
    dot.style.transform = `translate(${tx}px,${ty}px) translate(-50%,-50%)`;
  }, { passive: true });
  (function loop() {
    rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  const hoverable = "a, button, .svc, .tech, .project-row, .project-card";
  document.addEventListener("pointerover", e => { if (e.target.closest(hoverable)) document.body.classList.add("cursor-hover"); });
  document.addEventListener("pointerout", e => { if (e.target.closest(hoverable)) document.body.classList.remove("cursor-hover"); });
}

// 4) Hero: letter-by-letter name entrance, typing role line, gentle parallax
document.querySelectorAll(".hero-name .hero-line").forEach((line, li) => {
  line.innerHTML = [...line.childNodes].map(n => {
    const cls = n.nodeType === 1 && n.className ? ` class="${n.className}"` : "";
    return [...n.textContent].map(ch => `<span${cls}>${ch}</span>`).join("");
  }).join("");
  line.querySelectorAll("span").forEach((s, i) => (s.style.animationDelay = (0.2 + li * 0.3 + i * 0.06) + "s"));
});

const roleText = document.getElementById("roleText");
let roles = ["AI Engineer & Data Analyst", "Full-Stack Developer", "Machine Learning Researcher", "CSE Graduate, BRAC University"];
if (roleText) {
  let r = 0, c = 0, deleting = false;
  const tick = () => {
    const word = roles[r % roles.length] || "";
    c += deleting ? -1 : 1;
    roleText.textContent = word.slice(0, c);
    let delay = deleting ? 35 : 65;
    if (!deleting && c >= word.length) { delay = 1900; deleting = true; }
    else if (deleting && c <= 0) { deleting = false; r = (r + 1) % roles.length; delay = 350; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 1200);
}

const heroVisual = document.querySelector(".hero-visual");
if (heroVisual && matchMedia("(hover:hover)").matches) {
  const person = heroVisual.querySelector(".hv-person"), circle = heroVisual.querySelector(".hv-circle");
  addEventListener("pointermove", e => {
    const x = (e.clientX / innerWidth - 0.5), y = (e.clientY / innerHeight - 0.5);
    if (person) person.style.marginLeft = (x * 14) + "px";
    if (circle) circle.style.marginLeft = (x * -18) + "px", circle.style.marginBottom = (y * 12) + "px";
  }, { passive: true });
}

// 4b) Skill radar (shape only, no numbers; levels shown on hover) — drawn from Site Settings
const LEVEL_VALUE = { Expert: 0.92, Advanced: 0.75, Intermediate: 0.55, Beginner: 0.35 };
function drawRadar(list) {
  const radar = document.getElementById("skillRadar");
  if (!radar) return;
  const skills = list.filter(s => s && s.name).map(s => ({ n: s.name.replace("Java / JavaScript", "Java / JS"), v: LEVEL_VALUE[s.level] || 0.6, l: s.level || "" }));
  if (skills.length < 3) { radar.innerHTML = ""; return; }
  const cx = 200, cy = 170, R = 118, N = skills.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = r => skills.map((_, i) => pt(i, r).map(n => n.toFixed(1)).join(",")).join(" ");
  let svg = "";
  [0.25, 0.5, 0.75, 1].forEach(k => (svg += `<polygon class="ring${k === 1 ? " outer" : ""}" points="${poly(R * k)}"/>`));
  skills.forEach((_, i) => { const [x, y] = pt(i, R); svg += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; });
  svg += `<g class="shape-g"><polygon class="shape" points="${skills.map((s, i) => pt(i, R * s.v).join(",")).join(" ")}"/>`;
  skills.forEach((s, i) => {
    const [x, y] = pt(i, R * s.v);
    svg += `<circle class="hit" data-i="${i}" cx="${x}" cy="${y}" r="16"/><circle class="pt" cx="${x}" cy="${y}" r="5.5"/>`;
  });
  svg += `</g>`;
  const escT = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  skills.forEach((s, i) => {
    const [x, y] = pt(i, R + 24);
    const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
    const dy = y < cy - 40 ? -6 : y > cy + 40 ? 14 : 4;
    svg += `<text class="lbl" x="${x}" y="${y + dy}" text-anchor="${anchor}">${escT(s.n)}</text>`;
    svg += `<text class="lbl-sub" x="${x}" y="${y + dy + 15}" text-anchor="${anchor}">${escT(s.l)}</text>`;
  });
  radar.innerHTML = svg;
  radar.setAttribute("aria-label", "Skill radar: " + skills.map(s => `${s.n} ${s.l}`).join("; "));

  const tip = radar.parentElement.querySelector(".radar-tip");
  radar.querySelectorAll(".hit").forEach(h => {
    const show = () => {
      const s = skills[+h.dataset.i], b = h.getBoundingClientRect(), w = radar.parentElement.getBoundingClientRect();
      tip.textContent = `${s.n} — ${s.l}`;
      tip.style.left = (b.left + b.width / 2 - w.left) + "px";
      tip.style.top = (b.top + b.height / 2 - w.top) + "px";
      tip.classList.add("show");
      h.nextElementSibling.classList.add("on");
    };
    const hide = () => { tip.classList.remove("show"); h.nextElementSibling.classList.remove("on"); };
    h.addEventListener("pointerenter", show);
    h.addEventListener("pointerleave", hide);
    h.addEventListener("click", show);
  });
}

// 5) Reveal-on-scroll, counters and skill bars
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    el.classList.add("in");
    if (el.classList.contains("count")) {
      const end = +el.dataset.end, t0 = performance.now(), dur = 1500;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    el.querySelectorAll(".fill[data-width]").forEach(f => (f.style.width = f.dataset.width + "%"));
    io.unobserve(el);
  });
}, { threshold: 0.2 });
document.querySelectorAll(".reveal, .count, .skills-card").forEach(el => io.observe(el));

// 6) Content loading: live editor data from /api, else the bundled JSON files
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => (/^(https?:\/\/|\.\/|\/(?!\/))/i.test(String(u || "").trim()) ? String(u).trim() : "");
const md = text => {
  const raw = window.marked ? window.marked.parse(String(text || ""), { breaks: true }) : esc(text).replace(/\n/g, "<br>");
  return window.DOMPurify ? window.DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] }) : esc(text);
};
const contentCache = {};
function loadContent(type) {
  if (!contentCache[type]) {
    contentCache[type] = fetch(`/api/content/${type}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .catch(() => fetch(`./data/${type}.json`, { cache: "no-store" }).then(r => (r.ok ? r.json() : [])))
      .then(d => (Array.isArray(d) ? d.filter(x => x && x.hidden !== true) : []))
      .catch(() => []);
  }
  return contentCache[type];
}
const observeNew = root => root.querySelectorAll(".reveal").forEach(el => io.observe(el));

// live counts in the "Hello" stats
document.querySelectorAll("[data-count]").forEach(async el => {
  const list = await loadContent(el.dataset.count);
  if (!list.length) return;
  const counted = el.classList.contains("in");
  el.dataset.end = list.length;
  if (counted) el.textContent = list.length;
});

// 7) Projects (home: featured rows; projects page: grid cards)
function links(p) {
  const gh = safeUrl(p.github) ? `<a class="btn btn-ink btn-sm" href="${esc(safeUrl(p.github))}" target="_blank" rel="noreferrer"><i class="fa-brands fa-github"></i>View Code</a>` : "";
  const demo = safeUrl(p.demo) ? `<a class="btn btn-orange btn-sm" href="${esc(safeUrl(p.demo))}" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>Live</a>` : "";
  return gh || demo ? `<div class="project-links">${gh}${demo}</div>` : "";
}
const tagsHtml = p => `<div class="project-tags">${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;

function projectRow(p, i) {
  return `
    <div class="project-row ${i % 2 ? "flip" : ""} reveal">
      <div class="project-media">
        <img src="${esc(safeUrl(p.image))}" alt="${esc(p.title)}" loading="lazy">
        <span class="project-num">${String(i + 1).padStart(2, "0")}</span>
      </div>
      <div class="project-body">
        <span class="project-tag">${esc((p.tags || [])[0] || "Project")}${p.period ? " · " + esc(p.period) : ""}</span>
        <h3 class="project-title">${esc(p.title)}</h3>
        <p class="mini-text">${esc(p.short)}</p>
        ${tagsHtml(p)}
        ${links(p)}
      </div>
    </div>`;
}
function projectCard(p, i) {
  return `
    <div class="col-md-6 col-lg-4 reveal" data-delay="${(i % 3) + 1}">
      <article class="project-card">
        <div class="project-media">
          <img src="${esc(safeUrl(p.image))}" alt="${esc(p.title)}" loading="lazy">
          ${p.period ? `<span class="project-period">${esc(p.period)}</span>` : ""}
        </div>
        <div class="project-body">
          <h5 class="project-title">${esc(p.title)}</h5>
          <p class="mini-text">${esc(p.short)}</p>
          ${tagsHtml(p)}
          ${links(p)}
        </div>
      </article>
    </div>`;
}
async function renderProjects(targetId, onlyFeatured) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  let projects = await loadContent("projects");
  if (onlyFeatured) {
    projects = projects.filter(p => p.featured).slice(0, 6);
    wrap.innerHTML = projects.map(projectRow).join("");
  } else {
    wrap.innerHTML = projects.map(projectCard).join("");
  }
  observeNew(wrap);
}
renderProjects("featuredProjects", true);
renderProjects("allProjects", false);

// 8) Awards page
async function renderAwards() {
  const wrap = document.getElementById("awardsList");
  if (!wrap) return;
  const awards = await loadContent("awards");
  const icons = ["fa-trophy", "fa-medal", "fa-award", "fa-star", "fa-hands-helping", "fa-users", "fa-microphone", "fa-lightbulb", "fa-globe", "fa-graduation-cap"];
  wrap.innerHTML = awards.map((a, i) => `
    <div class="col-md-6 reveal" data-delay="${(i % 2) + 1}">
      <div class="cardx award-card">
        <div class="award-icon"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
        <div>
          <div class="award-year">${esc(a.period)}</div>
          <h5 class="mini-title mt-1">${esc(a.title)}</h5>
          ${a.org ? `<div class="mini-text"><i class="fa-solid fa-building me-2"></i>${esc(a.org)}</div>` : ""}
          ${a.note ? `<p class="mini-text mt-2">${esc(a.note)}</p>` : ""}
        </div>
      </div>
    </div>`).join("");
  observeNew(wrap);
}
renderAwards();

// 9) Experience timeline + event detail pop-up
const initials = s => {
  const str = String(s || "");
  const inParens = (str.match(/\(([A-Z]{2,})\)/) || [])[1];          // "(BUCC)"
  if (inParens) return inParens;
  const words = str.split(",")[0].split(/\s+/).filter(Boolean);
  const acro = words.find(w => /^[A-Z]{2,}$/.test(w));              // "EUSCIAN", "ESB"
  return acro || words.filter(w => /^[A-Z]/.test(w)).slice(0, 3).map(w => w[0]).join("");
};
const hasDetail = ev => (ev.body && ev.body.trim()) || (ev.photos && ev.photos.length) || ev.link;
let xpData = [];
async function renderExperience() {
  const wrap = document.getElementById("experienceList");
  if (!wrap) return;
  xpData = await loadContent("experience");
  wrap.innerHTML = xpData.map((x, xi) => `
    <article class="xp reveal">
      <aside class="xp-side">
        <div class="xp-logo">${safeUrl(x.logo) ? `<img src="${esc(safeUrl(x.logo))}" alt="">` : `<span class="${initials(x.org).length > 4 ? "long" : ""}">${esc(initials(x.org))}</span>`}</div>
        <div class="xp-when">${esc(x.start)}${x.end ? ` – ${esc(x.end)}` : ""}</div>
        ${x.location ? `<div class="xp-where"><i class="fa-solid fa-location-dot"></i>${esc(x.location)}</div>` : ""}
      </aside>
      <div class="xp-main">
        <div class="xp-head">
          <div>
            <h3 class="xp-role">${esc(x.role)}</h3>
            <div class="xp-org">${esc(x.org)}</div>
          </div>
          ${x.tag ? `<span class="xp-tag">${esc(x.tag)}</span>` : ""}
        </div>
        ${x.summary ? `<div class="xp-summary md">${md(x.summary)}</div>` : ""}
        ${(x.events || []).length ? `
          <div class="xp-events-label">${x.events.length > 1 ? "Events organized" : "Highlight"}</div>
          <div class="xp-events">
            ${x.events.map((ev, ei) => `
              <button type="button" class="ev-card" data-x="${xi}" data-e="${ei}" ${hasDetail(ev) ? "" : 'data-empty="1"'}>
                <span class="ev-img">${safeUrl(ev.cover) ? `<img src="${esc(safeUrl(ev.cover))}" alt="" loading="lazy">` : ""}</span>
                <span class="ev-info">
                  ${ev.date ? `<span class="ev-date">${esc(ev.date)}</span>` : ""}
                  <span class="ev-name">${esc(ev.title)}</span>
                  ${ev.tagline ? `<span class="ev-tagline">${esc(ev.tagline)}</span>` : ""}
                  <span class="ev-more">${hasDetail(ev) ? 'Read the story <i class="fa-solid fa-arrow-right"></i>' : 'View <i class="fa-solid fa-expand"></i>'}</span>
                </span>
              </button>`).join("")}
          </div>` : ""}
      </div>
    </article>`).join("");
  observeNew(wrap);
  wrap.querySelectorAll(".ev-card").forEach(b => b.addEventListener("click", () => openEvent(xpData[b.dataset.x], xpData[b.dataset.x].events[b.dataset.e])));
}
renderExperience();

const modal = document.getElementById("eventModal");
const lightbox = document.getElementById("lightbox");
function openEvent(x, ev) {
  if (!modal) return;
  const cover = safeUrl(ev.cover);
  modal.querySelector(".ev-cover").hidden = !cover;
  document.getElementById("evCover").src = cover;
  document.getElementById("evKicker").textContent = `${x.role} · ${x.org.replace(/\s*\(.*?\)\s*/g, " ").trim()}`;
  document.getElementById("evTitle").textContent = ev.title;
  document.getElementById("evMeta").textContent = [ev.date, ev.tagline].filter(Boolean).join(" · ");
  document.getElementById("evText").innerHTML = ev.body && ev.body.trim() ? md(ev.body) : `<p class="ev-soon">The full story of this event is coming soon.</p>`;
  const link = safeUrl(ev.link);
  if (link) document.getElementById("evText").insertAdjacentHTML("beforeend", `<p><a class="btn btn-ink btn-sm" href="${esc(link)}" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square me-2"></i>Visit</a></p>`);
  const photos = (ev.photos || []).map(safeUrl).filter(Boolean);
  document.getElementById("evGallery").innerHTML = photos.map(p => `<button type="button" class="ev-photo"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join("");
  document.querySelectorAll("#evGallery .ev-photo").forEach(b => b.addEventListener("click", () => {
    lightbox.querySelector("img").src = b.querySelector("img").src;
    lightbox.hidden = false;
  }));
  modal.showModal();
  modal.querySelector(".ev-panel").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
if (modal) {
  const close = () => { modal.close(); };
  modal.addEventListener("close", () => (document.body.style.overflow = ""));
  modal.querySelector(".ev-close").addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
}
if (lightbox) {
  const hide = () => (lightbox.hidden = true);
  lightbox.addEventListener("click", hide);
  addEventListener("keydown", e => { if (e.key === "Escape" && !lightbox.hidden) { e.preventDefault(); hide(); } });
}

// 10) Blog list + single post page
const fmtDate = d => { const t = Date.parse(d); return isNaN(t) ? esc(d || "") : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const byDate = (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
const readMins = t => Math.max(1, Math.round(String(t || "").split(/\s+/).length / 200));
async function renderBlog() {
  const wrap = document.getElementById("blogList");
  if (!wrap) return;
  const posts = (await loadContent("blog")).sort(byDate);
  if (!posts.length) {
    wrap.innerHTML = `<div class="col-12"><div class="cardx empty-state reveal"><i class="fa-solid fa-pen-nib"></i><h5 class="mini-title">Coming Soon</h5><p class="mini-text">Blog posts are on the way. Stay tuned!</p></div></div>`;
  } else {
    wrap.innerHTML = posts.map((p, i) => `
      <div class="col-md-6 col-lg-4 reveal" data-delay="${(i % 3) + 1}">
        <a class="post-card" href="./post.html?slug=${encodeURIComponent(p.slug || p.id)}">
          <span class="post-img">${safeUrl(p.cover) ? `<img src="${esc(safeUrl(p.cover))}" alt="" loading="lazy">` : `<i class="fa-solid fa-pen-nib"></i>`}</span>
          <span class="post-body">
            <span class="post-meta">${fmtDate(p.date)} · ${readMins(p.body)} min read</span>
            <span class="post-title">${esc(p.title)}</span>
            ${p.excerpt ? `<span class="post-excerpt">${esc(p.excerpt)}</span>` : ""}
            <span class="post-more">Read article <i class="fa-solid fa-arrow-right"></i></span>
          </span>
        </a>
      </div>`).join("");
  }
  observeNew(wrap);
}
renderBlog();

async function renderPost() {
  const wrap = document.getElementById("postView");
  if (!wrap) return;
  const slug = new URLSearchParams(location.search).get("slug");
  const posts = await loadContent("blog");
  const p = posts.find(x => (x.slug || x.id) === slug);
  if (!p) {
    wrap.innerHTML = `<div class="cardx empty-state"><i class="fa-solid fa-circle-question"></i><h5 class="mini-title">Post not found</h5><p class="mini-text mb-3">It may have been moved or unpublished.</p><a class="btn btn-ink" href="./blog.html">Back to the blog</a></div>`;
    return;
  }
  document.title = `${p.title} | Yeasin Fiyaz`;
  wrap.innerHTML = `
    <a class="post-back" href="./blog.html"><i class="fa-solid fa-arrow-left me-2"></i>All posts</a>
    <p class="eyebrow mt-4">${fmtDate(p.date)} · ${readMins(p.body)} min read</p>
    <h1 class="post-h1">${esc(p.title)}</h1>
    ${p.excerpt ? `<p class="lead-text">${esc(p.excerpt)}</p>` : ""}
    ${(p.tags || []).length ? `<div class="project-tags mb-4">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    ${safeUrl(p.cover) ? `<img class="post-cover" src="${esc(safeUrl(p.cover))}" alt="">` : ""}
    <div class="md post-content">${md(p.body)}</div>`;
}
renderPost();

// 11) Publications page
async function renderPublications() {
  const wrap = document.getElementById("pubList");
  if (!wrap) return;
  const pubs = (await loadContent("publications")).sort((a, b) => (+b.year || 0) - (+a.year || 0));
  if (!pubs.length) {
    wrap.innerHTML = `<div class="cardx empty-state reveal"><i class="fa-solid fa-flask"></i><h5 class="mini-title">Coming Soon</h5><p class="mini-text mb-4">My research work is in progress. Publications will be listed here once they are out.</p><a class="btn btn-ink" href="./projects.html">Explore my projects instead <i class="fa-solid fa-arrow-right ms-2"></i></a></div>`;
  } else {
    wrap.innerHTML = pubs.map(p => `
      <article class="pub reveal">
        <div class="pub-year">${esc(p.year)}</div>
        <div class="pub-main">
          ${p.type ? `<span class="project-tag">${esc(p.type)}</span>` : ""}
          <h3 class="pub-title">${esc(p.title)}</h3>
          ${p.authors ? `<div class="pub-authors">${esc(p.authors)}</div>` : ""}
          ${p.venue ? `<div class="pub-venue"><i class="fa-solid fa-book-open me-2"></i>${esc(p.venue)}</div>` : ""}
          ${p.abstract ? `<details class="pub-abs"><summary>Abstract</summary><div class="md">${md(p.abstract)}</div></details>` : ""}
          <div class="project-links">
            ${safeUrl(p.link) ? `<a class="btn btn-ink btn-sm" href="${esc(safeUrl(p.link))}" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>Read paper</a>` : ""}
            ${safeUrl(p.pdf) ? `<a class="btn btn-outline btn-sm" href="${esc(safeUrl(p.pdf))}" target="_blank" rel="noreferrer"><i class="fa-solid fa-file-pdf"></i>PDF</a>` : ""}
          </div>
        </div>
      </article>`).join("");
  }
  observeNew(wrap);
}
renderPublications();

// 11b) Site Settings (editable from the admin portal)
const ICONS = {
  python: "fa-brands fa-python", pytorch: "fa-solid fa-fire", tensorflow: "fa-solid fa-network-wired", xgboost: "fa-solid fa-chart-line",
  django: "fa-solid fa-leaf", "django rest": "fa-solid fa-leaf", fastapi: "fa-solid fa-bolt", "spring boot": "fa-brands fa-java", java: "fa-brands fa-java",
  react: "fa-brands fa-react", "node.js": "fa-brands fa-node-js", node: "fa-brands fa-node-js", javascript: "fa-brands fa-js", "java / javascript": "fa-brands fa-js",
  typescript: "fa-brands fa-js", mysql: "fa-solid fa-database", postgresql: "fa-solid fa-server", mongodb: "fa-solid fa-database", redis: "fa-solid fa-layer-group",
  websocket: "fa-solid fa-tower-broadcast", "jwt auth": "fa-solid fa-shield-halved", jwt: "fa-solid fa-shield-halved", git: "fa-brands fa-git-alt", github: "fa-brands fa-github",
  html: "fa-brands fa-html5", css: "fa-brands fa-css3-alt", bootstrap: "fa-brands fa-bootstrap", docker: "fa-brands fa-docker", aws: "fa-brands fa-aws",
  "machine learning": "fa-solid fa-brain", "c / c++": "fa-solid fa-c", "c++": "fa-solid fa-c", c: "fa-solid fa-c", linux: "fa-brands fa-linux",
  excel: "fa-solid fa-table", "power bi": "fa-solid fa-chart-pie", tableau: "fa-solid fa-chart-pie", pandas: "fa-solid fa-table-cells", sql: "fa-solid fa-database",
  gaming: "fa-solid fa-gamepad", aerospace: "fa-solid fa-rocket", cycling: "fa-solid fa-bicycle", leadership: "fa-solid fa-people-group",
  "public speaking": "fa-solid fa-microphone", "event management": "fa-solid fa-calendar-check", teamwork: "fa-solid fa-handshake",
};
const iconFor = name => ICONS[String(name).toLowerCase()] || "fa-solid fa-circle-check";
const setHtml = (id, html) => { const el = document.getElementById(id); if (el && html != null) el.innerHTML = html; };
const inlineMd = t => md(t).replace(/^<p>|<\/p>\s*$/g, "");

async function applySettings() {
  const s = (await loadContent("settings"))[0];
  if (!s) return;
  if (Array.isArray(s.heroRoles) && s.heroRoles.filter(Boolean).length) roles = s.heroRoles.filter(Boolean);
  if (s.heroIntro) setHtml("sHeroIntro", inlineMd(s.heroIntro));
  setHtml("sHeroMeta", [["Currently", s.currently], ["Education", s.educationShort], ["Based in", s.basedIn]].filter(([, v]) => v).map(([k, v]) => `<div>${k}<b>${esc(v)}</b></div>`).join(""));
  if (s.about) setHtml("sAbout", inlineMd(s.about).replace(/<strong>/g, '<strong style="color:#fff">'));
  if (Array.isArray(s.stats) && s.stats.length) {
    const projects = (await loadContent("projects")).length;
    setHtml("sStats", s.stats.map(st => {
      const v = st.auto === "projects" && projects ? projects : (+st.value || 0);
      return `<li><span class="chk"><i class="fa-solid fa-check"></i></span><b class="count" data-end="${v}">0</b><span>${esc(st.label)}</span></li>`;
    }).join(""));
    document.querySelectorAll("#sStats .count").forEach(el => io.observe(el));
  }
  if (s.eduTitle) setHtml("sEduTitle", esc(s.eduTitle));
  if (s.eduText) setHtml("sEduText", esc(s.eduText));
  if (s.school != null) setHtml("sSchool", esc(s.school));
  if (Array.isArray(s.interests)) setHtml("sInterests", s.interests.map(t => `<span class="chip"><i class="${iconFor(t)} me-2"></i>${esc(t)}</span>`).join(""));
  if (Array.isArray(s.softSkills)) setHtml("sSoft", s.softSkills.map(t => `<span class="chip"><i class="${iconFor(t)} me-2"></i>${esc(t)}</span>`).join(""));
  if (Array.isArray(s.tools)) setHtml("sTools", s.tools.map(t => `<div class="tech"><i class="${iconFor(t)}"></i>${esc(t)}</div>`).join(""));
  if (s.aiming) setHtml("sAiming", esc(s.aiming));
  if (Array.isArray(s.skills) && s.skills.length) {
    drawRadar(s.skills);
    const lv = [["Expert", 3], ["Advanced", 2], ["Intermediate", 1], ["Beginner", 0]];
    setHtml("sLevels", lv.map(([name, n]) => {
      const list = s.skills.filter(k => k.level === name);
      if (!list.length) return "";
      const dots = [0, 1, 2].map(i => `<i${i < n ? ' class="on"' : ""}></i>`).join("");
      return `<div class="lvl"><span class="lvl-name"><span class="lvl-dots">${dots}</span>${name}</span><div class="chip-row">${list.map(k => `<span class="chip"><i class="${iconFor(k.name)} me-2"></i>${esc(k.name)}</span>`).join("")}</div></div>`;
    }).join(""));
  }
  if (s.phone) { const a = document.getElementById("sPhone"); if (a) { a.textContent = s.phone; a.href = "tel:" + s.phone.replace(/[^\d+]/g, ""); } }
  if (s.email) {
    const a = document.getElementById("sEmail"); if (a) { a.textContent = s.email; a.href = "mailto:" + s.email; }
    document.querySelectorAll('[data-s="mail"]').forEach(x => (x.href = "mailto:" + s.email));
    CONTACT_EMAIL = s.email;
  }
  if (safeUrl(s.linkedin)) document.querySelectorAll('[data-s="linkedin"]').forEach(x => (x.href = s.linkedin));
  if (safeUrl(s.github)) document.querySelectorAll('[data-s="github"]').forEach(x => (x.href = s.github));
  if (safeUrl(s.cv)) document.querySelectorAll("[data-cv]").forEach(x => (x.href = s.cv));
}
let CONTACT_EMAIL = "yeasinfiyaz@gmail.com";
drawRadar([
  { name: "Python", level: "Expert" }, { name: "Django", level: "Advanced" }, { name: "Machine Learning", level: "Advanced" },
  { name: "C / C++", level: "Intermediate" }, { name: "Java / JavaScript", level: "Advanced" },
]);
applySettings();

// 12) Contact form => mailto
const form = document.getElementById("contactForm");
if (form) {
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const msg = document.getElementById("cMsg").value.trim();
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${msg}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });
}

// 13) Footer year
document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
