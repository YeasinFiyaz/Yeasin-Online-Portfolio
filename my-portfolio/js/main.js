/* ===== Yeasin Fiyaz Portfolio — main.js ===== */

// 1) CV link (Google Drive / Dropbox / OneDrive share link)
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

// 4) Hero: split letters for staggered entrance + gentle parallax
document.querySelectorAll(".hero-line").forEach((line, li) => {
  // words become .w boxes (spaced evenly), letters inside animate one by one
  const html = [...line.childNodes].map(n => {
    const cls = n.nodeType === 1 && n.className ? ` class="${n.className}"` : "";
    return [...n.textContent].map(ch => ch === " " ? "</span><span class=\"w\">" : `<span${cls}>${ch}</span>`).join("");
  }).join("");
  line.innerHTML = `<span class="w">${html}</span>`;
  line.querySelectorAll("span").forEach((s, i) => (s.style.animationDelay = (0.25 + li * 0.25 + i * 0.045) + "s"));
});
const heroText = document.querySelector(".hero-text"), heroPerson = document.querySelector(".hero-person");
if (heroText && matchMedia("(hover:hover)").matches) {
  addEventListener("pointermove", e => {
    const x = (e.clientX / innerWidth - 0.5), y = (e.clientY / innerHeight - 0.5);
    heroText.style.transform = `translate(${x * -14}px, ${y * -8}px)`;
    if (heroPerson) heroPerson.style.marginLeft = (x * 10) + "px";
  }, { passive: true });
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

// 6) Projects (home: featured rows; projects page: grid cards)
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function links(p) {
  const gh = p.github ? `<a class="btn btn-ink btn-sm" href="${esc(p.github)}" target="_blank" rel="noreferrer"><i class="fa-brands fa-github"></i>View Code</a>` : "";
  const demo = p.demo ? `<a class="btn btn-orange btn-sm" href="${esc(p.demo)}" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>Live</a>` : "";
  return gh || demo ? `<div class="project-links">${gh}${demo}</div>` : "";
}
const tagsHtml = p => `<div class="project-tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;

function projectRow(p, i) {
  return `
    <div class="project-row ${i % 2 ? "flip" : ""} reveal">
      <div class="project-media">
        <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">
        <span class="project-num">${String(i + 1).padStart(2, "0")}</span>
      </div>
      <div class="project-body">
        <span class="project-tag">${esc(p.tags[0] || "Project")} · ${esc(p.period)}</span>
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
          <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">
          <span class="project-period">${esc(p.period)}</span>
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
async function loadProjects(targetId, onlyFeatured) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  try {
    const res = await fetch("./data/projects.json");
    let projects = await res.json();
    if (onlyFeatured) {
      projects = projects.filter(p => p.featured).slice(0, 4);
      wrap.innerHTML = projects.map(projectRow).join("");
    } else {
      wrap.innerHTML = projects.map(projectCard).join("");
    }
    wrap.querySelectorAll(".reveal").forEach(el => io.observe(el));
  } catch (e) {
    console.error("Project load error:", e);
  }
}
loadProjects("featuredProjects", true);
loadProjects("allProjects", false);

// 7) Awards page
async function loadAwards() {
  const wrap = document.getElementById("awardsList");
  if (!wrap) return;
  const res = await fetch("./data/awards.json");
  const awards = await res.json();
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
  wrap.querySelectorAll(".reveal").forEach(el => io.observe(el));
}
loadAwards();

// 8) Contact form => mailto
const form = document.getElementById("contactForm");
if (form) {
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const msg = document.getElementById("cMsg").value.trim();
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${msg}`);
    window.location.href = `mailto:yeasinfiyaz@gmail.com?subject=${subject}&body=${body}`;
  });
}

// 9) Footer year
document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
