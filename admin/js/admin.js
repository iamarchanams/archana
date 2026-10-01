(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var API_BASE = (cfg.API_BASE_URL || "").replace(/\/$/, "");
  var GITHUB_REPO = cfg.GITHUB_REPO || "";
  var TOKEN_KEY = "adminToken", BACKUP_KEY = "adminDraftBackup";
  var MAX_UPLOAD = 3 * 1024 * 1024; // keep in sync with api/upload.js

  var mem = {};
  var store = {
    get: function (k) { try { var v = window.localStorage.getItem(k); return v == null ? (mem[k] == null ? null : mem[k]) : v; } catch (e) { return mem[k] == null ? null : mem[k]; } },
    set: function (k, v) { mem[k] = v; try { window.localStorage.setItem(k, v); } catch (e) { /* blocked: memory only */ } },
    remove: function (k) { delete mem[k]; try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  var IS_TOUCH = !!(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);

  var $ = function (id) { return document.getElementById(id); };
  var loginView = $("loginView"), dashboardView = $("dashboardView"), loginError = $("loginError");
  var sectionNav = $("sectionNav"), sectionContent = $("sectionContent"), publishStatus = $("publishStatus");

  var LABELS = {
    home: "Home", about: "About", skills: "Skills", experience: "Experience", education: "Education",
    certifications: "Certifications", achievements: "Highlights", gallery: "Career Gallery", contact: "Contact"
  };

  var draft = null, publishedSnapshot = "", activeSection = "home", localPreviews = {}, backupTimer = null;

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function imgSrc(path) {
    if (!path) return "";
    if (localPreviews[path]) return localPreviews[path];
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    return "https://raw.githubusercontent.com/" + GITHUB_REPO + "/main/" + path;
  }
  function toast(msg, kind) {
    var t = el("div", "toast " + (kind || ""), esc(msg));
    $("toasts").appendChild(t);
    setTimeout(function () { t.parentNode && t.parentNode.removeChild(t); }, kind === "err" ? 6000 : 3200);
  }

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers);
    var token = store.get(TOKEN_KEY);
    if (token) opts.headers.Authorization = "Bearer " + token;
    return fetch(API_BASE + path, opts).then(function (res) {
      if (res.status === 401 && path.indexOf("/api/auth/") !== 0) {
        store.remove(TOKEN_KEY);
        showLogin("Your session expired. Please enter the PIN again.");
        throw new Error("Session expired");
      }
      return res;
    });
  }
  function postJson(path, body) {
    return api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  function errorOf(res) { return res.json().then(function (d) { return d.error; }, function () { return ""; }); }

  /* ---------- login / boot ---------- */
  function showLogin(msg) {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    loginError.textContent = msg || "";
    if (!IS_TOUCH) $("pinInput").focus();
  }

  $("pinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.textContent = "";
    if (!API_BASE || API_BASE.indexOf("YOUR-") > -1) { loginError.textContent = "The admin API is not configured yet. Set API_BASE_URL in config.js."; return; }
    var pin = $("pinInput").value.trim();
    if (!pin) return;
    var btn = $("pinSubmit"); btn.disabled = true; btn.textContent = "Checking…";
    fetch(API_BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: pin }) })
      .then(function (res) {
        if (!res.ok) return errorOf(res).then(function (m) { loginError.textContent = m || "Login failed (" + res.status + ")."; });
        return res.json().then(function (d) {
          if (!d.token) { loginError.textContent = "The API did not return a session. Redeploy the Vercel project with the latest api/ folder."; return; }
          store.set(TOKEN_KEY, d.token);
          $("pinInput").value = "";
          boot();
        });
      })
      .catch(function () { loginError.textContent = "Could not reach the admin API. Check API_BASE_URL in config.js and that the Vercel deployment is live."; })
      .then(function () { btn.disabled = false; btn.textContent = "Unlock"; });
  });

  $("logoutBtn").addEventListener("click", function () {
    if (isDirty() && !confirm("You have unpublished changes. Log out anyway? They stay saved on this device.")) return;
    store.remove(TOKEN_KEY);
    window.location.reload();
  });

  function boot() {
    if (!store.get(TOKEN_KEY)) return showLogin();
    api("/api/auth/session").then(function (res) {
      if (!res.ok) return showLogin();
      loginView.classList.add("hidden");
      dashboardView.classList.remove("hidden");
      return loadContent();
    }).catch(function (err) {
      if (err.message !== "Session expired") showLogin("Could not reach the admin API.");
    });
  }

  function loadContent() {
    sectionContent.innerHTML = '<div class="empty-note">Loading content…</div>';
    return api("/api/content").then(function (res) {
      if (!res.ok) throw new Error("api");
      return res.json().then(function (d) { return d.content; });
    }).catch(function (err) {
      if (err.message === "Session expired") throw err;
      // fall back to the copy served by GitHub Pages
      return fetch("../content/site-content.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); });
    }).then(function (content) {
      draft = window.normalizeContent(content);
      publishedSnapshot = JSON.stringify(draft);
      if (draft.sectionOrder.indexOf(activeSection) < 0 && ["__layout__", "__media__"].indexOf(activeSection) < 0) activeSection = "home";
      renderAll();
      refreshDirty();
      checkBackup();
    }).catch(function (err) {
      if (err.message !== "Session expired") sectionContent.innerHTML = '<div class="empty-note">Could not load the site content. ' + esc(err.message) + "</div>";
    });
  }

  /* ---------- dirty tracking, backup ---------- */
  function isDirty() { return draft && JSON.stringify(draft) !== publishedSnapshot; }
  function refreshDirty() { $("dirtyBadge").classList.toggle("hidden", !isDirty()); }
  function markDirty() {
    refreshDirty();
    clearTimeout(backupTimer);
    backupTimer = setTimeout(function () {
      try {
        if (isDirty()) localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), json: JSON.stringify(draft) }));
        else store.remove(BACKUP_KEY);
      } catch (e) { /* storage full or blocked: ignore */ }
    }, 400);
  }
  function checkBackup() {
    try {
      var b = JSON.parse(store.get(BACKUP_KEY) || "null");
      if (b && b.json && b.json !== publishedSnapshot) { $("restoreBanner").classList.remove("hidden"); return; }
    } catch (e) { /* ignore */ }
    $("restoreBanner").classList.add("hidden");
  }
  $("restoreYes").addEventListener("click", function () {
    try {
      var b = JSON.parse(store.get(BACKUP_KEY));
      draft = window.normalizeContent(JSON.parse(b.json));
      renderAll(); refreshDirty(); toast("Unpublished edits restored.", "ok");
    } catch (e) { toast("Could not restore the saved edits.", "err"); }
    $("restoreBanner").classList.add("hidden");
  });
  $("restoreNo").addEventListener("click", function () { store.remove(BACKUP_KEY); $("restoreBanner").classList.add("hidden"); });
  function flushBackup() {
    try { if (draft && isDirty()) store.set(BACKUP_KEY, JSON.stringify({ at: Date.now(), json: JSON.stringify(draft) })); } catch (e) { /* ignore */ }
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushBackup(); });
  window.addEventListener("pagehide", flushBackup);
  window.addEventListener("beforeunload", function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  $("discardBtn").addEventListener("click", function () {
    if (!isDirty()) return toast("There is nothing to discard.");
    if (!confirm("Discard all unpublished changes and reload the published version?")) return;
    store.remove(BACKUP_KEY);
    loadContent().then(function () { toast("Changes discarded.", "ok"); });
  });

  /* ---------- sidebar ---------- */
  function renderSidebar() {
    var html = draft.sectionOrder.map(function (key) {
      var hidden = draft.sectionVisibility[key] === false;
      return '<div class="nav-item ' + (key === activeSection ? "active" : "") + '">' +
        '<span class="nav-label" data-select="' + key + '">' + esc(LABELS[key] || key) + "</span>" +
        (hidden ? '<span class="vis-toggle off" title="Hidden on the site">Hidden</span>' : "") + "</div>";
    }).join("");
    html += '<div class="nav-sep"></div>' +
      '<div class="nav-item ' + (activeSection === "__layout__" ? "active" : "") + '"><span class="nav-label" data-select="__layout__">Page layout</span></div>' +
      '<div class="nav-item ' + (activeSection === "__media__" ? "active" : "") + '"><span class="nav-label" data-select="__media__">Media library</span></div>';
    sectionNav.innerHTML = html;
    sectionNav.querySelectorAll("[data-select]").forEach(function (n) {
      n.addEventListener("click", function () { activeSection = n.dataset.select; renderAll(); window.scrollTo(0, 0); });
    });
  }

  function renderAll() {
    renderSidebar();
    sectionContent.innerHTML = "";
    if (activeSection === "__layout__") return renderLayout();
    if (activeSection === "__media__") return renderMediaLibrary();
    renderSection(activeSection);
  }

  /* ---------- basic field builders ---------- */
  function field(label, value, onChange, type, hint) {
    type = type || "text";
    var id = "f_" + Math.random().toString(36).slice(2);
    var wrap = el("div", "field-group");
    wrap.innerHTML = '<label for="' + id + '">' + esc(label) + "</label>" +
      (type === "textarea" ? '<textarea id="' + id + '"></textarea>' : '<input id="' + id + '" type="' + type + '">') +
      (hint ? '<div class="field-hint">' + esc(hint) + "</div>" : "");
    var input = wrap.querySelector("#" + id);
    input.value = value == null ? "" : value;
    input.addEventListener("input", function () { onChange(input.value); markDirty(); });
    return wrap;
  }
  function selectField(label, value, options, onChange, hint) {
    var id = "f_" + Math.random().toString(36).slice(2);
    var wrap = el("div", "field-group");
    wrap.innerHTML = '<label for="' + id + '">' + esc(label) + '</label><select id="' + id + '">' +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>"; }).join("") + "</select>" +
      (hint ? '<div class="field-hint">' + esc(hint) + "</div>" : "");
    var sel = wrap.querySelector("select"); sel.value = value;
    sel.addEventListener("change", function () { onChange(sel.value); markDirty(); });
    return wrap;
  }
  function toggleField(label, value, onChange, hint) {
    var id = "f_" + Math.random().toString(36).slice(2);
    var wrap = el("div", "field-group toggle-group");
    wrap.innerHTML = '<label class="toggle" for="' + id + '"><input id="' + id + '" type="checkbox"><span class="toggle-ui"></span><span class="toggle-text">' + esc(label) + "</span></label>" +
      (hint ? '<div class="field-hint">' + esc(hint) + "</div>" : "");
    var cb = wrap.querySelector("input"); cb.checked = !!value;
    cb.addEventListener("change", function () { onChange(cb.checked); markDirty(); });
    return wrap;
  }
  function row() { var r = el("div", "field-row"); Array.prototype.slice.call(arguments).forEach(function (c) { r.appendChild(c); }); return r; }

  function sectionCard(title) {
    var c = el("div", "section-card");
    if (title) c.appendChild(el("h2", null, esc(title)));
    return c;
  }

  function simpleList(label, items, onChange, noun) {
    var wrap = el("div", "field-group");
    wrap.appendChild(el("label", null, esc(label)));
    var ul = el("ul", "list-editor");
    function draw() {
      ul.innerHTML = "";
      items.forEach(function (val, i) {
        var li = el("li"), inp = el("input"), rm = el("button", null, "✕");
        inp.type = "text"; inp.value = val;
        inp.addEventListener("input", function () { items[i] = inp.value; onChange(items); markDirty(); });
        rm.type = "button"; rm.title = "Remove"; rm.setAttribute("aria-label", "Remove");
        rm.addEventListener("click", function () { items.splice(i, 1); onChange(items); markDirty(); draw(); });
        li.appendChild(inp); li.appendChild(rm); ul.appendChild(li);
      });
    }
    draw();
    var add = el("button", "btn btn-outline btn-sm", "+ Add " + (noun || "item"));
    add.type = "button";
    add.addEventListener("click", function () { items.push(""); onChange(items); markDirty(); draw(); var inputs = ul.querySelectorAll("input"); inputs[inputs.length - 1].focus(); });
    wrap.appendChild(ul); wrap.appendChild(add);
    return wrap;
  }

  /* ---------- uploads ---------- */
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1]); };
      r.onerror = function () { reject(new Error("Could not read the file.")); };
      r.readAsDataURL(blob);
    });
  }
  function readDataUrl(blob) {
    return new Promise(function (resolve) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.readAsDataURL(blob); });
  }

  // Shrinks photos before upload: keeps the repo small and stays under the host's request-size limit.
  function prepareImage(file) {
    var ftype = (file.type || "").toLowerCase();
    if (!ftype) { var m = /\.(jpe?g|png|webp|gif|heic|heif)$/i.exec(file.name || ""); if (m) ftype = m[1].toLowerCase() === "png" ? "image/png" : m[1].toLowerCase() === "gif" ? "image/gif" : m[1].toLowerCase() === "webp" ? "image/webp" : "image/jpeg"; }
    if (!/^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/.test(ftype)) return Promise.reject(new Error("Please choose a JPG, PNG, WebP or GIF image."));
    if (ftype === "image/gif") {
      return file.size > MAX_UPLOAD ? Promise.reject(new Error("That GIF is over 3 MB.")) : Promise.resolve({ blob: file, type: file.type, ext: "gif" });
    }
    var url = URL.createObjectURL(file);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read that image. If it is a HEIC photo, try choosing it again or export it as JPG.")); };
      img.src = url;
    }).then(function (img) {
      var MAX = 1800, scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      var ctx = canvas.getContext("2d");
      // PNG/WebP: if the picture has transparent pixels, keep them (a cut-out hero photo) instead of flattening onto white
      var hasAlpha = false;
      if (ftype === "image/png" || ftype === "image/webp") {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          var px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (var i = 3; i < px.length; i += 4 * 7) { if (px[i] < 250) { hasAlpha = true; break; } }
        } catch (e) { hasAlpha = false; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (!hasAlpha) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      if (hasAlpha) {
        // keep the alpha channel: PNG, shrinking the picture until it fits the upload limit
        var cw = canvas.width, ch = canvas.height, src = canvas;
        var tryPng = function () {
          return new Promise(function (r) { src.toBlob(r, "image/png"); }).then(function (blob) {
            if (blob.size > 2.6 * 1024 * 1024 && cw > 500) {
              cw = Math.round(cw * 0.8); ch = Math.round(ch * 0.8);
              var c2 = document.createElement("canvas"); c2.width = cw; c2.height = ch;
              c2.getContext("2d").drawImage(canvas, 0, 0, cw, ch); src = c2;
              return tryPng();
            }
            if (blob.size > MAX_UPLOAD) throw new Error("That transparent image is too large. Try a smaller one.");
            return { blob: blob, type: "image/png", ext: "png" };
          });
        };
        return tryPng();
      }
      var q = 0.86;
      function attempt() {
        return new Promise(function (r) { canvas.toBlob(r, "image/jpeg", q); }).then(function (blob) {
          if (blob.size > 2.6 * 1024 * 1024 && q > 0.45) { q -= 0.1; return attempt(); }
          if (blob.size > MAX_UPLOAD) throw new Error("That image is still too large after shrinking.");
          return { blob: blob, type: "image/jpeg", ext: "jpg" };
        });
      }
      return attempt();
    });
  }

  function uploadBlob(folder, baseName, ext, blob, type) {
    var safe = baseName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
    var path = "media/" + folder + "/" + Date.now() + "-" + safe + "." + ext;
    return blobToBase64(blob).then(function (b64) {
      return postJson("/api/upload", { path: path, contentType: type, dataBase64: b64 });
    }).then(function (res) {
      if (!res.ok) return errorOf(res).then(function (m) { throw new Error(m || "Upload failed (" + res.status + ")"); });
      return res.json().then(function (d) { return d.path || path; });
    });
  }

  function imageField(label, value, onChange, hint) {
    var wrap = el("div", "field-group");
    function draw() {
      wrap.innerHTML = "<label>" + esc(label) + "</label>";
      if (value) {
        var im = el("img", "media-preview"); im.alt = ""; im.src = imgSrc(value);
        im.onerror = function () { im.style.display = "none"; };
        wrap.appendChild(im);
      }
      var rowEl = el("div", "media-uploader-row");
      var pick = el("button", "btn btn-outline btn-sm", value ? "Replace image" : "Upload image"); pick.type = "button";
      var file = el("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/webp,image/gif"; file.className = "visually-hidden-input";
      var status = el("div", "upload-status");
      pick.addEventListener("click", function () { file.value = ""; file.click(); });
      file.addEventListener("change", function () {
        var f = file.files[0]; if (!f) return;
        pick.disabled = true; status.textContent = "Preparing image…";
        prepareImage(f).then(function (p) {
          status.textContent = "Uploading…";
          return readDataUrl(p.blob).then(function (dataUrl) {
            return uploadBlob("images", f.name, p.ext, p.blob, p.type).then(function (path) { localPreviews[path] = dataUrl; return path; });
          });
        }).then(function (path) {
          value = path; onChange(path); markDirty(); toast("Image uploaded.", "ok"); draw();
        }).catch(function (err) { status.textContent = "Upload failed: " + err.message; pick.disabled = false; });
      });
      rowEl.appendChild(pick);
      if (value) {
        var rm = el("button", "btn btn-ghost btn-sm", "Remove image"); rm.type = "button";
        rm.addEventListener("click", function () { value = ""; onChange(""); markDirty(); draw(); });
        rowEl.appendChild(rm);
      }
      wrap.appendChild(rowEl); wrap.appendChild(file); wrap.appendChild(status);
      if (hint) wrap.appendChild(el("div", "field-hint", esc(hint)));
    }
    draw();
    return wrap;
  }

  function pdfField(label, value, onChange) {
    var wrap = el("div", "field-group");
    function draw() {
      wrap.innerHTML = "<label>" + esc(label) + "</label>";
      if (value) wrap.appendChild(el("div", "file-chip", "📄 " + esc(value.split("/").pop())));
      var rowEl = el("div", "media-uploader-row");
      var pick = el("button", "btn btn-outline btn-sm", value ? "Replace PDF" : "Upload PDF"); pick.type = "button";
      var file = el("input"); file.type = "file"; file.accept = "application/pdf,.pdf"; file.className = "visually-hidden-input";
      var status = el("div", "upload-status");
      pick.addEventListener("click", function () { file.value = ""; file.click(); });
      file.addEventListener("change", function () {
        var f = file.files[0]; if (!f) return;
        if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { status.textContent = "Please choose a PDF file."; return; }
        if (f.size > MAX_UPLOAD) { status.textContent = "That PDF is over 3 MB. Compress it and try again."; return; }
        pick.disabled = true; status.textContent = "Uploading…";
        uploadBlob("files", f.name, "pdf", f, "application/pdf").then(function (path) {
          value = path; onChange(path); markDirty(); toast("Resume uploaded.", "ok"); draw();
        }).catch(function (err) { status.textContent = "Upload failed: " + err.message; pick.disabled = false; });
      });
      rowEl.appendChild(pick);
      if (value) {
        var rm = el("button", "btn btn-ghost btn-sm", "Remove"); rm.type = "button";
        rm.addEventListener("click", function () { value = ""; onChange(""); markDirty(); draw(); });
        rowEl.appendChild(rm);
      }
      wrap.appendChild(rowEl); wrap.appendChild(file); wrap.appendChild(status);
      wrap.appendChild(el("div", "field-hint", "The “Download Resume” button only shows on the site when a PDF is uploaded. Max 3 MB."));
    }
    draw();
    return wrap;
  }

  function metricsEditor(list) {
    var wrap = el("div", "field-group");
    wrap.appendChild(el("label", null, "Numbers to show (optional)"));
    var box = el("div");
    function draw() {
      box.innerHTML = "";
      list.forEach(function (m, i) {
        var r = el("div", "metric-row"), a = el("input"), b = el("input"), rm = el("button", null, "✕");
        a.placeholder = "Label, e.g. Closings"; a.value = m.label; b.placeholder = "Value, e.g. 12 or ₹45,000"; b.value = m.value;
        a.addEventListener("input", function () { m.label = a.value; });
        b.addEventListener("input", function () { m.value = b.value; });
        rm.type = "button"; rm.setAttribute("aria-label", "Remove");
        rm.addEventListener("click", function () { list.splice(i, 1); draw(); });
        r.appendChild(a); r.appendChild(b); r.appendChild(rm); box.appendChild(r);
      });
    }
    draw();
    var add = el("button", "btn btn-outline btn-sm", "+ Add number"); add.type = "button";
    add.addEventListener("click", function () { list.push({ label: "", value: "" }); draw(); });
    wrap.appendChild(box); wrap.appendChild(add);
    wrap.appendChild(el("div", "field-hint", "Use any labels you like — Closings, Revenue, Leads, Rank, Target achieved…"));
    return wrap;
  }

  /* ---------- modal form ---------- */
  var modalOpen = null;
  function openModal(opts) {
    // opts: { title, fields, item, required, onSave }
    var work = clone(opts.item);
    var body = $("modalBody");
    body.innerHTML = "";
    function build(f) {
      var v = work[f.key];
      switch (f.type) {
        case "textarea": return field(f.label, v, function (x) { work[f.key] = x; }, "textarea", f.hint);
        case "url": return field(f.label, v, function (x) { work[f.key] = x; }, "url", f.hint);
        case "image": return imageField(f.label, v, function (x) { work[f.key] = x; }, f.hint);
        case "metrics": return metricsEditor(work[f.key] = work[f.key] || []);
        case "lines": return field(f.label, (v || []).join("\n"), function (x) {
          work[f.key] = x.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        }, "textarea", f.hint);
        default: return field(f.label, v, function (x) { work[f.key] = x; }, "text", f.hint);
      }
    }
    opts.fields.forEach(function (f) {
      if (f.row) { body.appendChild(row.apply(null, f.row.map(build))); } else { body.appendChild(build(f)); }
    });
    $("modalTitle").textContent = opts.title;
    $("modal").classList.remove("hidden");
    modalOpen = { opts: opts, work: work };
    if (!IS_TOUCH) { var first = body.querySelector("input,textarea"); if (first) first.focus(); }
    body.scrollTop = 0;
    document.documentElement.classList.add("modal-lock"); fitModalToViewport();
  }
  function closeModal() {
    $("modal").classList.add("hidden"); modalOpen = null;
    $("modal").style.top = ""; $("modal").style.height = "";
    document.documentElement.classList.remove("modal-lock");
  }
  // iOS keyboard shrinks only the *visual* viewport; keep the modal (and its Save button) inside it.
  function fitModalToViewport() {
    var vv = window.visualViewport, m = $("modal");
    if (!vv || !modalOpen || !IS_TOUCH) return;
    m.style.top = vv.offsetTop + "px"; m.style.height = vv.height + "px"; m.style.bottom = "auto";
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitModalToViewport);
    window.visualViewport.addEventListener("scroll", fitModalToViewport);
  }
  $("modalCancel").addEventListener("click", closeModal);
  $("modalX").addEventListener("click", closeModal);
  $("modalSave").addEventListener("click", function () {
    if (!modalOpen) return;
    var req = modalOpen.opts.required;
    if (req) {
      var val = modalOpen.work[req.key];
      if (!val || !String(val).trim()) { toast("Please fill in “" + req.label + "” first.", "err"); return; }
    }
    modalOpen.opts.onSave(modalOpen.work);
    closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modalOpen) closeModal(); });

  /* ---------- item list manager (Add / Edit / Duplicate / Move / Delete) ---------- */
  function listManager(title, items, cfg) {
    var card = sectionCard();
    var head = el("div", "card-header");
    head.appendChild(el("h2", null, esc(title)));
    var add = el("button", "btn btn-primary btn-sm", "+ Add " + cfg.noun); add.type = "button";
    head.appendChild(add);
    var list = el("div", "item-list");
    card.appendChild(head); card.appendChild(list);
    if (cfg.hint) card.appendChild(el("div", "field-hint", esc(cfg.hint)));

    function edit(index) {
      var isNew = index === -1;
      openModal({
        title: (isNew ? "Add " : "Edit ") + cfg.noun,
        fields: cfg.fields, required: cfg.required,
        item: isNew ? cfg.blank() : items[index],
        onSave: function (result) {
          if (isNew) { cfg.addAtTop === false ? items.push(result) : items.unshift(result); }
          else items[index] = result;
          markDirty(); draw(); toast(isNew ? cfg.noun + " added." : cfg.noun + " updated.", "ok");
        }
      });
    }
    function move(i, d) {
      var j = i + d; if (j < 0 || j >= items.length) return;
      var t = items[i]; items[i] = items[j]; items[j] = t; markDirty(); draw();
    }
    function draw() {
      list.innerHTML = "";
      if (!items.length) { list.appendChild(el("div", "empty-note", "Nothing here yet. Use “Add " + esc(cfg.noun) + "” to create the first one.")); return; }
      items.forEach(function (item, i) {
        var s = cfg.summary(item);
        var r = el("div", "item-row");
        var th = el("div", "item-thumb");
        if (s.image) { var im = el("img"); im.alt = ""; im.src = imgSrc(s.image); im.onerror = function () { im.remove(); th.textContent = "No img"; }; th.appendChild(im); }
        else th.textContent = cfg.hasImage ? "No img" : String(i + 1);
        var main = el("div", "item-main", '<div class="item-title">' + esc(s.title || "(untitled)") + '</div><div class="item-sub">' + esc(s.sub || "") + "</div>");
        var acts = el("div", "item-actions");
        function btn(label, cls, fn, aria, disabled) {
          var b = el("button", "btn btn-xs " + cls, label); b.type = "button"; if (aria) b.setAttribute("aria-label", aria);
          b.disabled = !!disabled; b.addEventListener("click", fn); acts.appendChild(b);
        }
        btn("Edit", "btn-outline", function () { edit(i); });
        btn("Copy", "btn-ghost", function () { var c = clone(item); items.splice(i + 1, 0, c); markDirty(); draw(); toast("Duplicated.", "ok"); }, "Duplicate");
        btn("↑", "btn-ghost", function () { move(i, -1); }, "Move up", i === 0);
        btn("↓", "btn-ghost", function () { move(i, 1); }, "Move down", i === items.length - 1);
        btn("Delete", "btn-danger", function () {
          if (!confirm("Delete “" + (s.title || "this item") + "”?")) return;
          items.splice(i, 1); markDirty(); draw(); toast(cfg.noun + " deleted.");
        });
        r.appendChild(th); r.appendChild(main); r.appendChild(acts); list.appendChild(r);
      });
    }
    add.addEventListener("click", function () { edit(-1); });
    draw();
    return card;
  }

  /* ---------- section editors ---------- */
  var T = function (key, label, type, hint) { return { key: key, label: label, type: type || "text", hint: hint }; };
  var join = function (a, b) { return [a, b].filter(Boolean).join(" · "); };

  function headingCard(title, d, withSub) {
    var c = sectionCard(title);
    c.appendChild(field("Section heading", d.heading, function (v) { d.heading = v; }));
    if (withSub) c.appendChild(field("Short description under the heading", d.subheading, function (v) { d.subheading = v; }));
    return c;
  }

  var EDITORS = {
    home: function (d) {
      var c = sectionCard("Home");
      c.appendChild(field("Name", d.name, function (v) { d.name = v; }));
      c.appendChild(field("Headline (job title)", d.headline, function (v) { d.headline = v; }));
      c.appendChild(field("Tagline", d.tagline, function (v) { d.tagline = v; }, "textarea"));
      c.appendChild(imageField("Profile photo", d.photo, function (v) { d.photo = v; }, "For the transparent style upload a PNG with a transparent background (a cut-out). Otherwise a square photo with your face centred works best."));
      c.appendChild(row(
        selectField("Photo style", d.photoStyle, [["square", "Square (soft corners, framed)"], ["transparent", "Transparent / no frame (PNG cut-out)"], ["circle", "Circle (old look)"]], function (v) { d.photoStyle = v; }),
        selectField("Photo animation", d.photoAnimation, [["float-glow", "Floating + glow"], ["float", "Floating only"], ["glow", "Glow only"], ["none", "No animation"]], function (v) { d.photoAnimation = v; })
      ));
      c.appendChild(row(
        field("Contact button text", d.ctaContactText, function (v) { d.ctaContactText = v; }),
        field("Resume button text", d.ctaResumeText, function (v) { d.ctaResumeText = v; })
      ));
      c.appendChild(pdfField("Resume (PDF)", d.resumeFile, function (v) { d.resumeFile = v; }));
      var seo = sectionCard("Search engines (SEO)");
      seo.appendChild(field("Browser tab title", draft.meta.siteTitle, function (v) { draft.meta.siteTitle = v; }));
      seo.appendChild(field("Description for Google", draft.meta.seoDescription, function (v) { draft.meta.seoDescription = v; }, "textarea"));
      seo.appendChild(field("Keywords", draft.meta.seoKeywords, function (v) { draft.meta.seoKeywords = v; }));
      return [c, seo];
    },
    about: function (d) {
      var c = sectionCard("About");
      c.appendChild(field("Section heading", d.heading, function (v) { d.heading = v; }));
      c.appendChild(field("Bio / career objective", d.bio, function (v) { d.bio = v; }, "textarea"));
      c.appendChild(field("Location", d.location, function (v) { d.location = v; }));
      c.appendChild(simpleList("Languages", d.languages, function (v) { d.languages = v; }, "language"));
      return [c];
    },
    skills: function (d) {
      var c = headingCard("Skills", d);
      c.appendChild(simpleList("Skills", d.items, function (v) { d.items = v; }, "skill"));
      return [c];
    },
    experience: function (d) {
      return [headingCard("Experience", d), listManager("Jobs & roles", d.items, {
        noun: "experience", hasImage: true, required: { key: "role", label: "Role" }, hint: "Newest first. New entries are added at the top.",
        blank: function () { return { role: "", company: "", duration: "", description: "", points: [], image: "" }; },
        fields: [T("role", "Role / title"), { row: [T("company", "Company"), T("duration", "Duration (e.g. Jan 2025 – Present)")] },
          T("description", "Short description", "textarea"), T("points", "Key points (one per line)", "lines", "Each line becomes a bullet on the site."),
          T("image", "Proof image (ID card, experience letter…) — optional", "image", "Shown as a small thumbnail on the site. Visitors can tap it to view it larger. Cover any ID number or address you don’t want public.")],
        summary: function (e) { return { title: e.role, sub: join(e.company, e.duration), image: e.image }; }
      })];
    },
    education: function (d) {
      return [headingCard("Education", d), listManager("Qualifications", d.items, {
        noun: "education", required: { key: "degree", label: "Qualification" },
        blank: function () { return { degree: "", institution: "", score: "", year: "" }; },
        fields: [T("degree", "Degree / qualification"), T("institution", "Institution"), { row: [T("score", "Score / grade"), T("year", "Year")] }],
        summary: function (e) { return { title: e.degree, sub: join(join(e.institution, e.year), e.score) }; }
      })];
    },
    certifications: function (d) {
      return [headingCard("Certifications", d), listManager("Certificates", d.items, {
        noun: "certification", hasImage: true, required: { key: "title", label: "Title" },
        hint: "Add a photo or scan of the certificate so visitors can open it full size.",
        blank: function () { return { title: "", institution: "", year: "", description: "", credentialUrl: "", image: "" }; },
        fields: [T("title", "Certification title"), { row: [T("institution", "Issued by"), T("year", "Year")] },
          T("description", "Short description (optional)", "textarea"),
          T("credentialUrl", "Credential link (optional)", "url", "e.g. a verification page"),
          T("image", "Certificate image", "image")],
        summary: function (e) { return { title: e.title, sub: join(e.institution, e.year), image: e.image }; }
      })];
    },
    achievements: function (d) {
      return [headingCard("Performance highlights", d, true), listManager("Highlights", d.items, {
        noun: "highlight", hasImage: true, required: { key: "period", label: "Period" },
        hint: "Add this month’s or quarter’s results at the top. Each highlight can carry its own numbers and a photo.",
        blank: function () { return { period: "", title: "", summary: "", metrics: [], image: "" }; },
        fields: [T("period", "Period (e.g. October 2026)"), T("title", "Title (optional)"),
          T("summary", "What happened", "textarea"), T("metrics", "", "metrics"), T("image", "Photo or screenshot (optional)", "image")],
        summary: function (a) { return { title: a.title || a.period, sub: join(a.title ? a.period : "", (a.metrics || []).filter(function (m) { return m.value; }).map(function (m) { return m.value + " " + m.label; }).join(", ")), image: a.image }; }
      })];
    },
    gallery: function (d) {
      return [headingCard("Career gallery", d, true), listManager("Photos", d.items, {
        noun: "photo", hasImage: true, required: { key: "title", label: "Title" },
        hint: "Awards, team moments, events, recognitions — each with a short description.",
        blank: function () { return { title: "", description: "", date: "", image: "" }; },
        fields: [T("title", "Title"), T("date", "Date (e.g. March 2026)"), T("description", "Short description", "textarea"), T("image", "Photo", "image")],
        summary: function (g) { return { title: g.title, sub: join(g.date, g.description), image: g.image }; }
      })];
    },
    contact: function (d) {
      var c = headingCard("Contact", d, true);
      c.appendChild(row(field("Phone", d.phone, function (v) { d.phone = v; }, "tel"), field("Email", d.email, function (v) { d.email = v; }, "email")));
      c.appendChild(field("Location", d.location, function (v) { d.location = v; }));
      var f = d.floating, fc = sectionCard("Floating buttons (WhatsApp, Call, Email)");
      fc.appendChild(el("p", "muted", "Round buttons that stay on screen while visitors scroll. Leave a number or email blank to use the details above."));
      fc.appendChild(toggleField("Show floating buttons on the website", f.enabled, function (v) { f.enabled = v; }));
      fc.appendChild(selectField("Side of the screen", f.position, [["right", "Right"], ["left", "Left"]], function (v) { f.position = v; }));
      fc.appendChild(toggleField("WhatsApp button", f.whatsapp.enabled, function (v) { f.whatsapp.enabled = v; }));
      fc.appendChild(row(
        field("WhatsApp number (with country code)", f.whatsapp.number, function (v) { f.whatsapp.number = v; }, "tel", "e.g. +91 96338 55662"),
        field("Pre-filled message", f.whatsapp.message, function (v) { f.whatsapp.message = v; })
      ));
      fc.appendChild(toggleField("Call button", f.call.enabled, function (v) { f.call.enabled = v; }));
      fc.appendChild(field("Phone number to call", f.call.number, function (v) { f.call.number = v; }, "tel"));
      fc.appendChild(toggleField("Email button", f.email.enabled, function (v) { f.email.enabled = v; }));
      fc.appendChild(row(
        field("Email address", f.email.address, function (v) { f.email.address = v; }, "email"),
        field("Email subject", f.email.subject, function (v) { f.email.subject = v; })
      ));
      return [c, fc, listManager("Social & web links", d.socials, {
        noun: "link", addAtTop: false, required: { key: "url", label: "Link" },
        blank: function () { return { label: "", url: "" }; },
        fields: [T("label", "Name (e.g. LinkedIn)"), T("url", "Link (https://…)", "url")],
        summary: function (s) { return { title: s.label || s.url, sub: s.label ? s.url : "" }; }
      })];
    }
  };

  function renderSection(key) {
    var ed = EDITORS[key];
    if (!ed || !draft[key]) { sectionContent.innerHTML = '<div class="empty-note">Nothing to edit here.</div>'; return; }
    ed(draft[key]).forEach(function (c) { sectionContent.appendChild(c); });
  }

  /* ---------- page layout ---------- */
  function renderLayout() {
    var card = sectionCard("Page layout");
    card.appendChild(el("p", "muted", "Choose which sections appear on the site and the order they appear in."));
    var list = el("div", "item-list");
    function draw() {
      list.innerHTML = "";
      draft.sectionOrder.forEach(function (key, i) {
        var visible = draft.sectionVisibility[key] !== false;
        var r = el("div", "item-row");
        r.appendChild(el("div", "item-main", '<div class="item-title">' + esc(LABELS[key] || key) + '</div><div class="item-sub">' + (visible ? "Shown on the site" : "Hidden from the site") + "</div>"));
        var acts = el("div", "item-actions");
        var up = el("button", "btn btn-xs btn-ghost", "↑"), down = el("button", "btn btn-xs btn-ghost", "↓"), vis = el("button", "btn btn-xs btn-outline", visible ? "Hide" : "Show");
        up.type = down.type = vis.type = "button"; up.disabled = i === 0; down.disabled = i === draft.sectionOrder.length - 1;
        up.setAttribute("aria-label", "Move up"); down.setAttribute("aria-label", "Move down");
        function swap(d) { var j = i + d, o = draft.sectionOrder, t = o[i]; o[i] = o[j]; o[j] = t; markDirty(); renderSidebar(); draw(); }
        up.addEventListener("click", function () { swap(-1); }); down.addEventListener("click", function () { swap(1); });
        vis.addEventListener("click", function () { draft.sectionVisibility[key] = !visible; markDirty(); renderSidebar(); draw(); });
        acts.appendChild(up); acts.appendChild(down); acts.appendChild(vis); r.appendChild(acts); list.appendChild(r);
      });
    }
    draw(); card.appendChild(list); sectionContent.appendChild(card);
  }

  /* ---------- media library ---------- */
  function formatBytes(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB"; }

  function usedPaths() {
    var s = JSON.stringify(draft);
    return function (p) { return s.indexOf(JSON.stringify(p).slice(1, -1)) > -1; };
  }

  function renderMediaLibrary() {
    sectionContent.innerHTML = '<div class="empty-note">Loading media…</div>';
    api("/api/media-list").then(function (res) {
      if (!res.ok) return errorOf(res).then(function (m) { throw new Error(m || "Could not load media"); });
      return res.json();
    }).then(function (d) {
      var files = d.files || [], inUse = usedPaths();
      var card = sectionCard("Media library");
      card.appendChild(el("p", "muted", "Files marked “in use” appear somewhere in your current content. Delete only files you no longer need."));
      if (!files.length) card.appendChild(el("div", "empty-note", "No uploaded files yet."));
      var grid = el("div", "media-grid");
      files.forEach(function (f) {
        var isPdf = /\.pdf$/i.test(f.name), used = inUse(f.path);
        var item = el("div", "media-item");
        item.innerHTML = '<div class="frame">' + (isPdf ? "PDF" : '<img alt="" src="' + esc(imgSrc(f.path)) + '">') + '</div><button class="del" aria-label="Delete ' + esc(f.name) + '">✕</button>' +
          '<div class="name">' + esc(f.name) + " (" + formatBytes(f.size) + ")" + (used ? " · <b>in use</b>" : "") + "</div>";
        item.querySelector(".del").addEventListener("click", function () {
          var msg = used ? f.name + " is used on the site. Deleting it will leave a broken image. Delete anyway?" : "Delete " + f.name + "? This can't be undone.";
          if (!confirm(msg)) return;
          postJson("/api/media-delete", { path: f.path }).then(function (res) {
            if (!res.ok) return errorOf(res).then(function (m) { throw new Error(m || "Delete failed"); });
            toast("File deleted.", "ok"); renderMediaLibrary();
          }).catch(function (err) { toast("Could not delete: " + err.message, "err"); });
        });
        grid.appendChild(item);
      });
      card.appendChild(grid);
      sectionContent.innerHTML = ""; sectionContent.appendChild(card);
    }).catch(function (err) {
      if (err.message !== "Session expired") sectionContent.innerHTML = '<div class="empty-note">Could not load the media library: ' + esc(err.message) + "</div>";
    });
  }

  /* ---------- preview & publish ---------- */
  function cleanForPublish() {
    var c = clone(draft);
    c.skills.items = c.skills.items.map(function (s) { return s.trim(); }).filter(Boolean);
    c.about.languages = c.about.languages.map(function (s) { return s.trim(); }).filter(Boolean);
    c.achievements.items.forEach(function (a) { a.metrics = (a.metrics || []).filter(function (m) { return (m.label || "").trim() || (m.value || "").trim(); }); });
    return c;
  }

  $("previewBtn").addEventListener("click", function () {
    try { localStorage.setItem("siteContentDraft", JSON.stringify(cleanForPublish())); }
    catch (e) { return toast("Could not create the preview (browser storage is blocked).", "err"); }
    $("previewFrame").src = "../index.html?preview=1&t=" + Date.now();
    $("previewModal").classList.remove("hidden");
  });
  $("closePreviewBtn").addEventListener("click", function () { $("previewModal").classList.add("hidden"); });

  $("publishBtn").addEventListener("click", function () {
    var btn = $("publishBtn");
    btn.disabled = true; publishStatus.textContent = "Publishing…"; publishStatus.className = "publish-status";
    postJson("/api/publish", { content: cleanForPublish() }).then(function (res) {
      if (!res.ok) return errorOf(res).then(function (m) { throw new Error(m || "Publish failed (" + res.status + ")"); });
      publishedSnapshot = JSON.stringify(draft);
      store.remove(BACKUP_KEY);
      refreshDirty();
      publishStatus.textContent = "Published. GitHub Pages usually shows the update within 1–2 minutes.";
      publishStatus.className = "publish-status success";
      toast("Published.", "ok");
    }).catch(function (err) {
      if (err.message === "Session expired") return;
      publishStatus.textContent = "Publish failed: " + err.message; publishStatus.className = "publish-status error";
    }).then(function () { btn.disabled = false; });
  });

  function syncHeaderHeight() {
    var h = document.querySelector(".admin-header");
    if (h) document.documentElement.style.setProperty("--hdr-h", h.offsetHeight + "px");
  }
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("orientationchange", syncHeaderHeight);
  new MutationObserver(syncHeaderHeight).observe($("publishStatus"), { childList: true, characterData: true, subtree: true });
  setTimeout(syncHeaderHeight, 0);
  $("dashboardView") && new MutationObserver(syncHeaderHeight).observe($("dashboardView"), { attributes: true, attributeFilter: ["class"] });

  boot();
})();
