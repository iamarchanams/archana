const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // 8MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50MB — larger videos should use an external URL instead

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
    if (!/^media\/(images|videos)\/[a-zA-Z0-9._-]+$/.test(path)) {
      return res.status(400).json({ error: "Invalid upload path. Must be under media/images/ or media/videos/." });
    }

    const isVideo = path.startsWith("media/videos/");
    const isImage = path.startsWith("media/images/");
    const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: `Unsupported file type: ${contentType}` });
    }

    const approxBytes = Math.ceil((dataBase64.length * 3) / 4);
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (approxBytes > maxBytes) {
      return res.status(400).json({
        error: `File too large (${(approxBytes / 1024 / 1024).toFixed(1)}MB). Max is ${maxBytes / 1024 / 1024}MB. For larger videos, paste an external URL (e.g. YouTube/Vimeo) instead.`
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
