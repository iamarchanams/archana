// Shared by the public site and the admin panel.
// Fills in any fields/sections that older content files don't have yet, so
// existing content keeps working while new features (images, custom metrics,
// gallery, socials) become available. Safe to run on already-updated content.
(function (root) {
  "use strict";

  var ALL_SECTIONS = ["home", "about", "skills", "experience", "education", "certifications", "achievements", "gallery", "contact"];

  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? "" : String(v); }

  function normalize(c) {
    c = c && typeof c === "object" ? c : {};
    c.meta = Object.assign({ siteTitle: "", seoDescription: "", seoKeywords: "", favicon: "favicon.svg" }, c.meta);
    if (!c.meta.favicon || /favicon\.png$/.test(c.meta.favicon)) c.meta.favicon = "favicon.svg";

    c.sectionOrder = arr(c.sectionOrder).slice();
    c.sectionVisibility = Object.assign({}, c.sectionVisibility);
    ALL_SECTIONS.forEach(function (key) {
      if (c.sectionOrder.indexOf(key) === -1) {
        // new sections go just before Contact
        var at = c.sectionOrder.indexOf("contact");
        if (at === -1) c.sectionOrder.push(key); else c.sectionOrder.splice(at, 0, key);
      }
      if (!(key in c.sectionVisibility)) c.sectionVisibility[key] = true;
    });

    c.home = Object.assign({ name: "", headline: "", tagline: "", photo: "", ctaContactText: "Get in Touch", ctaResumeText: "Download Resume", resumeFile: "", photoStyle: "square", photoAnimation: "float-glow" }, c.home);
    if (["square", "transparent", "circle"].indexOf(c.home.photoStyle) === -1) c.home.photoStyle = "square";
    if (["float-glow", "float", "glow", "none"].indexOf(c.home.photoAnimation) === -1) c.home.photoAnimation = "float-glow";
    c.about = Object.assign({ heading: "About Me", bio: "", location: "", languages: [] }, c.about);
    c.about.languages = arr(c.about.languages);

    c.skills = Object.assign({ heading: "Skills", items: [] }, c.skills);
    c.skills.items = arr(c.skills.items);

    c.experience = Object.assign({ heading: "Experience", items: [] }, c.experience);
    c.experience.items = arr(c.experience.items).map(function (e) {
      return Object.assign({ role: "", company: "", duration: "", description: "", points: [], image: "" }, e, { points: arr(e && e.points) });
    });

    c.education = Object.assign({ heading: "Education", items: [] }, c.education);
    c.education.items = arr(c.education.items).map(function (e) {
      return Object.assign({ degree: "", institution: "", score: "", year: "" }, e);
    });

    c.certifications = Object.assign({ heading: "Certifications", items: [] }, c.certifications);
    c.certifications.items = arr(c.certifications.items).map(function (e) {
      return Object.assign({ title: "", institution: "", year: "", description: "", credentialUrl: "", image: "" }, e);
    });

    c.achievements = Object.assign({ heading: "Performance Highlights", subheading: "", items: [] }, c.achievements);
    c.achievements.items = arr(c.achievements.items).map(function (a) {
      a = Object.assign({ period: "", title: "", summary: "", metrics: null, image: "" }, a);
      if (!Array.isArray(a.metrics)) {
        // migrate the old fixed fields into the new flexible list
        a.metrics = [];
        if (a.closings) a.metrics.push({ label: "Closings", value: str(a.closings) });
        if (a.revenue) a.metrics.push({ label: "Revenue", value: str(a.revenue) });
        if (a.dealValue) a.metrics.push({ label: "Deal Value", value: str(a.dealValue) });
      }
      delete a.closings; delete a.revenue; delete a.dealValue;
      return a;
    });

    c.gallery = Object.assign({ heading: "Career Gallery", subheading: "Moments and milestones from my career.", items: [] }, c.gallery);
    c.gallery.items = arr(c.gallery.items).map(function (g) {
      return Object.assign({ title: "", description: "", date: "", image: "" }, g);
    });

    c.contact = Object.assign({ heading: "Get in Touch", subheading: "", phone: "", email: "", location: "", socials: [] }, c.contact);
    c.contact.socials = arr(c.contact.socials);

    // floating quick-contact buttons (blank number/address = use the contact details above)
    var f = c.contact.floating && typeof c.contact.floating === "object" ? c.contact.floating : {};
    c.contact.floating = {
      enabled: f.enabled !== false,
      position: f.position === "left" ? "left" : "right",
      whatsapp: Object.assign({ enabled: true, number: "", message: "Hi! I saw your portfolio and would like to connect." }, f.whatsapp),
      call: Object.assign({ enabled: true, number: "" }, f.call),
      email: Object.assign({ enabled: true, address: "", subject: "Enquiry from your portfolio" }, f.email)
    };

    return c;
  }

  root.normalizeContent = normalize;
  root.ALL_SECTIONS = ALL_SECTIONS;
})(window);
