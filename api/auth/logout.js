const { serializeCookie } = require("../_lib/cookies");
const { handlePreflight, applyCors } = require("../_lib/cors");

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  res.setHeader("Set-Cookie", serializeCookie("admin_session", "", { maxAge: 0 }));
  res.status(200).json({ ok: true });
};
