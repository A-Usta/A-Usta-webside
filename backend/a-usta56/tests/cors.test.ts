import test from "node:test";
import assert from "node:assert/strict";
import { parseCorsOrigins } from "../src/config/cors.js";

test("CORS_ORIGINS unset preserves existing production origins", () => {
  assert.deepEqual(parseCorsOrigins(undefined), [
    "https://a-usta.github.io",
    "https://a-usta-webside.onrender.com",
  ]);
});

test("TEST CORS allowlist accepts explicit local web origins and deduplicates", () => {
  assert.deepEqual(
    parseCorsOrigins("http://localhost:8081, https://test-preview.example.org, http://localhost:8081"),
    ["http://localhost:8081", "https://test-preview.example.org"],
  );
});

for (const input of [
  "*",
  "https://example.org/",
  "https://user:password@example.org",
  "file://localhost",
  ",https://example.org",
]) {
  test(`CORS_ORIGINS rejects unsafe/non-origin value: ${input}`, () => {
    assert.throws(() => parseCorsOrigins(input), /CORS_ORIGINS/);
  });
}
