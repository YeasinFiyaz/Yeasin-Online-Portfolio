/* ===== Yeasin Fiyaz Portfolio — main.js ===== */

// 1) CV link (Google Drive / Dropbox / OneDrive share link)
const CV_LINK = "https://drive.google.com/uc?export=download&id=1twtHTj5geSqqibd8J6Qvk490hM08cCRl";
document.querySelectorAll("[data-cv]").forEach(a => (a.href = CV_LINK));

// 2) Navbar: solid on scroll + active link highlight + close on tap (mobile)
const nav = document.querySelector(".nav-blur");
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

  const top = document.querySelector(".to-top");
  if (top) top.classList.toggle("show", y > 500);

  if (sections.length) {
    let current = sections[0];
    for (const s of sections) if (s.offsetTop - 140 <= y) current = s;
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

// 3) Cursor glow (desktop)
const glow = document.querySelector(".cursor-glow");
if (glow && matchMedia("(hover:hover)").matches) {
  addEventListener("pointermove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  }, { passive: true });
}

// 4) Typewriter for hero roles
const roles = [
  "BSc in Computer Science & Engineering",
  "AI / Machine Learning Enthusiast",
  "Software Developer",
  "Former Vice President — BUCLC",
  "Django • Spring Boot • REST APIs"
];
const roleText = document.getElementById("roleText");
if (roleText) {
  let r = 0, c = 0, deleting = false;
  const tick = () => {
    const word = roles[r];
    c += deleting ? -1 : 1;
    roleText.textContent = word.slice(0, c);
    let delay = deleting ? 38 : 70;
    if (!deleting && c === word.length) { delay = 1800; deleting = true; }
    else if (deleting && c === 0) { deleting = false; r = (r + 1) % roles.length; delay = 350; }
    setTimeout(tick, delay);
  };
  tick();
}

// 5) Reveal-on-scroll, counters and skill bars
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    el.classList.add("in");

    if (el.classList.contains("count")) {
      const end = +el.dataset.end, t0 = performance.now(), dur = 1400;
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

// 6) 3D tilt on cards
function enableTilt(selector) {
  if (!matchMedia("(hover:hover)").matches) return;
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-6px)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}
enableTilt(".profile-ring");

// 7) Project cards (shared by index + projects page)
function projectCard(p, i) {
  const gh = p.github ? `<a class="btn btn-sm btn-outline-light" href="${p.github}" target="_blank" rel="noreferrer"><i class="fa-brands fa-github"></i>Code</a>` : "";
  const demo = p.demo ? `<a class="btn btn-sm btn-accent" href="${p.demo}" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>Live</a>` : "";
  return `
    <div class="col-md-6 col-lg-4 reveal" data-delay="${(i % 3) + 1}">
      <article class="project-card">
        <div class="project-media">
          <span class="project-period">${p.period}</span>
          <img class="project-img" src="${p.image}" alt="${p.title}" loading="lazy">
          <span class="project-num">${String(i + 1).padStart(2, "0")}</span>
        </div>
        <div class="project-body">
          <h5 class="project-title">${p.title}</h5>
          <p class="mini-text">${p.short}</p>
          <div class="project-tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
          ${gh || demo ? `<div class="project-links">${gh}${demo}</div>` : ""}
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
    if (onlyFeatured) projects = projects.filter(p => p.featured).slice(0, 6);
    wrap.innerHTML = projects.map(projectCard).join("");
    wrap.querySelectorAll(".reveal").forEach(el => io.observe(el));
    enableTilt(".project-card");
  } catch (e) {
    console.error("Project load error:", e);
  }
}
loadProjects("featuredProjects", true);
loadProjects("allProjects", false);

// 8) Awards page
async function loadAwards() {
  const wrap = document.getElementById("awardsList");
  if (!wrap) return;
  const res = await fetch("./data/awards.json");
  const awards = await res.json();
  const icons = ["fa-trophy", "fa-medal", "fa-award", "fa-star", "fa-hands-helping", "fa-users", "fa-microphone", "fa-lightbulb", "fa-globe", "fa-graduation-cap"];
  wrap.innerHTML = awards.map((a, i) => `
    <div class="col-md-6 reveal" data-delay="${(i % 2) + 1}">
      <div class="cardx cardx-glow award-card">
        <div class="award-icon"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
        <div>
          <div class="award-year">${a.period}</div>
          <h5 class="mini-title mt-1">${a.title}</h5>
          ${a.org ? `<div class="mini-text"><i class="fa-solid fa-building me-2"></i>${a.org}</div>` : ""}
          ${a.note ? `<p class="mini-text mt-2">${a.note}</p>` : ""}
        </div>
      </div>
    </div>`).join("");
  wrap.querySelectorAll(".reveal").forEach(el => io.observe(el));
}
loadAwards();

// 9) Contact form => mailto
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

// 10) Footer year
document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
