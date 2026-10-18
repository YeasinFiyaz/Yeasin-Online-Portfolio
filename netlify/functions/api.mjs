// Portfolio admin API (Netlify Functions v2 + Netlify Blobs)
//
//   GET  /api/content/:type        public  -> JSON array (projects|awards|publications|blog|experience|settings)
//   PUT  /api/content/:type        admin   -> replace the whole array
//   GET  /api/auth/status          public  -> {hasAccount}
//   POST /api/auth/setup           {email, password} -> {token}   (only once, only the owner's email)
//   POST /api/auth/login           {email, password} -> {token}
//   POST /api/auth/password        admin   {current, next} -> {token}
//   GET  /api/me                   admin   -> {email, role}
//   POST /api/media                admin   raw image body -> {url}
//   GET  /api/media/:key           public  -> the image
//
// Environment variable (Netlify, never in git):
//   TOKEN_SECRET   long random string used to sign admin sessions
// The admin password is stored only as a scrypt hash in the "portfolio-auth" blob store.
import { getStore } from "@netlify/blobs";
import { scryptSync, timingSafeEqual, createHmac, randomBytes } from "node:crypto";

const OWNER = "yeasinfiyaz@gmail.com";       // the only account that can be the admin
const TYPES = new Set(["projects", "awards", "publications", "blog", "experience", "settings"]);
const MAX_JSON = 2 * 1024 * 1024;            // 2 MB per content type
const MAX_MEDIA = 8 * 1024 * 1024;           // 8 MB per image
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const TOKEN_DAYS = 7;
const LIMIT = 8;                             // failed attempts per IP ...
const WINDOW_MS = 15 * 60 * 1000;            // ... per 15 minutes

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
const b64url = buf => Buffer.from(buf).toString("base64url");
const readBody = async req => { try { return await req.json(); } catch { return {}; } };
const normEmail = e => String(e || "").trim().toLowerCase();

/* ---------- account (hashed password in Blobs) ---------- */
const authStore = () => getStore("portfolio-auth");
const getAccount = async () => (await authStore().get("account", { type: "json" })) || null;   // {email, hash, gen}
const hashPw = pw => { const salt = randomBytes(16); return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 32).toString("hex")}`; };
function matches(pw, stored) {
  const [algo, saltHex, hashHex] = String(stored || "").split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex || typeof pw !== "string" || !pw) return false;
  const want = Buffer.from(hashHex, "hex");
  return timingSafeEqual(scryptSync(pw, Buffer.from(saltHex, "hex"), want.length), want);
}
const validPw = pw => typeof pw === "string" && pw.length >= 8 && pw.length <= 200;

/* ---------- sessions: signed with TOKEN_SECRET + account generation,
   so changing the password signs out every other device ---------- */
const keyFor = acc => `${process.env.TOKEN_SECRET}|${acc.gen}`;
function sign(acc) {
  const body = b64url(JSON.stringify({ email: acc.email, exp: Date.now() + TOKEN_DAYS * 86400 * 1000, n: b64url(randomBytes(9)) }));
  return `${body}.${createHmac("sha256", keyFor(acc)).update(body).digest("base64url")}`;
}
async function session(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.TOKEN_SECRET) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const acc = await getAccount();
  if (!acc) return null;
  const good = createHmac("sha256", keyFor(acc)).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() && p.email === acc.email ? acc : null;
  } catch { return null; }
}

// Same-origin check for write requests (blocks cross-site form posts)
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/* ---------- brute-force protection (per IP) ---------- */
async function limiter(req, context) {
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const key = `fail-${ip.replace(/[^a-zA-Z0-9.:-]/g, "_")}`;
  const now = Date.now();
  const rec = (await authStore().get(key, { type: "json" })) || { n: 0, t: now };
  if (now - rec.t > WINDOW_MS) { rec.n = 0; rec.t = now; }
  return {
    blocked: rec.n >= LIMIT,
    fail: async () => { rec.n += 1; await authStore().setJSON(key, rec); await new Promise(r => setTimeout(r, 600)); },
    clear: () => authStore().delete(key),
  };
}
const tooMany = () => json({ error: "Too many attempts. Please wait 15 minutes and try again." }, 429);

async function auth(action, req, context) {
  if (action === "status") return json({ hasAccount: !!(await getAccount()) });

  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const lim = await limiter(req, context);
  if (lim.blocked) return tooMany();
  const body = await readBody(req);

  if (action === "setup") {
    if (await getAccount()) return json({ error: "The admin account already exists. Please sign in." }, 409);
    if (normEmail(body.email) !== OWNER) { await lim.fail(); return json({ error: "Only the portfolio owner's email can create the admin account." }, 403); }
    if (!validPw(body.password)) return json({ error: "Use a password of at least 8 characters." }, 400);
    const acc = { email: OWNER, hash: hashPw(body.password), gen: b64url(randomBytes(9)), created: new Date().toISOString() };
    await authStore().setJSON("account", acc);
    await lim.clear();
    return json({ token: sign(acc), email: acc.email, role: "superadmin" });
  }

  if (action === "login") {
    const acc = await getAccount();
    if (!acc) return json({ error: "No admin account yet. Create it first." }, 409);
    if (normEmail(body.email) !== acc.email || !matches(body.password, acc.hash)) { await lim.fail(); return json({ error: "Wrong email or password" }, 401); }
    await lim.clear();
    return json({ token: sign(acc), email: acc.email, role: "superadmin" });
  }

  if (action === "password") {
    const acc = await session(req);
    if (!acc) return json({ error: "Not signed in" }, 401);
    if (!matches(body.current, acc.hash)) { await lim.fail(); return json({ error: "Your current password is not correct" }, 400); }
    if (!validPw(body.next)) return json({ error: "Use a new password of at least 8 characters." }, 400);
    const next = { ...acc, hash: hashPw(body.next), gen: b64url(randomBytes(9)), changed: new Date().toISOString() };
    await authStore().setJSON("account", next);
    await lim.clear();
    return json({ token: sign(next) });
  }
  return json({ error: "Not found" }, 404);
}

export default async (req, context) => {
  const url = new URL(req.url);
  const [route, arg] = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = req.method;

  try {
    if (route === "auth" && (method === "POST" || arg === "status")) return await auth(arg, req, context);

    if (route === "me" && method === "GET") {
      const acc = await session(req);
      return acc ? json({ email: acc.email, role: "superadmin" }) : json({ error: "Not signed in" }, 401);
    }

    if (route === "content" && TYPES.has(arg)) {
      const store = getStore("portfolio-content");
      if (method === "GET") {
        const data = await store.get(arg, { type: "json" });
        if (data == null) return json({ error: "empty" }, 404);
        return json(data, 200, { "cache-control": "public, max-age=0, must-revalidate" });
      }
      if (method === "PUT") {
        if (!(await session(req))) return json({ error: "Not signed in" }, 401);
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
        if (!(await session(req))) return json({ error: "Not signed in" }, 401);
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
