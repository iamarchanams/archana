const config = require("../_lib/config");
const jwt = require("../_lib/jwt");
const { serializeCookie } = require("../_lib/cookies");
const { handlePreflight, applyCors } = require("../_lib/cors");

// Very small brute-force slow-down: a short delay on every attempt.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await delay(400);

  const pin = req.body && req.body.pin;
  if (!pin || typeof pin !== "string") {
    return res.status(400).json({ error: "Missing PIN" });
  }

  const correctPin = config.ADMIN_PIN();
  const a = Buffer.from(pin);
  const b = Buffer.from(correctPin);
  const match = a.length === b.length && require("crypto").timingSafeEqual(a, b);

  if (!match) {
    return res.status(401).json({ error: "Incorrect PIN" });
  }

  const sessionToken = jwt.sign({ admin: true }, config.SESSION_SECRET(), 60 * 60 * 8);
  res.setHeader("Set-Cookie", serializeCookie("admin_session", sessionToken, { maxAge: 60 * 60 * 8 }));
  res.status(200).json({ ok: true });
};
