import fs from "node:fs";

const bundleUrl = new URL("../dist/index.js", import.meta.url);
const bundle = fs.readFileSync(bundleUrl, "utf8");
const normalizedBundle = bundle.replace(/[ \t]+$/gm, "");

if (normalizedBundle !== bundle) {
  fs.writeFileSync(bundleUrl, normalizedBundle);
}
