const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

const CONTENT_PATH = "content/site-content.json";

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const content = req.body && req.body.content;
    if (!content || typeof content !== "object") {
      return res.status(400).json({ error: "Missing content in request body" });
    }

    // Minimal shape check so a malformed draft can't wipe the site content.
    // Generic check: core structural keys must exist, and every section named
    // in sectionOrder must have matching content (works for any schema).
    const baseKeys = ["meta", "sectionOrder", "sectionVisibility"];
    for (const key of baseKeys) {
      if (!(key in content)) return res.status(400).json({ error: `Content is missing "${key}"` });
    }
    if (!Array.isArray(content.sectionOrder)) {
      return res.status(400).json({ error: `"sectionOrder" must be a list` });
    }
    for (const key of content.sectionOrder) {
      if (!(key in content)) return res.status(400).json({ error: `Content is missing section "${key}"` });
    }

    const existing = await github.getFile(CONTENT_PATH);
    const jsonStr = JSON.stringify(content, null, 2);
    const base64 = Buffer.from(jsonStr, "utf8").toString("base64");

    const result = await github.putFile(
      CONTENT_PATH,
      base64,
      `Update site content via admin panel`,
      existing ? existing.sha : undefined
    );

    res.status(200).json({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) {
    res.status(500).json({ error: err.message || "Publish failed" });
  }
};
