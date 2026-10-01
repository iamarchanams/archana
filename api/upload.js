const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_FILE_TYPES = ["application/pdf"];
// Vercel serverless functions accept ~4.5MB request bodies and base64 adds ~33%,
// so the real file limit is about 3MB. The admin panel shrinks photos before upload.
const MAX_BYTES = 3.2 * 1024 * 1024;

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { path, contentType, dataBase64 } = req.body || {};
    if (!path || !contentType || !dataBase64) {
      return res.status(400).json({ error: "Missing path, contentType, or dataBase64" });
    }
    if (!/^media\/(images|files)\/[a-zA-Z0-9._-]+$/.test(path)) {
      return res.status(400).json({ error: "Invalid upload path. Must be under media/images/ or media/files/." });
    }

    const isFile = path.startsWith("media/files/");
    const allowedTypes = isFile ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: `Unsupported file type: ${contentType}` });
    }

    const approxBytes = Math.ceil((dataBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return res.status(400).json({
        error: `File too large (${(approxBytes / 1024 / 1024).toFixed(1)}MB). Max is 3MB.`
      });
    }

    const existing = await github.getFile(path).catch(() => null);
    const result = await github.putFile(
      path,
      dataBase64,
      `Upload ${path} via admin panel`,
      existing ? existing.sha : undefined
    );

    res.status(200).json({ ok: true, path, commit: result.commit && result.commit.sha });
  } catch (err) {
    res.status(500).json({ error: err.message || "Upload failed" });
  }
};
