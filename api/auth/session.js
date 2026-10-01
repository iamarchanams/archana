const config = require("../_lib/config");
const jwt = require("../_lib/jwt");
const { parseCookies } = require("../_lib/cookies");
const { handlePreflight, applyCors } = require("../_lib/cors");

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  try {
    const cookies = parseCookies(req);
    jwt.verify(cookies.admin_session, config.SESSION_SECRET());
    res.status(200).json({ authenticated: true });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
};
