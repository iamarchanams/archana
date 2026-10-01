(function () {
  "use strict";

  const API_BASE = (window.SITE_CONFIG && window.SITE_CONFIG.API_BASE_URL) || "";
  const GITHUB_REPO = (window.SITE_CONFIG && window.SITE_CONFIG.GITHUB_REPO) || "";
  const CONTENT_URL = "../content/site-content.json";

  function rawUrl(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`;
  }

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginError = document.getElementById("loginError");
  const userLabel = document.getElementById("userLabel");
  const sectionNav = document.getElementById("sectionNav");
  const sectionContent = document.getElementById("sectionContent");
  const publishStatus = document.getElementById("publishStatus");

  const SECTION_LABELS = {
    home: "Home", about: "About", skills: "Skills", experience: "Experience",
    education: "Education", certifications: "Certifications",
    achievements: "Highlights", contact: "Contact"
  };

  let draft = null;
  let activeSection = "home";

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = "include";
    return fetch(API_BASE + path, opts);
  }

  async function checkSession() {
    try {
      const res = await api("/api/auth/session");
      if (res.status === 200) return !!(await res.json()).authenticated;
    } catch (err) { /* network / not configured yet */ }
    return false;
  }

  document.getElementById("pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    if (!API_BASE || API_BASE.includes("YOUR-API-DEPLOYMENT")) {
      loginError.textContent = "The admin API is not configured yet. See README setup instructions.";
      return;
    }
    const pin = document.getElementById("pinInput").value;
    if (!pin) return;
    try {
      const res = await api("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        loginError.textContent = data.error || "Login failed.";
        return;
      }
      window.location.reload();
    } catch (err) {
      loginError.textContent = "Could not reach the admin API. Check your internet connection or the API deployment.";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.reload();
  });

  (async function boot() {
    const authenticated = await checkSession();
    if (!authenticated) {
      loginView.classList.remove("hidden");
      dashboardView.classList.add("hidden");
      return;
    }
    userLabel.textContent = "Signed in";
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    await loadContent();
  })();

  async function loadContent() {
    sectionContent.innerHTML = `<div class="empty-note">Loading content…</div>`;
    try {
      const res = await fetch(CONTENT_URL + "?v=" + Date.now(), { cache: "no-store" });
      draft = await res.json();
    } catch (err) {
      sectionContent.innerHTML = `<div class="empty-note">Could not load content/site-content.json.</div>`;
      return;
    }
    renderSidebar();
    renderSection(activeSection);
  }

  function renderSidebar() {
    const order = draft.sectionOrder;
    sectionNav.innerHTML = order.map((key, idx) => {
      const visible = draft.sectionVisibility[key] !== false;
      return `
      <div class="nav-item ${key === activeSection ? "active" : ""}" data-key="${key}">
        <span class="nav-label" data-select="${key}">${SECTION_LABELS[key] || key}</span>
        <span class="order-btns">
          <button data-move="up" data-key="${key}" ${idx === 0 ? "disabled" : ""}>&#8593;</button>
          <button data-move="down" data-key="${key}" ${idx === order.length - 1 ? "disabled" : ""}>&#8595;</button>
        </span>
        <span class="vis-toggle ${visible ? "" : "off"}" data-toggle-vis="${key}">${visible ? "Shown" : "Hidden"}</span>
      </div>`;
    }).join("") + `
      <div class="nav-item ${activeSection === "__media__" ? "active" : ""}" style="margin-top:14px;border-top:1px solid var(--line);padding-top:16px">
        <span class="nav-label" data-select="__media__">🗑 Media Library</span>
      </div>`;

    sectionNav.querySelectorAll("[data-select]").forEach((el) => {
      el.addEventListener("click", () => {
        activeSection = el.dataset.select;
        renderSidebar();
        activeSection === "__media__" ? renderMediaLibrary() : renderSection(activeSection);
      });
    });
    sectionNav.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const dir = btn.dataset.move;
        const i = draft.sectionOrder.indexOf(key);
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= draft.sectionOrder.length) return;
        [draft.sectionOrder[i], draft.sectionOrder[j]] = [draft.sectionOrder[j], draft.sectionOrder[i]];
        renderSidebar();
      });
    });
    sectionNav.querySelectorAll("[data-toggle-vis]").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.toggleVis;
        draft.sectionVisibility[key] = draft.sectionVisibility[key] === false ? true : false;
        renderSidebar();
      });
    });
  }

  function field(label, value, onChange, type) {
    type = type || "text";
    const id = "f_" + Math.random().toString(36).slice(2);
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    wrap.innerHTML = `<label for="${id}">${label}</label>` +
      (type === "textarea" ? `<textarea id="${id}"></textarea>` : `<input id="${id}" type="${type}">`);
    const input = wrap.querySelector("#" + id);
    input.value = value == null ? "" : value;
    input.addEventListener("input", () => onChange(input.value));
    return wrap;
  }

  function mediaField(label, value, onChange, kind) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    const id = "u_" + Math.random().toString(36).slice(2);
    const isLocalFile = value && !value.startsWith("http");
    let previewHtml = "";
    if (value && isLocalFile) previewHtml = `<img class="media-preview" src="${rawUrl(value)}" onerror="this.style.display='none'">`;
    wrap.innerHTML = `
      <label>${label}</label>
      ${previewHtml}
      <div class="media-uploader" id="${id}">Click to upload ${kind === "file" ? "a file" : "image"}</div>
      <input type="file" accept="${kind === "file" ? "*/*" : "image/*"}" style="display:none" id="${id}_file">
      <div class="upload-progress" id="${id}_status"></div>
    `;
    const uploader = wrap.querySelector("#" + id);
    const fileInput = wrap.querySelector("#" + id + "_file");
    const statusEl = wrap.querySelector("#" + id + "_status");
    uploader.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      statusEl.textContent = "Uploading…";
      try {
        const path = await uploadFile(file, "image");
        onChange(path);
        statusEl.textContent = "Uploaded ✓";
        renderSection(activeSection);
      } catch (err) {
        statusEl.textContent = "Upload failed: " + err.message;
      }
    });
    return wrap;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile(file, kind) {
    const MAX_MB = 8;
    if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File exceeds ${MAX_MB}MB.`);
    const base64 = await fileToBase64(file);
    const folder = "media/images";
    const safeName = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");
    const path = `${folder}/${safeName}`;
    const res = await api("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, contentType: file.type, dataBase64: base64 })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "upload failed");
    }
    return (await res.json()).path || path;
  }

  function sectionCard(title, ...children) {
    const card = document.createElement("div");
    card.className = "section-card";
    card.innerHTML = `<h2>${title}</h2>`;
    children.forEach((c) => card.appendChild(c));
    return card;
  }

  function listEditor(label, items, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    wrap.innerHTML = `<label>${label}</label>`;
    const ul = document.createElement("ul");
    ul.className = "list-editor";
    function draw() {
      ul.innerHTML = "";
      items.forEach((val, i) => {
        const li = document.createElement("li");
        const inp = document.createElement("input");
        inp.type = "text"; inp.value = val;
        inp.addEventListener("input", () => { items[i] = inp.value; onChange(items); });
        const rm = document.createElement("button");
        rm.textContent = "✕";
        rm.addEventListener("click", () => { items.splice(i, 1); onChange(items); draw(); });
        li.appendChild(inp); li.appendChild(rm);
        ul.appendChild(li);
      });
    }
    draw();
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-outline btn-sm add-item-btn";
    addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", () => { items.push(""); onChange(items); draw(); });
    wrap.appendChild(ul); wrap.appendChild(addBtn);
    return wrap;
  }

  function repeatableList(container, items, makeItem, newItem, addLabel) {
    function draw() {
      container.innerHTML = "";
      items.forEach((entry, i) => {
        const item = document.createElement("div");
        item.className = "repeatable-item";
        item.innerHTML = `<button class="remove-btn" data-i="${i}">✕</button>`;
        makeItem(item, entry, i);
        item.querySelector(".remove-btn").addEventListener("click", () => { items.splice(i, 1); draw(); });
        container.appendChild(item);
      });
    }
    draw();
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-outline btn-sm add-item-btn";
    addBtn.textContent = addLabel;
    addBtn.addEventListener("click", () => { items.push(newItem()); draw(); });
    return { draw, addBtn };
  }

  const EDITORS = {
    home(d) {
      const c = sectionCard("Home / Hero");
      c.appendChild(field("Name", d.name, (v) => d.name = v));
      c.appendChild(field("Headline", d.headline, (v) => d.headline = v));
      c.appendChild(field("Tagline", d.tagline, (v) => d.tagline = v, "textarea"));
      c.appendChild(mediaField("Photo", d.photo, (v) => d.photo = v));
      c.appendChild(field("Contact Button Text", d.ctaContactText, (v) => d.ctaContactText = v));
      return [c];
    },
    about(d) {
      const c = sectionCard("About");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      c.appendChild(field("Bio / Objective", d.bio, (v) => d.bio = v, "textarea"));
      c.appendChild(field("Location", d.location, (v) => d.location = v));
      c.appendChild(listEditor("Languages", d.languages, (v) => d.languages = v));
      return [c];
    },
    skills(d) {
      const c = sectionCard("Skills");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      c.appendChild(listEditor("Skills", d.items, (v) => d.items = v));
      return [c];
    },
    experience(d) {
      const c = sectionCard("Experience");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      const list = document.createElement("div");
      repeatableList(list, d.items, (item, e) => {
        item.appendChild(field("Role / Title", e.role, (v) => e.role = v));
        item.appendChild(field("Company", e.company, (v) => e.company = v));
        item.appendChild(field("Duration", e.duration, (v) => e.duration = v));
        item.appendChild(field("Description", e.description, (v) => e.description = v, "textarea"));
      }, () => ({ role: "", company: "", duration: "", description: "" }), "+ Add Experience");
      c.appendChild(list);
      return [c];
    },
    education(d) {
      const c = sectionCard("Education");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      const list = document.createElement("div");
      repeatableList(list, d.items, (item, e) => {
        item.appendChild(field("Degree / Qualification", e.degree, (v) => e.degree = v));
        item.appendChild(field("Institution", e.institution, (v) => e.institution = v));
        const row = document.createElement("div"); row.className = "field-row";
        row.appendChild(field("Score / Grade", e.score, (v) => e.score = v));
        row.appendChild(field("Year", e.year, (v) => e.year = v));
        item.appendChild(row);
      }, () => ({ degree: "", institution: "", score: "", year: "" }), "+ Add Education");
      c.appendChild(list);
      return [c];
    },
    certifications(d) {
      const c = sectionCard("Certifications");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      const list = document.createElement("div");
      repeatableList(list, d.items, (item, e) => {
        item.appendChild(field("Title", e.title, (v) => e.title = v));
        item.appendChild(field("Institution", e.institution, (v) => e.institution = v));
        item.appendChild(field("Year", e.year, (v) => e.year = v));
      }, () => ({ title: "", institution: "", year: "" }), "+ Add Certification");
      c.appendChild(list);
      return [c];
    },
    achievements(d) {
      const c = sectionCard("Performance Highlights");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      c.appendChild(field("Subheading", d.subheading, (v) => d.subheading = v));
      const list = document.createElement("div");
      repeatableList(list, d.items, (item, a) => {
        item.appendChild(field("Period (e.g. September 2026)", a.period, (v) => a.period = v));
        item.appendChild(field("Summary", a.summary, (v) => a.summary = v, "textarea"));
        const row = document.createElement("div"); row.className = "field-row";
        row.appendChild(field("Closings", a.closings, (v) => a.closings = v));
        row.appendChild(field("Revenue", a.revenue, (v) => a.revenue = v));
        item.appendChild(row);
        item.appendChild(field("Deal Value (optional)", a.dealValue, (v) => a.dealValue = v));
      }, () => ({ period: "", summary: "", closings: "", revenue: "", dealValue: "" }), "+ Add Monthly Highlight");
      c.appendChild(list);
      return [c];
    },
    contact(d) {
      const c = sectionCard("Contact");
      c.appendChild(field("Heading", d.heading, (v) => d.heading = v));
      c.appendChild(field("Subheading", d.subheading, (v) => d.subheading = v, "textarea"));
      c.appendChild(field("Phone", d.phone, (v) => d.phone = v, "tel"));
      c.appendChild(field("Email", d.email, (v) => d.email = v, "email"));
      c.appendChild(field("Location", d.location, (v) => d.location = v));
      return [c];
    }
  };

  function renderSection(key) {
    sectionContent.innerHTML = "";
    const editor = EDITORS[key];
    if (!editor || !draft[key]) {
      sectionContent.innerHTML = `<div class="empty-note">Nothing to edit here yet.</div>`;
      return;
    }
    editor(draft[key]).forEach((el) => sectionContent.appendChild(el));

    if (key === "home") {
      const seo = sectionCard("SEO");
      seo.appendChild(field("Site Title", draft.meta.siteTitle, (v) => draft.meta.siteTitle = v));
      seo.appendChild(field("Meta Description", draft.meta.seoDescription, (v) => draft.meta.seoDescription = v, "textarea"));
      seo.appendChild(field("Keywords", draft.meta.seoKeywords, (v) => draft.meta.seoKeywords = v));
      sectionContent.appendChild(seo);
    }
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  async function renderMediaLibrary() {
    sectionContent.innerHTML = `<div class="empty-note">Loading media…</div>`;
    let files;
    try {
      const res = await api("/api/media-list");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load media");
      files = (await res.json()).files || [];
    } catch (err) {
      sectionContent.innerHTML = `<div class="empty-note">Could not load media library: ${err.message}</div>`;
      return;
    }

    const card = sectionCard("Media Library");
    const note = document.createElement("p");
    note.className = "muted";
    note.style.marginTop = "-8px";
    note.textContent = "Only delete photos that are no longer used anywhere on the site — deleting one still in use will leave a broken image there.";
    card.appendChild(note);

    if (!files.length) {
      const empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = "No uploaded media yet.";
      card.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "gallery-editor-grid";
      grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
      files.forEach((f) => {
        const item = document.createElement("div");
        item.className = "gallery-editor-item";
        item.style.aspectRatio = "1/1";
        item.innerHTML = `<img src="${rawUrl(f.path)}"><button data-path="${f.path}">✕</button>`;
        const label = document.createElement("div");
        label.className = "muted";
        label.style.cssText = "font-size:.7rem;margin-top:2px;word-break:break-all";
        label.textContent = `${f.name} (${formatBytes(f.size)})`;
        const wrap = document.createElement("div");
        wrap.appendChild(item); wrap.appendChild(label);
        grid.appendChild(wrap);

        item.querySelector("button").addEventListener("click", async () => {
          if (!confirm(`Delete ${f.name}? This can't be undone.`)) return;
          try {
            const res = await api("/api/media-delete", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: f.path })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed");
            renderMediaLibrary();
          } catch (err) {
            alert("Could not delete: " + err.message);
          }
        });
      });
      card.appendChild(grid);
    }
    sectionContent.innerHTML = "";
    sectionContent.appendChild(card);
  }

  document.getElementById("previewBtn").addEventListener("click", () => {
    window.localStorage.setItem("siteContentDraft", JSON.stringify(draft));
    document.getElementById("previewFrame").src = "../index.html?preview=1&t=" + Date.now();
    document.getElementById("previewModal").classList.remove("hidden");
  });
  document.getElementById("closePreviewBtn").addEventListener("click", () => {
    document.getElementById("previewModal").classList.add("hidden");
  });

  document.getElementById("publishBtn").addEventListener("click", async () => {
    publishStatus.textContent = "Publishing…";
    publishStatus.className = "publish-status";
    try {
      const res = await api("/api/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Publish failed");
      }
      publishStatus.textContent = "Published! GitHub Actions is deploying your changes — this usually takes 1-2 minutes.";
      publishStatus.className = "publish-status success";
    } catch (err) {
      publishStatus.textContent = "Error: " + err.message;
      publishStatus.className = "publish-status error";
    }
  });
})();
