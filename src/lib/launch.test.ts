import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

test("Windows one-click: CLICK ME.bat starts desk on 8787", () => {
  const bat = read("CLICK ME.bat");
  assert.match(bat, /127\.0\.0\.1:8787/);
  assert.match(bat, /npm run desk/);
  assert.match(bat, /package\.json/);
});

test("Windows one-click: start-desk.bat starts desk on 8787", () => {
  const bat = read("start-desk.bat");
  assert.match(bat, /127\.0\.0\.1:8787/);
  assert.match(bat, /npm run desk/);
  assert.equal(bat, read("CLICK ME.bat"));
});

test("Windows pin-to-desktop.ps1 points at start-desk.bat and Desktop", () => {
  const ps1 = read("pin-to-desktop.ps1");
  assert.match(ps1, /start-desk\.bat/);
  assert.match(ps1, /GetFolderPath\("Desktop"\)/);
  assert.match(ps1, /AGENT 2\.0\.lnk/);
  assert.match(ps1, /public\\agent\.ico/);
  const icoPath = join(root, "public/agent.ico");
  assert.equal(existsSync(icoPath), true);
  const ico = readFileSync(icoPath);
  assert.equal(ico[0], 0);
  assert.equal(ico[1], 0);
  assert.equal(ico[2], 1);
  assert.equal(ico[3], 0);
  assert.ok(ico.length > 64, "ico must contain an image payload");
});

test("npm run desk binds 8787", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.desk, /--port 8787/);
  assert.match(pkg.scripts.desk, /127\.0\.0\.1/);
});
