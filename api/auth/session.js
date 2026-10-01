const config = require("../_lib/config");
const jwt = require("../_lib/jwt");
const requireAuth = require("../_lib/requireAuth");
const { handlePreflight, applyCors } = require("../_lib/cors");

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  try {
    jwt.verify(requireAuth.getToken(req), config.SESSION_SECRET());
    res.status(200).json({ authenticated: true });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
};
