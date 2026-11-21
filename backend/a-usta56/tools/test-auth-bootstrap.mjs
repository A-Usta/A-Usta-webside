import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TEST_PROJECT_REF = "xnhxneziasqthkhhntkv";
export const TEST_PROJECT_URL = `https://${TEST_PROJECT_REF}.supabase.co`;
const TEST_EMAIL_DOMAIN = "example.invalid";
const ACTORS = ["customer_a", "customer_b", "provider_candidate"];

export function validateTestEnvironment(env) {
  const url = env.AUSTA_TEST_SUPABASE_URL;
  const key = env.AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY;

  if (url !== TEST_PROJECT_URL) {
    throw new Error("AUSTA_TEST_SUPABASE_URL must exactly match the approved TEST project.");
  }
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("AUSTA_TEST_SUPABASE_SERVICE_ROLE_KEY is required in the trusted server environment.");
  }

  const parts = key.split(".");
  let claims;
  try {
    if (parts.length !== 3) throw new Error();
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("TEST service-role key must be a valid Supabase JWT for the approved project.");
  }

  if (
    claims.iss !== "supabase" ||
    claims.ref !== TEST_PROJECT_REF ||
    claims.role !== "service_role"
  ) {
    throw new Error("TEST service-role key claims do not match the approved TEST project.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("TEST service-role key is expired.");
  }

  return { url, key };
}

async function removeCreatedUsers(admin, users) {
  let allRemoved = true;
  for (const user of [...users].reverse()) {
    try {
      const { error } = await admin.deleteUser(user.id);
      if (error) allRemoved = false;
    } catch {
      allRemoved = false;
    }
  }
  return allRemoved;
}

export async function bootstrapTestUsers({
  env = process.env,
  createClientFactory,
  credentialRoot = tmpdir(),
} = {}) {
  const { url, key } = validateTestEnvironment(env);
  if (typeof createClientFactory !== "function") {
    throw new Error("A Supabase client factory is required.");
  }

  const client = createClientFactory(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const admin = client?.auth?.admin;
  if (
    typeof admin?.createUser !== "function" ||
    typeof admin?.deleteUser !== "function"
  ) {
    throw new Error("Supabase Auth Admin API is unavailable.");
  }

  const runId = randomUUID();
  const created = [];
  let directory;

  try {
    for (const actor of ACTORS) {
      const email = `m76.${runId}.${actor}@${TEST_EMAIL_DOMAIN}`;
      const password = randomBytes(32).toString("base64url");
      const { data, error } = await admin.createUser({
        email,
        password,
        email_confirm: true,
        // User metadata is only a test label. No app_metadata or role claim is set.
        user_metadata: {
          austa_m7_6_run_id: runId,
          austa_m7_6_test_actor: actor,
        },
      });

      if (error || !data?.user?.id) {
        throw new Error("Auth Admin did not create the expected TEST user.");
      }

      created.push({ id: data.user.id, email, password, actor });
    }

    directory = await mkdtemp(path.join(credentialRoot, "austa-m76-auth-"));
    await chmod(directory, 0o700);
    const credentialsFile = path.join(directory, "users.json");
    const credentialDocument = {
      version: 1,
      project_ref: TEST_PROJECT_REF,
      run_id: runId,
      users: created,
    };

    await writeFile(credentialsFile, JSON.stringify(credentialDocument, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(credentialsFile, 0o600);

    const directoryMode = (await stat(directory)).mode;
    const fileMode = (await stat(credentialsFile)).mode;
    if ((directoryMode & 0o077) !== 0 || (fileMode & 0o077) !== 0) {
      throw new Error("Temporary credential storage permissions are too broad.");
    }

    return {
      runId,
      credentialsFile,
      users: created.map(({ id, actor }) => ({ id, actor })),
    };
  } catch {
    const allRemoved = await removeCreatedUsers(admin, created);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      allRemoved
        ? "TEST Auth bootstrap failed; newly created users were removed."
        : "TEST Auth bootstrap failed; cleanup was attempted. Inspect TEST Auth Users before retrying.",
    );
  }
}

async function main() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const result = await bootstrapTestUsers({ createClientFactory: createClient });
    console.log(
      `M7.6 created three TEST Auth accounts without assigning application roles. Credentials are in a private temporary file: ${result.credentialsFile}`,
    );
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message.startsWith("AUSTA_TEST_") ||
      error instanceof Error &&
      error.message.startsWith("TEST service-role key")
        ? error.message
        : "M7.6 TEST Auth bootstrap failed. No credentials, tokens, or keys were logged.";
    console.error(message);
    process.exitCode = 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  void main();
}
