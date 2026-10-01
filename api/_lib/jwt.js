// Minimal, dependency-free HS256 JWT implementation (sign + verify only).
// Avoids needing `npm install` for a third-party JWT library.
const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function sign(payload, secret, expiresInSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, {
    iat: now,
    exp: expiresInSeconds ? now + expiresInSeconds : now + 60 * 60 * 8 // default 8h
  });
  const headerPart = base64url(JSON.stringify(header));
  const bodyPart = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerPart}.${bodyPart}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${headerPart}.${bodyPart}.${signature}`;
}

function verify(token, secret) {
  if (!token || typeof token !== "string") throw new Error("No token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerPart, bodyPart, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerPart}.${bodyPart}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid signature");
  }
  const payload = JSON.parse(base64urlDecode(bodyPart));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("Token expired");
  }
  return payload;
}

module.exports = { sign, verify };
