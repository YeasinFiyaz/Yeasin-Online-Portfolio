// Portfolio content API (Netlify Functions v2 + Netlify Blobs)
//
//   GET  /api/content/:type        public  -> JSON array (projects|awards|publications|blog|experience)
//   PUT  /api/content/:type        admin   -> replace the whole array
//   POST /api/login                {password} -> {token}
//   GET  /api/me                   admin   -> {ok:true}
//   POST /api/media                admin   raw image body -> {url}
//   GET  /api/media/:key           public  -> the image
//
// Secrets (Netlify environment variables, never in git):
//   ADMIN_PASSWORD_HASH  "scrypt$<salt hex>$<hash hex>"  (make with: npm run set-password)
//   TOKEN_SECRET         long random string used to sign login tokens
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

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", process.env.TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !process.env.TOKEN_SECRET) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const good = createHmac("sha256", process.env.TOKEN_SECRET).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now();
  } catch { return false; }
}

function checkPassword(pw) {
  const stored = process.env.ADMIN_PASSWORD_HASH || "";
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex || typeof pw !== "string" || !pw) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = scryptSync(pw, Buffer.from(saltHex, "hex"), want.length);
  return timingSafeEqual(got, want);
}

const isAdmin = req => verify((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));

// Same-origin check for write requests (blocks cross-site form posts)
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

async function login(req, context) {
  const store = getStore("portfolio-auth");
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const key = `fail-${ip.replace(/[^a-zA-Z0-9.:-]/g, "_")}`;
  const now = Date.now();
  const rec = (await store.get(key, { type: "json" })) || { n: 0, t: now };
  if (now - rec.t > LOGIN_WINDOW_MS) { rec.n = 0; rec.t = now; }
  if (rec.n >= LOGIN_LIMIT) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);

  let body = {};
  try { body = await req.json(); } catch {}
  if (!checkPassword(body.password)) {
    rec.n += 1;
    await store.setJSON(key, rec);
    await new Promise(r => setTimeout(r, 600));
    return json({ error: "Wrong password" }, 401);
  }
  await store.delete(key);
  return json({ token: sign({ exp: now + TOKEN_HOURS * 3600 * 1000, n: b64url(randomBytes(9)) }) });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [route, arg] = parts;
  const method = req.method;

  try {
    if (route === "login" && method === "POST") {
      if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
      return await login(req, context);
    }

    if (route === "me" && method === "GET") {
      return isAdmin(req) ? json({ ok: true }) : json({ error: "Not signed in" }, 401);
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
