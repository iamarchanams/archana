(function () {
  "use strict";

  var CONTENT_URL = "content/site-content.json";
  var cfg = window.SITE_CONFIG || {};
  var $app = document.getElementById("app");
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isPreview = new URLSearchParams(window.location.search).get("preview") === "1";

  document.getElementById("footerYear").textContent = new Date().getFullYear();

  /* ---------- helpers ---------- */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Uploaded files live in the repo. In the admin preview they may not be deployed yet,
  // so fetch them straight from GitHub there.
  function mediaUrl(path) {
    if (!path) return "";
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    if (isPreview && cfg.GITHUB_REPO) return "https://raw.githubusercontent.com/" + cfg.GITHUB_REPO + "/main/" + path;
    return path;
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https?:\/\/|mailto:|tel:|media\/|\.\/|\/)/i.test(u) ? u : (u ? "https://" + u : "");
  }
  function empty(text) { return '<div class="empty-note">' + esc(text) + "</div>"; }
  function reveal(i) { return 'reveal" style="--d:' + Math.min(i, 8) * 70 + 'ms'; }

  var ICONS = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
  };

  var NAV_LABELS = {
    home: "Home", about: "About", skills: "Skills", experience: "Experience", education: "Education",
    certifications: "Certifications", achievements: "Highlights", gallery: "Gallery", contact: "Contact"
  };

  // Images that can be opened in the lightbox are collected here while rendering.
  var lightboxItems = [];
  function thumb(src, title, desc, alt) {
    if (!src) return "";
    var idx = lightboxItems.push({ src: mediaUrl(src), title: title || "", desc: desc || "" }) - 1;
    return '<button type="button" class="thumb" data-lb="' + idx + '" aria-label="View larger: ' + esc(title || alt || "image") + '">' +
      '<img src="' + esc(mediaUrl(src)) + '" alt="' + esc(alt || title || "") + '" loading="lazy"></button>';
  }

  /* ---------- section renderers ---------- */
  function renderHome(d) {
    var hasPhoto = d.photo && !/PLACEHOLDER/i.test(d.photo);
    var initials = (d.name || "A").trim().charAt(0).toUpperCase();
    var photo = hasPhoto
      ? '<img src="' + esc(mediaUrl(d.photo)) + '" alt="' + esc(d.name) + '" data-hero-photo data-initial="' + esc(initials) + '">'
      : '<div class="monogram" aria-hidden="true">' + esc(initials) + "</div>";
    return '<section id="home" class="hero"><div class="container">' +
      '<div class="hero-copy">' +
        '<div class="eyebrow">Portfolio</div>' +
        "<h1>" + esc(d.name) + "</h1>" +
        '<div class="headline">' + esc(d.headline) + "</div>" +
        '<p class="tagline">' + esc(d.tagline) + "</p>" +
        '<div class="btn-row">' +
          '<a href="#contact" class="btn btn-primary">' + esc(d.ctaContactText || "Get in Touch") + "</a>" +
          (d.resumeFile ? '<a href="' + esc(mediaUrl(d.resumeFile)) + '" class="btn btn-outline" target="_blank" rel="noopener">' + esc(d.ctaResumeText || "Download Resume") + "</a>" : "") +
        "</div>" +
      "</div>" +
      '<div class="hero-photo">' + photo + "</div>" +
    "</div></section>";
  }

  function renderAbout(d) {
    var langs = d.languages.map(function (l) { return '<span class="fact-pill">' + esc(l) + "</span>"; }).join("");
    return '<section id="about"><div class="container ' + reveal(0) + '">' +
      '<div class="eyebrow">About</div><h2>' + esc(d.heading) + "</h2>" +
      '<p class="about-bio">' + esc(d.bio) + "</p>" +
      '<div class="about-facts">' + (d.location ? '<span class="fact-pill">' + esc(d.location) + "</span>" : "") + langs + "</div>" +
    "</div></section>";
  }

  function renderSkills(d) {
    var items = d.items.filter(Boolean).map(function (s, i) { return "<li class=\"" + reveal(i) + "\">" + esc(s) + "</li>"; }).join("");
    return '<section id="skills"><div class="container">' +
      '<div class="eyebrow">Skills</div><h2>' + esc(d.heading) + "</h2>" +
      (items ? '<ul class="tag-list">' + items + "</ul>" : empty("No skills added yet.")) +
    "</div></section>";
  }

  function renderExperience(d) {
    var items = d.items.map(function (e, i) {
      var points = e.points.filter(Boolean);
      return '<div class="timeline-item ' + reveal(i) + '">' +
        "<h3>" + esc(e.role) + "</h3>" +
        '<div class="timeline-meta">' + esc(e.company) + (e.duration ? " · " + esc(e.duration) : "") + "</div>" +
        (e.description ? "<p>" + esc(e.description) + "</p>" : "") +
        (points.length ? "<ul>" + points.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "") +
        (e.image ? '<div class="proof">' + thumb(e.image, e.role + (e.company ? " — " + e.company : ""), "Proof of employment", e.role + " proof") + '<span class="proof-label">Proof · tap to view</span></div>' : "") +
      "</div>";
    }).join("");
    return '<section id="experience"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Experience</div><h2>' + esc(d.heading) + "</h2></div>" +
      '<div class="timeline">' + (items || empty("No experience added yet.")) + "</div>" +
    "</div></section>";
  }

  function renderEducation(d) {
    var items = d.items.map(function (e, i) {
      return '<div class="timeline-item ' + reveal(i) + '">' +
        "<h3>" + esc(e.degree) + "</h3>" +
        '<div class="timeline-meta">' + esc(e.institution) + (e.year ? " · " + esc(e.year) : "") + (e.score ? " · " + esc(e.score) : "") + "</div>" +
      "</div>";
    }).join("");
    return '<section id="education"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Education</div><h2>' + esc(d.heading) + "</h2></div>" +
      '<div class="timeline">' + (items || empty("No education added yet.")) + "</div>" +
    "</div></section>";
  }

  function renderCertifications(d) {
    var items = d.items.map(function (c, i) {
      var meta = [c.institution, c.year].filter(Boolean).map(esc).join(" · ");
      return '<article class="card ' + reveal(i) + '">' +
        thumb(c.image, c.title, [c.institution, c.year].filter(Boolean).join(" · "), c.title + " certificate") +
        '<div class="card-body"><h3>' + esc(c.title) + "</h3>" +
        (meta ? '<div class="meta">' + meta + "</div>" : "") +
        (c.description ? '<p class="desc">' + esc(c.description) + "</p>" : "") +
        (c.credentialUrl ? '<a class="link" href="' + esc(safeUrl(c.credentialUrl)) + '" target="_blank" rel="noopener">View credential</a>' : "") +
        "</div></article>";
    }).join("");
    return '<section id="certifications"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Certifications</div><h2>' + esc(d.heading) + "</h2></div>" +
      '<div class="card-grid">' + (items || empty("No certifications added yet.")) + "</div>" +
    "</div></section>";
  }

  function renderAchievements(d) {
    var items = d.items.map(function (a, i) {
      var metrics = a.metrics.filter(function (m) { return m && (m.value || m.label); }).map(function (m) {
        return '<div class="achieve-stat"><div class="num" data-count>' + esc(m.value) + '</div><div class="label">' + esc(m.label) + "</div></div>";
      }).join("");
      return '<article class="card achieve-card ' + reveal(i) + '">' +
        thumb(a.image, a.title || a.period, a.summary, a.title || a.period) +
        '<div class="card-body">' +
          (a.period ? '<span class="period">' + esc(a.period) + "</span>" : "") +
          (a.title ? "<h3>" + esc(a.title) + "</h3>" : "") +
          (a.summary ? "<p>" + esc(a.summary) + "</p>" : "") +
          (metrics ? '<div class="achieve-stats">' + metrics + "</div>" : "") +
        "</div></article>";
    }).join("");
    return '<section id="achievements"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Highlights</div><h2>' + esc(d.heading) + "</h2>" +
      (d.subheading ? "<p>" + esc(d.subheading) + "</p>" : "") + "</div>" +
      '<div class="achieve-grid">' + (items || empty("No highlights added yet.")) + "</div>" +
    "</div></section>";
  }

  function renderGallery(d) {
    var items = d.items.filter(function (g) { return g.image; }).map(function (g, i) {
      return '<figure class="card gallery-card ' + reveal(i) + '">' +
        thumb(g.image, g.title, g.description, g.title) +
        '<div class="card-body">' +
          (g.date ? '<span class="date">' + esc(g.date) + "</span>" : "") +
          (g.title ? "<h3>" + esc(g.title) + "</h3>" : "") +
          (g.description ? '<p class="desc">' + esc(g.description) + "</p>" : "") +
        "</div></figure>";
    }).join("");
    return '<section id="gallery"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Gallery</div><h2>' + esc(d.heading) + "</h2>" +
      (d.subheading ? "<p>" + esc(d.subheading) + "</p>" : "") + "</div>" +
      '<div class="gallery-grid">' + (items || empty("No images added yet.")) + "</div>" +
    "</div></section>";
  }

  function renderContact(d) {
    var socials = d.socials.filter(function (s) { return s && s.url; }).map(function (s) {
      return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.label || s.url) + "</a>";
    }).join("");
    return '<section id="contact"><div class="container">' +
      '<div class="section-head"><div class="eyebrow">Contact</div><h2>' + esc(d.heading) + "</h2>" +
      (d.subheading ? "<p>" + esc(d.subheading) + "</p>" : "") + "</div>" +
      '<div class="contact-grid">' +
        (d.phone ? '<a class="contact-card ' + reveal(0) + '" href="tel:' + esc(d.phone.replace(/\s/g, "")) + '"><div class="icon">' + ICONS.phone + '</div><div class="label">Phone</div><div class="value">' + esc(d.phone) + "</div></a>" : "") +
        (d.email ? '<a class="contact-card ' + reveal(1) + '" href="mailto:' + esc(d.email) + '"><div class="icon">' + ICONS.email + '</div><div class="label">Email</div><div class="value">' + esc(d.email) + "</div></a>" : "") +
        (d.location ? '<div class="contact-card ' + reveal(2) + '"><div class="icon">' + ICONS.location + '</div><div class="label">Location</div><div class="value">' + esc(d.location) + "</div></div>" : "") +
      "</div>" +
      (socials ? '<div class="socials">' + socials + "</div>" : "") +
    "</div></section>";
  }

  var RENDERERS = {
    home: renderHome, about: renderAbout, skills: renderSkills, experience: renderExperience,
    education: renderEducation, certifications: renderCertifications,
    achievements: renderAchievements, gallery: renderGallery, contact: renderContact
  };

  /* ---------- page render ---------- */
  function render(raw) {
    var content = window.normalizeContent(raw);
    lightboxItems = [];

    document.title = content.meta.siteTitle || document.title;
    var descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", content.meta.seoDescription || "");
    var favicon = document.getElementById("favicon-link");
    if (favicon && content.meta.favicon) favicon.setAttribute("href", mediaUrl(content.meta.favicon));
    var name = content.home.name || "Portfolio";
    document.getElementById("navBrand").textContent = name;
    document.getElementById("footerName").textContent = name;

    var visible = content.sectionOrder.filter(function (key) {
      if (key === "gallery" && !content.gallery.items.some(function (g) { return g.image; })) return false; // nothing to show yet
      return content.sectionVisibility[key] !== false && RENDERERS[key] && content[key];
    });
    $app.innerHTML = visible.map(function (key) { return RENDERERS[key](content[key]); }).join("");

    // nav only lists sections that are actually shown
    document.getElementById("navLinks").innerHTML = visible.map(function (key) {
      return '<li><a href="#' + key + '" data-nav="' + key + '">' + NAV_LABELS[key] + "</a></li>";
    }).join("");

    afterRender();
  }

  /* ---------- behaviours ---------- */
  var revealObserver, navObserver;

  function countUp(el) {
    var text = el.textContent;
    var m = text.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/);
    if (!m || reduceMotion) return;
    var target = parseFloat(m[2].replace(/,/g, ""));
    if (!isFinite(target) || target <= 0) return;
    var hasComma = m[2].indexOf(",") > -1, decimals = (m[2].split(".")[1] || "").length;
    var start = performance.now(), dur = 900;
    function fmt(n) {
      var s = decimals ? n.toFixed(decimals) : String(Math.round(n));
      return hasComma ? Number(s).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s;
    }
    el.setAttribute("aria-label", text);
    (function tick(now) {
      var t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = m[1] + fmt(target * eased) + m[3];
      if (t < 1) requestAnimationFrame(tick); else el.textContent = text;
    })(start);
  }

  function afterRender() {
    if (revealObserver) revealObserver.disconnect();
    if (navObserver) navObserver.disconnect();

    var revealEls = $app.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    } else {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          e.target.querySelectorAll("[data-count]").forEach(countUp);
          revealObserver.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }

    if ("IntersectionObserver" in window) {
      navObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          document.querySelectorAll(".nav-links a").forEach(function (a) {
            a.classList.toggle("active", a.dataset.nav === e.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      $app.querySelectorAll("section[id]").forEach(function (s) { navObserver.observe(s); });
    }
  }

  // broken hero photo -> initial; broken thumbnails disappear instead of showing a broken icon
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;
    if (img.hasAttribute("data-hero-photo")) {
      var m = document.createElement("div");
      m.className = "monogram"; m.textContent = img.dataset.initial || "A";
      img.replaceWith(m);
    } else if (img.closest(".thumb")) {
      img.closest(".thumb").style.display = "none";
    }
  }, true);

  /* theme */
  document.getElementById("themeToggle").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    setTimeout(function () { root.classList.remove("theme-switching"); }, 400);
  });

  /* mobile nav */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  navToggle.addEventListener("click", function () {
    var open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open);
  });
  navLinks.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { navLinks.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); }
  });

  /* scroll progress */
  var bar = document.getElementById("scrollProgress"), ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ")";
      ticking = false;
    });
  }, { passive: true });

  /* lightbox */
  var lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), lbCap = document.getElementById("lbCaption");
  var lbIndex = 0, lastFocus = null;
  function showLb(i) {
    if (!lightboxItems.length) return;
    lbIndex = (i + lightboxItems.length) % lightboxItems.length;
    var it = lightboxItems[lbIndex];
    lbImg.src = it.src; lbImg.alt = it.title;
    lbCap.innerHTML = (it.title ? "<strong>" + esc(it.title) + "</strong>" : "") + (it.desc ? "<span>" + esc(it.desc) + "</span>" : "");
    var many = lightboxItems.length > 1;
    document.getElementById("lbPrev").style.display = many ? "" : "none";
    document.getElementById("lbNext").style.display = many ? "" : "none";
  }
  function openLb(i) { lastFocus = document.activeElement; showLb(i); lb.classList.add("open"); document.body.style.overflow = "hidden"; document.getElementById("lbClose").focus(); }
  function closeLb() { lb.classList.remove("open"); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  $app.addEventListener("click", function (e) {
    var t = e.target.closest("[data-lb]");
    if (t) openLb(parseInt(t.dataset.lb, 10));
  });
  document.getElementById("lbClose").addEventListener("click", closeLb);
  document.getElementById("lbPrev").addEventListener("click", function () { showLb(lbIndex - 1); });
  document.getElementById("lbNext").addEventListener("click", function () { showLb(lbIndex + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") showLb(lbIndex - 1);
    if (e.key === "ArrowRight") showLb(lbIndex + 1);
  });

  /* ---------- load ---------- */
  function message(text) { $app.innerHTML = '<div class="loading">' + esc(text) + "</div>"; }

  if (isPreview) {
    try {
      var draft = JSON.parse(window.localStorage.getItem("siteContentDraft") || "null");
      if (draft) render(draft); else message("No draft found.");
    } catch (err) { message("Could not read draft."); }
  } else {
    fetch(CONTENT_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("Failed to load content"); return r.json(); })
      .then(render)
      .catch(function (err) { message("Content could not be loaded. Please try again shortly."); console.error(err); });
  }
})();
