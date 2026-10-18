// Portfolio content API (Netlify Functions v2 + Netlify Blobs)
//
//   GET  /api/content/:type        public  -> JSON array (projects|awards|publications|blog|experience)
//   PUT  /api/content/:type        admin   -> replace the whole array
//   GET  /api/setup                public  -> {needsSetup}
//   POST /api/setup                {code, password} -> {token}   (first time only)
//   POST /api/login                {password} -> {token}
//   POST /api/password             admin   {current, next} -> {token}
//   GET  /api/me                   admin   -> {ok:true}
//   POST /api/media                admin   raw image body -> {url}
//   GET  /api/media/:key           public  -> the image
//
// Secrets (Netlify environment variables, never in git):
//   TOKEN_SECRET         long random string used to sign login tokens
//   SETUP_CODE_HASH      "scrypt$..." of the one-time setup code (only used before a password exists)
//   ADMIN_PASSWORD_HASH  optional fallback password hash (normally unset)
// The password chosen on the site is stored (hashed) in the "portfolio-auth" blob store.
import { getStore } from "@netlify/blobs";
import { scryptSync, timingSafeEqual, createHmac, randomBytes } from "node:crypto";

const TYPES = new Set(["projects", "awards", "publications", "blog", "experience"]);
const MAX_JSON = 2 * 1024 * 1024;          // 2 MB per content type
const MAX_MEDIA = 8 * 1024 * 1024;         // 8 MB per image
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const TOKEN_HOURS = 12;
const LOGIN_LIMIT = 8;                     // failed attempts per IP ...
const LOGIN_WINDOW_MS = 15 * 60 * 1000;    // ... per 15 minutes

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const b64url = buf => Buffer.from(buf).toString("base64url");

/* ---------- password storage ---------- */
const authStore = () => getStore("portfolio-auth");
const hashPw = pw => { const salt = randomBytes(16); return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 32).toString("hex")}`; };
function matches(pw, stored) {
  const [algo, saltHex, hashHex] = String(stored || "").split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex || typeof pw !== "string" || !pw) return false;
  const want = Buffer.from(hashHex, "hex");
  return timingSafeEqual(scryptSync(pw, Buffer.from(saltHex, "hex"), want.length), want);
}
async function currentHash() {
  return (await authStore().get("password")) || process.env.ADMIN_PASSWORD_HASH || "";
}
const validNewPassword = pw => typeof pw === "string" && pw.length >= 10 && pw.length <= 200;

/* ---------- tokens: signed with TOKEN_SECRET + the current password hash,
   so changing the password signs out every other session ---------- */
const keyFor = hash => `${process.env.TOKEN_SECRET}|${hash}`;
function sign(hash) {
  const body = b64url(JSON.stringify({ exp: Date.now() + TOKEN_HOURS * 3600 * 1000, n: b64url(randomBytes(9)) }));
  return `${body}.${createHmac("sha256", keyFor(hash)).update(body).digest("base64url")}`;
}
async function isAdmin(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.TOKEN_SECRET) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const hash = await currentHash();
  if (!hash) return false;
  const good = createHmac("sha256", keyFor(hash)).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

// Same-origin check for write requests (blocks cross-site form posts)
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/* ---------- brute-force protection (per IP) ---------- */
async function limiter(req, context, scope) {
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const key = `fail-${scope}-${ip.replace(/[^a-zA-Z0-9.:-]/g, "_")}`;
  const now = Date.now();
  const rec = (await authStore().get(key, { type: "json" })) || { n: 0, t: now };
  if (now - rec.t > LOGIN_WINDOW_MS) { rec.n = 0; rec.t = now; }
  return {
    blocked: rec.n >= LOGIN_LIMIT,
    fail: async () => { rec.n += 1; await authStore().setJSON(key, rec); await new Promise(r => setTimeout(r, 600)); },
    clear: () => authStore().delete(key),
  };
}
const tooMany = () => json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
const readBody = async req => { try { return await req.json(); } catch { return {}; } };

async function login(req, context) {
  const lim = await limiter(req, context, "login");
  if (lim.blocked) return tooMany();
  const body = await readBody(req);
  const hash = await currentHash();
  if (!hash) return json({ error: "No password yet. Use “Set up the editor” first." }, 409);
  if (!matches(body.password, hash)) { await lim.fail(); return json({ error: "Wrong password" }, 401); }
  await lim.clear();
  return json({ token: sign(hash) });
}

async function setup(req, context) {
  if (await currentHash()) return json({ error: "The editor is already set up. Please sign in." }, 409);
  const lim = await limiter(req, context, "setup");
  if (lim.blocked) return tooMany();
  const body = await readBody(req);
  const code = String(body.code || "").trim().toUpperCase();
  if (!matches(code, process.env.SETUP_CODE_HASH)) { await lim.fail(); return json({ error: "Wrong setup code" }, 401); }
  if (!validNewPassword(body.password)) return json({ error: "Use a password of at least 10 characters." }, 400);
  const hash = hashPw(body.password);
  await authStore().set("password", hash);
  await lim.clear();
  return json({ token: sign(hash) });
}

async function changePassword(req, context) {
  if (!(await isAdmin(req))) return json({ error: "Not signed in" }, 401);
  const lim = await limiter(req, context, "change");
  if (lim.blocked) return tooMany();
  const body = await readBody(req);
  if (!matches(body.current, await currentHash())) { await lim.fail(); return json({ error: "Your current password is not correct" }, 401); }
  if (!validNewPassword(body.next)) return json({ error: "Use a new password of at least 10 characters." }, 400);
  const hash = hashPw(body.next);
  await authStore().set("password", hash);
  await lim.clear();
  return json({ token: sign(hash) });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [route, arg] = parts;
  const method = req.method;

  try {
    if (["login", "setup", "password"].includes(route) && method === "POST" && !sameOrigin(req)) return json({ error: "Bad origin" }, 403);
    if (route === "login" && method === "POST") return await login(req, context);
    if (route === "setup" && method === "POST") return await setup(req, context);
    if (route === "setup" && method === "GET") return json({ needsSetup: !(await currentHash()) });
    if (route === "password" && method === "POST") return await changePassword(req, context);

    if (route === "me" && method === "GET") {
      return (await isAdmin(req)) ? json({ ok: true }) : json({ error: "Not signed in" }, 401);
    }

    if (route === "content" && TYPES.has(arg)) {
      const store = getStore("portfolio-content");
      if (method === "GET") {
        const data = await store.get(arg, { type: "json" });
        if (data == null) return json({ error: "empty" }, 404);
        return json(data, 200, { "cache-control": "public, max-age=0, must-revalidate" });
      }
      if (method === "PUT") {
        if (!(await isAdmin(req))) return json({ error: "Not signed in" }, 401);
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
        if (!(await isAdmin(req))) return json({ error: "Not signed in" }, 401);
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
