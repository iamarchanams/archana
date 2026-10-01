(function () {
  "use strict";

  const CONTENT_URL = "content/site-content.json";
  const $app = document.getElementById("app");

  document.getElementById("footerYear").textContent = new Date().getFullYear();

  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.addEventListener("click", (e) => { if (e.target.tagName === "A") navLinks.classList.remove("open"); });

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  const ICONS = {
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>`,
    location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
  };
  function icon(name) { return ICONS[name] || ""; }

  function lazyImg(src, alt, cls) {
    return `<img data-lazy="${esc(src)}" alt="${esc(alt || "")}" class="${cls || ""}" loading="lazy">`;
  }
  function applyLazyLoading(root) {
    const imgs = root.querySelectorAll("img[data-lazy]");
    imgs.forEach((img) => { img.src = img.dataset.lazy; });
  }

  function emptyState(text) {
    return `<div class="empty-note">${esc(text)}</div>`;
  }

  function renderHome(d) {
    return `
    <section id="home" class="hero">
      <div class="container">
        <div>
          <div class="eyebrow">Portfolio</div>
          <h1>${esc(d.name)}</h1>
          <div class="headline">${esc(d.headline)}</div>
          <p class="tagline">${esc(d.tagline)}</p>
          <div class="btn-row">
            <a href="#contact" class="btn btn-primary">${esc(d.ctaContactText || "Get in Touch")}</a>
            ${d.resumeFile ? `<a href="${esc(d.resumeFile)}" class="btn btn-outline" target="_blank" rel="noopener">${esc(d.ctaResumeText || "Download Resume")}</a>` : ""}
          </div>
        </div>
        <div class="hero-photo">${lazyImg(d.photo, d.name)}</div>
      </div>
    </section>`;
  }

  function renderAbout(d) {
    const langs = (d.languages || []).map((l) => `<span class="fact-pill">${esc(l)}</span>`).join("");
    return `
    <section id="about">
      <div class="container">
        <div class="eyebrow">About</div>
        <h2>${esc(d.heading)}</h2>
        <p style="color:var(--text-dim);max-width:70ch">${esc(d.bio)}</p>
        <div class="about-facts">
          ${d.location ? `<span class="fact-pill">${esc(d.location)}</span>` : ""}
          ${langs}
        </div>
      </div>
    </section>`;
  }

  function renderSkills(d) {
    const items = (d.items || []).map((s) => `<li>${esc(s)}</li>`).join("");
    return `
    <section id="skills">
      <div class="container">
        <div class="eyebrow">Skills</div>
        <h2>${esc(d.heading)}</h2>
        <ul class="tag-list" style="margin-top:20px">${items || emptyState("No skills added yet.")}</ul>
      </div>
    </section>`;
  }

  function renderExperience(d) {
    const items = (d.items || []).map((e) => `
      <div class="timeline-item">
        <h3>${esc(e.role)}</h3>
        <div class="timeline-meta">${esc(e.company)}${e.duration ? " · " + esc(e.duration) : ""}</div>
        ${e.description ? `<p>${esc(e.description)}</p>` : ""}
      </div>`).join("");
    return `
    <section id="experience">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">Experience</div>
          <h2>${esc(d.heading)}</h2>
        </div>
        <div class="timeline">${items || emptyState("No experience added yet.")}</div>
      </div>
    </section>`;
  }

  function renderEducation(d) {
    const items = (d.items || []).map((e) => `
      <div class="timeline-item">
        <h3>${esc(e.degree)}</h3>
        <div class="timeline-meta">${esc(e.institution)}${e.year ? " · " + esc(e.year) : ""}${e.score ? " · " + esc(e.score) : ""}</div>
      </div>`).join("");
    return `
    <section id="education">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">Education</div>
          <h2>${esc(d.heading)}</h2>
        </div>
        <div class="timeline">${items || emptyState("No education added yet.")}</div>
      </div>
    </section>`;
  }

  function renderCertifications(d) {
    const items = (d.items || []).map((c) => `
      <div class="cert-card">
        <h3>${esc(c.title)}</h3>
        <div class="meta">${esc(c.institution)}${c.year ? " · " + esc(c.year) : ""}</div>
      </div>`).join("");
    return `
    <section id="certifications">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">Certifications</div>
          <h2>${esc(d.heading)}</h2>
        </div>
        <div class="card-grid">${items || emptyState("No certifications added yet.")}</div>
      </div>
    </section>`;
  }

  function renderAchievements(d) {
    const items = (d.items || []).map((a) => `
      <div class="achieve-card">
        <span class="period">${esc(a.period)}</span>
        <p>${esc(a.summary)}</p>
        <div class="achieve-stats">
          ${a.closings ? `<div class="achieve-stat"><div class="num">${esc(a.closings)}</div><div class="label">Closings</div></div>` : ""}
          ${a.revenue ? `<div class="achieve-stat"><div class="num">${esc(a.revenue)}</div><div class="label">Revenue</div></div>` : ""}
          ${a.dealValue ? `<div class="achieve-stat"><div class="num">${esc(a.dealValue)}</div><div class="label">Deal Value</div></div>` : ""}
        </div>
      </div>`).join("");
    return `
    <section id="achievements">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">Highlights</div>
          <h2>${esc(d.heading)}</h2>
          <p>${esc(d.subheading || "")}</p>
        </div>
        <div class="achieve-grid">${items || emptyState("No highlights added yet.")}</div>
      </div>
    </section>`;
  }

  function renderContact(d) {
    return `
    <section id="contact">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">Contact</div>
          <h2>${esc(d.heading)}</h2>
          <p>${esc(d.subheading || "")}</p>
        </div>
        <div class="contact-grid">
          <a class="contact-card" href="tel:${esc(d.phone)}">
            <div class="icon">${icon("phone")}</div>
            <div class="label">Phone</div>
            <div class="value">${esc(d.phone)}</div>
          </a>
          <a class="contact-card" href="mailto:${esc(d.email)}">
            <div class="icon">${icon("email")}</div>
            <div class="label">Email</div>
            <div class="value">${esc(d.email)}</div>
          </a>
          <div class="contact-card">
            <div class="icon">${icon("location")}</div>
            <div class="label">Location</div>
            <div class="value">${esc(d.location)}</div>
          </div>
        </div>
      </div>
    </section>`;
  }

  const RENDERERS = {
    home: renderHome, about: renderAbout, skills: renderSkills, experience: renderExperience,
    education: renderEducation, certifications: renderCertifications,
    achievements: renderAchievements, contact: renderContact
  };

  function render(content) {
    document.title = content.meta.siteTitle || document.title;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", content.meta.seoDescription || "");
    const favicon = document.getElementById("favicon-link");
    if (favicon && content.meta.favicon) favicon.setAttribute("href", content.meta.favicon);

    const order = content.sectionOrder || Object.keys(RENDERERS);
    const visibility = content.sectionVisibility || {};
    let html = "";
    order.forEach((key) => {
      if (visibility[key] === false) return;
      const renderer = RENDERERS[key];
      if (renderer && content[key]) html += renderer(content[key]);
    });
    $app.innerHTML = html;
    applyLazyLoading($app);
  }

  const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";

  if (isPreview) {
    try {
      const draft = JSON.parse(window.localStorage.getItem("siteContentDraft") || "null");
      if (draft) render(draft);
      else $app.innerHTML = `<div class="container" style="padding-top:100px;text-align:center;color:#5b6b7a">No draft found.</div>`;
    } catch (err) {
      $app.innerHTML = `<div class="container" style="padding-top:100px;text-align:center;color:#5b6b7a">Could not read draft.</div>`;
    }
  } else {
    fetch(CONTENT_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Failed to load content"); return r.json(); })
      .then(render)
      .catch((err) => {
        $app.innerHTML = `<div class="container" style="padding-top:100px;text-align:center;color:#5b6b7a">Content could not be loaded. Please try again shortly.</div>`;
        console.error(err);
      });
  }
})();
