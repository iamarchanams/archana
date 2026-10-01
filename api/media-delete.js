const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { path } = req.body || {};
    if (!path || !/^media\/(images|videos)\/[a-zA-Z0-9._-]+$/.test(path)) {
      return res.status(400).json({ error: "Invalid media path" });
    }

    const existing = await github.getFile(path);
    if (!existing) return res.status(404).json({ error: "File not found" });

    await github.deleteFile(path, existing.sha, `Delete ${path} via admin panel`);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Delete failed" });
  }
};
