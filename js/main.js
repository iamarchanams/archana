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
    var img = hasPhoto
      ? '<img src="' + esc(mediaUrl(d.photo)) + '" alt="' + esc(d.name) + '" data-hero-photo data-initial="' + esc(initials) + '">'
      : '<div class="monogram" aria-hidden="true">' + esc(initials) + "</div>";
    var anim = d.photoAnimation || "float-glow";
    var cls = "hero-photo style-" + (d.photoStyle || "square") +
      (/float/.test(anim) ? " anim-float" : "") + (/glow/.test(anim) ? " anim-glow" : "");
    var photo = '<div class="' + cls + '"><div class="photo-glow" aria-hidden="true"></div><div class="photo-frame">' + img + "</div></div>";
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
      photo +
    "</div></section>";
  }

  /* ---------- floating quick-contact buttons ---------- */
  var FAB_ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.84 9.84 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>',
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>'
  };

  function renderFloating(contact) {
    var old = document.getElementById("fabDock");
    if (old) old.remove();
    var f = contact.floating;
    if (!f || !f.enabled) return;
    var digits = function (v) { return String(v || "").replace(/[^\d]/g, ""); };
    var items = [];
    if (f.whatsapp.enabled) {
      var wa = digits(f.whatsapp.number || contact.phone);
      if (wa) items.push({ cls: "fab-whatsapp", label: "WhatsApp", icon: FAB_ICONS.whatsapp, ext: true,
        href: "https://wa.me/" + wa + (f.whatsapp.message ? "?text=" + encodeURIComponent(f.whatsapp.message) : "") });
    }
    if (f.call.enabled) {
      var raw = String(f.call.number || contact.phone || "").replace(/[^\d+]/g, "");
      if (raw) items.push({ cls: "fab-call", label: "Call", icon: FAB_ICONS.call, href: "tel:" + raw });
    }
    if (f.email.enabled) {
      var mail = String(f.email.address || contact.email || "").trim();
      if (mail) items.push({ cls: "fab-email", label: "Email", icon: FAB_ICONS.email,
        href: "mailto:" + mail + (f.email.subject ? "?subject=" + encodeURIComponent(f.email.subject) : "") });
    }
    if (!items.length) return;
    var dock = document.createElement("div");
    dock.id = "fabDock";
    dock.className = "fab-dock fab-" + f.position;
    dock.innerHTML = items.map(function (it) {
      return '<a class="fab ' + it.cls + '" href="' + esc(it.href) + '"' + (it.ext ? ' target="_blank" rel="noopener"' : "") +
        ' aria-label="' + it.label + '"><span class="fab-tip">' + it.label + "</span>" + it.icon + "</a>";
    }).join("");
    document.body.appendChild(dock);
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
    renderFloating(content.contact);

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
