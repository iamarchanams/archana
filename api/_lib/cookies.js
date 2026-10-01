function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function serializeCookie(name, value, options) {
  options = options || {};
  let str = `${name}=${encodeURIComponent(value)}`;
  str += `; Path=${options.path || "/"}`;
  if (options.maxAge != null) str += `; Max-Age=${options.maxAge}`;
  str += `; HttpOnly`;
  str += `; Secure`;
  str += `; SameSite=${options.sameSite || "None"}`; // None: admin (GH Pages) and API (Vercel) are different origins
  return str;
}

module.exports = { parseCookies, serializeCookie };
