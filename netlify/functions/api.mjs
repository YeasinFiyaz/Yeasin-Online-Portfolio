// Portfolio content API (Netlify Functions v2 + Netlify Blobs)
//
//   GET  /api/content/:type        public  -> JSON array (projects|awards|publications|blog|experience)
//   PUT  /api/content/:type        admin   -> replace the whole array
//   GET  /api/config               public  -> {googleClientId}
//   POST /api/google               {credential} (Google ID token) -> {token, email, role}
//   GET  /api/me                   admin   -> {email, role}
//   POST /api/media                admin   raw image body -> {url}
//   GET  /api/media/:key           public  -> the image
//
// Sign-in is "Sign in with Google". Only allowed Google accounts get in:
//   SUPERADMIN (always): yeasinfiyaz@gmail.com
//   ADMIN_EMAILS (optional env, comma separated): extra editors
// Netlify environment variables:
//   GOOGLE_CLIENT_ID     the OAuth Web client ID from Google Cloud (public value)
//   TOKEN_SECRET         long random string used to sign editor sessions (secret)
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, createHmac, randomBytes } from "node:crypto";

const SUPERADMIN = "yeasinfiyaz@gmail.com";

const TYPES = new Set(["projects", "awards", "publications", "blog", "experience"]);
const MAX_JSON = 2 * 1024 * 1024;          // 2 MB per content type
const MAX_MEDIA = 8 * 1024 * 1024;         // 8 MB per image
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const TOKEN_HOURS = 12;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const b64url = buf => Buffer.from(buf).toString("base64url");

/* ---------- who may edit ---------- */
const allowed = () => new Set([SUPERADMIN, ...String(process.env.ADMIN_EMAILS || "").split(",")].map(e => e.trim().toLowerCase()).filter(Boolean));
const roleOf = email => (email === SUPERADMIN ? "superadmin" : "admin");

/* ---------- editor sessions (signed, 12 hours) ---------- */
function sign(email) {
  const body = b64url(JSON.stringify({ email, exp: Date.now() + TOKEN_HOURS * 3600 * 1000, n: b64url(randomBytes(9)) }));
  return `${body}.${createHmac("sha256", process.env.TOKEN_SECRET).update(body).digest("base64url")}`;
}
function session(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.TOKEN_SECRET) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const good = createHmac("sha256", process.env.TOKEN_SECRET).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    // still on the allow-list and not expired
    return p.exp > Date.now() && allowed().has(p.email) ? p : null;
  } catch { return null; }
}
const isAdmin = req => !!session(req);

// Same-origin check for write requests (blocks cross-site form posts)
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/* ---------- Google sign-in: verify the ID token with Google ---------- */
async function googleLogin(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return json({ error: "Google sign-in is not configured yet." }, 503);
  let body = {};
  try { body = await req.json(); } catch {}
  const cred = String(body.credential || "");
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(cred)) return json({ error: "Invalid sign-in response" }, 400);
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cred)}`);
  if (!r.ok) return json({ error: "Google could not confirm this sign-in. Please try again." }, 401);
  const info = await r.json();
  const email = String(info.email || "").toLowerCase();
  const ok = info.aud === clientId
    && ["accounts.google.com", "https://accounts.google.com"].includes(info.iss)
    && (info.email_verified === true || info.email_verified === "true")
    && Number(info.exp) * 1000 > Date.now();
  if (!ok) return json({ error: "Google could not confirm this sign-in. Please try again." }, 401);
  if (!allowed().has(email)) return json({ error: `${email} is not allowed to edit this portfolio.` }, 403);
  return json({ token: sign(email), email, role: roleOf(email) });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [route, arg] = parts;
  const method = req.method;

  try {
    if (route === "config" && method === "GET") return json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
    if (route === "google" && method === "POST") {
      if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
      return await googleLogin(req);
    }
    if (route === "me" && method === "GET") {
      const s = session(req);
      return s ? json({ email: s.email, role: roleOf(s.email) }) : json({ error: "Not signed in" }, 401);
    }

    if (route === "content" && TYPES.has(arg)) {
      const store = getStore("portfolio-content");
      if (method === "GET") {
        const data = await store.get(arg, { type: "json" });
        if (data == null) return json({ error: "empty" }, 404);
        return json(data, 200, { "cache-control": "public, max-age=0, must-revalidate" });
      }
      if (method === "PUT") {
        if (!isAdmin(req)) return json({ error: "Not signed in" }, 401);
        if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
        const text = await req.text();
        if (text.length > MAX_JSON) return json({ error: "Too large" }, 413);
        let data;
        try { data = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
        if (!Array.isArray(data)) return json({ error: "Expected a list" }, 400);
        // keep a rolling backup of the previous version
        const prev = await store.get(arg, { type: "json" });
        if (prev) await getStore("portfolio-backups").setJSON(`${arg}-${new Date().toISOString()}`, prev);
        await store.setJSON(arg, data);
        return json({ ok: true, count: data.length });
      }
    }

    if (route === "media") {
      const store = getStore("portfolio-media");
      if (method === "POST" && !arg) {
        if (!isAdmin(req)) return json({ error: "Not signed in" }, 401);
        if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
        const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!IMAGE_TYPES.has(type)) return json({ error: "Only JPG, PNG, WEBP, GIF or AVIF images" }, 415);
        const buf = await req.arrayBuffer();
        if (buf.byteLength > MAX_MEDIA) return json({ error: "Image is larger than 8 MB" }, 413);
        const ext = type.split("/")[1].replace("jpeg", "jpg");
        const key = `${Date.now().toString(36)}-${b64url(randomBytes(6))}.${ext}`;
        await store.set(key, buf, { metadata: { type } });
        return json({ url: `/api/media/${key}` });
      }
      if (method === "GET" && arg && /^[a-zA-Z0-9_-]+\.[a-z]+$/.test(arg)) {
        const res = await store.getWithMetadata(arg, { type: "arrayBuffer" });
        if (!res) return new Response("Not found", { status: 404 });
        return new Response(res.data, {
          headers: {
            "content-type": res.metadata?.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
};

export const config = { path: "/api/*" };
