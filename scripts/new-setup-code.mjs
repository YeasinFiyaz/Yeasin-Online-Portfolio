// Makes a NEW one-time setup code for the editor (use it the first time, or if you forget your password).
// It clears the current editor password, saves the new code to EDITOR-SETUP-CODE.txt in this folder
// and republishes the site. Then open https://yeasinfiyaz.netlify.app/admin/ and choose a new password.
//
// Usage (from the project folder):  npm run new-setup-code
import { scryptSync, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getStore } from "@netlify/blobs";

const SITE = "d5f33078-5042-437a-8986-81e8c8c072c3";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = args => execFileSync("netlify", args, { stdio: "inherit", shell: true, cwd: ROOT });

// readable code without look-alike characters, e.g. K7PM-2QXH
const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pick = n => [...randomBytes(n)].map(b => ABC[b % ABC.length]).join("");
const code = `${pick(4)}-${pick(4)}`;
const salt = randomBytes(16);
const codeHash = `scrypt$${salt.toString("hex")}$${scryptSync(code, salt, 32).toString("hex")}`;

// 1) clear the stored password (uses this PC's Netlify login)
const cfg = JSON.parse(readFileSync(join(process.env.APPDATA || join(process.env.HOME, ".config"), "netlify", "Config", "config.json"), "utf8"));
const token = cfg.users?.[cfg.userId]?.auth?.token;
if (!token) { console.error("Not logged in to Netlify on this PC. Run: netlify login"); process.exit(1); }
await getStore({ name: "portfolio-auth", siteID: SITE, token }).delete("password");

// 2) new setup code (only a scrambled version goes to Netlify) + a fresh signing key (signs out every session)
run(["env:set", "SETUP_CODE_HASH", codeHash, "--site", SITE, "--force"]);
run(["env:set", "TOKEN_SECRET", randomBytes(32).toString("hex"), "--site", SITE, "--force"]);
run(["env:unset", "ADMIN_PASSWORD_HASH", "--site", SITE, "--force"]);

// 3) save the code locally (this file is never uploaded to GitHub)
writeFileSync(join(ROOT, "EDITOR-SETUP-CODE.txt"),
  `Portfolio editor - one-time setup code\r\n\r\n    ${code}\r\n\r\n` +
  `1. Open https://yeasinfiyaz.netlify.app/admin/\r\n` +
  `2. Enter this code and choose your password (at least 10 characters).\r\n` +
  `The code stops working as soon as your password is set.\r\n` +
  `Made: ${new Date().toLocaleString()}\r\n`);

// 4) republish so the site picks up the new settings
run(["deploy", "--prod", "--site", SITE, "--message", '"New editor setup code"']);
console.log("\nDone. Your setup code is in EDITOR-SETUP-CODE.txt in this folder.");
