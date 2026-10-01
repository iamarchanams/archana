const config = require("./config");
const jwt = require("./jwt");
const { parseCookies } = require("./cookies");

// Reads the session token from the Authorization header (preferred, works on every
// browser) or from the admin_session cookie (fallback).
function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return parseCookies(req).admin_session;
}

// Returns the session payload, or sends a 401 and returns null.
function requireAuth(req, res) {
  try {
    return jwt.verify(getToken(req), config.SESSION_SECRET());
  } catch (err) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}

requireAuth.getToken = getToken;
module.exports = requireAuth;
