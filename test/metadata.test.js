import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import { ActionType } from "../src/actionType.js";

test("action metadata exposes every supported operation", () => {
  const metadata = yaml.load(fs.readFileSync("action.yml", "utf8"));
  const description = metadata.inputs.action.description;

  for (const action of Object.values(ActionType)) {
    assert.equal(description.includes(action), true, `${action} is missing`);
  }
});

test("action metadata targets the committed Node 24 bundle", () => {
  const metadata = yaml.load(fs.readFileSync("action.yml", "utf8"));

  assert.equal(metadata.runs.using, "node24");
  assert.equal(metadata.runs.main, "dist/index.js");
  assert.equal(fs.existsSync(metadata.runs.main), true);
});

test("package and lockfile versions match", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));

  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
});
