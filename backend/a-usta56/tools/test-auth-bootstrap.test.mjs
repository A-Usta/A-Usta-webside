import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bootstrapTestUsers,
  TEST_PROJECT_REF,
  TEST_PROJECT_URL,
  validateTestEnvironment,
} from "./test-auth-bootstrap.mjs";

const future = Math.floor(Date.now() / 1000) + 3600;
function serviceKey(overrides = {}) {
  const claims = {
    iss: "supabase",
    ref: TEST_PROJECT_REF,
    role: "service_role",
    exp: future,
    ...overrides,
  };
  return `synthetic.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}
const safeEnv = () => ({
  AUSTA_TEST_SUPABASE_URL: TEST_PROJECT_URL,
  AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
});

test("accepts only the exact TEST URL and matching service-role key claims", () => {
  const result = validateTestEnvironment(safeEnv());
  assert.equal(result.url, TEST_PROJECT_URL);
  assert.equal(result.key, safeEnv().AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY);
});

test("rejects production URL, wrong project ref, anon role, malformed and expired keys", () => {
  assert.throws(
    () => validateTestEnvironment({ ...safeEnv(), AUSTA_TEST_SUPABASE_URL: "https://yafpnqcoyvoclmxdlxxc.supabase.co" }),
    /approved TEST project/,
  );
  assert.throws(
    () => validateTestEnvironment({ ...safeEnv(), AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY: serviceKey({ ref: "yafpnqcoyvoclmxdlxxc" }) }),
    /do not match/,
  );
  assert.throws(
    () => validateTestEnvironment({ ...safeEnv(), AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY: serviceKey({ role: "anon" }) }),
    /do not match/,
  );
  assert.throws(
    () => validateTestEnvironment({ ...safeEnv(), AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY: "not-a-jwt" }),
    /valid Supabase JWT/,
  );
  assert.throws(
    () => validateTestEnvironment({ ...safeEnv(), AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY: serviceKey({ exp: 1 }) }),
    /expired/,
  );
});

test("requires protected TEST variables before constructing a Supabase client", async () => {
  let factoryCalled = false;
  await assert.rejects(
    bootstrapTestUsers({
      env: {},
      createClientFactory: () => { factoryCalled = true; },
    }),
    /AUSTA_TEST_SUPABASE_URL/,
  );
  assert.equal(factoryCalled, false);
});

test("creates three labeled users without assigning app roles and stores credentials privately", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "austa-m76-test-"));
  const calls = [];
  const factory = (url, key, options) => {
    assert.equal(url, TEST_PROJECT_URL);
    assert.match(key, /^synthetic\./);
    assert.equal(options.auth.persistSession, false);
    return {
      auth: {
        admin: {
          async createUser(attributes) {
            calls.push(attributes);
            return { data: { user: { id: `created-${calls.length}` } }, error: null };
          },
          async deleteUser() { assert.fail("Successful bootstrap must not delete users."); },
        },
      },
    };
  };

  try {
    const result = await bootstrapTestUsers({ env: safeEnv(), createClientFactory: factory, credentialRoot: root });
    assert.deepEqual(calls.map(x => x.user_metadata.austa_m7_6_test_actor), [
      "customer_a", "customer_b", "provider_candidate",
    ]);
    for (const attributes of calls) {
      assert.equal(attributes.email_confirm, true);
      assert.match(attributes.email, /@example\.invalid$/);
      assert.equal(Object.hasOwn(attributes, "app_metadata"), false);
      assert.equal(Object.hasOwn(attributes.user_metadata, "role"), false);
      assert.equal(typeof attributes.password, "string");
      assert.ok(attributes.password.length >= 40);
    }

    const document = JSON.parse(await readFile(result.credentialsFile, "utf8"));
    assert.equal(document.project_ref, TEST_PROJECT_REF);
    assert.equal(document.users.length, 3);
    assert.ok(document.users.every(user => typeof user.password === "string"));
    assert.ok(document.users.every(user => !Object.hasOwn(user, "access_token")));
    assert.equal((await stat(path.dirname(result.credentialsFile))).mode & 0o077, 0);
    assert.equal((await stat(result.credentialsFile)).mode & 0o077, 0);
    assert.deepEqual(result.users.map(user => user.actor), [
      "customer_a", "customer_b", "provider_candidate",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("on partial failure, deletes only user IDs created by this invocation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "austa-m76-failure-"));
  let createCount = 0;
  const deleted = [];
  const factory = () => ({
    auth: {
      admin: {
        async createUser() {
          createCount++;
          if (createCount === 2) return { data: { user: null }, error: { message: "synthetic failure" } };
          return { data: { user: { id: "new-user-1" } }, error: null };
        },
        async deleteUser(id) { deleted.push(id); return { error: null }; },
      },
    },
  });

  try {
    await assert.rejects(
      bootstrapTestUsers({ env: safeEnv(), createClientFactory: factory, credentialRoot: root }),
      /newly created users were removed/,
    );
    assert.deepEqual(deleted, ["new-user-1"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
