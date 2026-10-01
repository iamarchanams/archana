const requireAuth = require("./_lib/requireAuth");
const github = require("./_lib/github");
const { handlePreflight } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const [images, videos] = await Promise.all([
      github.listDir("media/images"),
      github.listDir("media/videos")
    ]);

    const toEntry = (item) => ({
      path: item.path,
      name: item.name,
      size: item.size,
      sha: item.sha
    });

    const files = [
      ...images.filter((i) => i.type === "file" && i.name !== ".gitkeep").map(toEntry),
      ...videos.filter((i) => i.type === "file" && i.name !== ".gitkeep").map(toEntry)
    ];

    res.status(200).json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not list media" });
  }
};
