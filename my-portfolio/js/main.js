AOS.init({ duration: 700, once: true });
new PureCounter();

// 1) Paste your CV link here (Google Drive / Dropbox / OneDrive share link)
const CV_LINK = "https://drive.google.com/uc?export=download&id=1twtHTj5geSqqibd8J6Qvk490hM08cCRl";

// Set the CV button if it exists
const cvBtn = document.getElementById("cvBtn");
if (cvBtn) cvBtn.href = CV_LINK;

// 2) Hero rotating subtitle
const roles = [
  "BSc. in Computer Science & Engineering",
  "AI Enthusiast • ML/DL",
  "Software Developer",
  "Former Vice President - BUCLC",
  "Django • Spring Boot • REST APIs"
];

let idx = 0;
const roleText = document.getElementById("roleText");

setInterval(() => {
  idx = (idx + 1) % roles.length;
  if (roleText) roleText.textContent = roles[idx];
}, 2200);

// 3) Load featured projects from JSON
async function loadFeaturedProjects() {
  try {
    const res = await fetch("./data/projects.json");
    const projects = await res.json();

    const featured = projects.filter(p => p.featured).slice(0, 6);
    const wrap = document.getElementById("featuredProjects");
    if (!wrap) return;

    wrap.innerHTML = featured.map(p => `
      <div class="col-md-6 col-lg-4">
        <div class="project-card">
          <img class="project-img" src="${p.image}" alt="${p.title}">
          <div class="project-body">
            <h5 class="project-title">${p.title}</h5>
            <div class="mini-text">${p.period}</div>
            <p class="mini-text mt-2">${p.short}</p>

            <div class="project-tags mt-2">
              ${p.tags.map(t => `<span class="tag">${t}</span>`).join("")}
            </div>

            <div class="mt-3 d-flex gap-2 flex-wrap">
              ${p.github ? `<a class="btn btn-sm btn-outline-light" href="${p.github}" target="_blank">GitHub</a>` : ""}
              ${p.demo ? `<a class="btn btn-sm btn-accent" href="${p.demo}" target="_blank">Live</a>` : ""}
            </div>
          </div>
        </div>
      </div>
    `).join("");

  } catch (e) {
    console.error("Project load error:", e);
  }
}
loadFeaturedProjects();

// 4) Contact form => mailto
const form = document.getElementById("contactForm");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const msg = document.getElementById("cMsg").value.trim();

    const to = "yeasinfiyaz@gmail.com";
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${msg}`);

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}
