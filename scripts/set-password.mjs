// Sets (or changes) the editor password on Netlify, then republishes the site so it takes effect.
// Usage (from the project folder):  npm run set-password -- "your new password"
import { scryptSync, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE = "d5f33078-5042-437a-8986-81e8c8c072c3";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Please give a password of at least 10 characters:  npm run set-password -- "your password"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 32);
const run = args => execFileSync("netlify", args, { stdio: "inherit", shell: true, cwd: ROOT });

console.log("Saving the password (only a scrambled version is stored)...");
run(["env:set", "ADMIN_PASSWORD_HASH", `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`, "--site", SITE, "--force"]);
// a fresh signing key also signs out any old editor sessions
run(["env:set", "TOKEN_SECRET", randomBytes(32).toString("hex"), "--site", SITE, "--force"]);
console.log("Republishing the website so the new password works...");
run(["deploy", "--prod", "--site", SITE, "--message", '"Editor password changed"']);
console.log("\nDone. Sign in at https://yeasinfiyaz.netlify.app/admin/");
