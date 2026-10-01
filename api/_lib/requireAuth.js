const config = require("./config");
const jwt = require("./jwt");
const { parseCookies } = require("./cookies");

// Returns the session payload, or sends a 401 and returns null.
function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);
    return jwt.verify(cookies.admin_session, config.SESSION_SECRET());
  } catch (err) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}

module.exports = requireAuth;
