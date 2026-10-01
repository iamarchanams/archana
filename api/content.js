const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

// Returns the newest published content straight from GitHub, so the admin panel
// never edits a stale copy while GitHub Pages is still rebuilding.
module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const file = await github.getFile("content/site-content.json");
    if (!file) return res.status(404).json({ error: "content/site-content.json not found" });
    const json = JSON.parse(Buffer.from(file.contentBase64, "base64").toString("utf8"));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ content: json });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not load content" });
  }
};
