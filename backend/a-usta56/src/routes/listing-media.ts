import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../config/supabase.js";

const BUCKET = "listing-media";
const TTL_SECONDS = 3600;

function canonicalPath(value: unknown): value is string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 1024) {
    return false;
  }
  // Query parsing decodes once. Never decode again or repair supplied paths.
  // The current uploader emits exactly owner/listing/safe-filename.
  return /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(value);
}

export async function listingMediaRoutes(app: FastifyInstance) {
  await registerListingMediaRoutes(app, supabase);
}

// Injectable boundary for focused tests; production uses the existing server client.
export async function registerListingMediaRoutes(
  app: FastifyInstance,
  client: SupabaseClient,
) {
  app.get<{ Querystring: { path?: unknown } }>(
    "/listing-media/signed-url",
    {
      // Fastify's normal request log must not record the full object path/token.
      childLoggerFactory(logger, bindings, options) {
        return logger.child(bindings, {
          ...options,
          serializers: {
            ...options.serializers,
            req: (request: { method?: string }) => ({
              method: request.method, url: "/listing-media/signed-url",
            }),
          },
        });
      },
    },
    async (request, reply) => {
      const deny = () => reply.code(404).send({ error: "Media tapılmadı." });
      const path = request.query.path;
      if (Object.keys(request.query).length !== 1 || !canonicalPath(path)) {
        return reply.code(400).send({ error: "Yanlış media path." });
      }

      try {
        const { data: relations, error: relationError } = await client
          .from("listing_media")
          .select("listing_id,owner_id,storage_path")
          .eq("storage_path", path)
          .limit(2);
        if (relationError || !Array.isArray(relations) || relations.length !== 1) {
          return deny();
        }
        const media = relations[0];
        if (!media.listing_id || media.storage_path !== path) return deny();

        const { data: parent, error: parentError } = await client
          .from("vehicle_listings")
          .select("id,owner_id,status")
          .eq("id", media.listing_id)
          .maybeSingle();
        if (parentError || !parent || !parent.id || !parent.owner_id) return deny();

        const [pathOwner, pathListing] = path.split("/");
        if (
          parent.id !== media.listing_id ||
          pathOwner !== parent.owner_id ||
          pathListing !== parent.id ||
          media.owner_id !== parent.owner_id
        ) return deny();

        if (parent.status !== "active") {
          const authorization = request.headers.authorization;
          const bearer = typeof authorization === "string"
            ? /^Bearer ([^\s]+)$/i.exec(authorization)
            : null;
          if (!bearer) return deny();
          // Explicit-token verification does not setSession or mutate this client.
          const { data, error } = await client.auth.getUser(bearer[1]);
          if (error || !data.user || data.user.id !== parent.owner_id) return deny();
        }

        const { data, error } = await client.storage
          .from(BUCKET)
          .createSignedUrl(path, TTL_SECONDS);
        if (error || !data?.signedUrl) return deny();
        reply.header("Cache-Control", "private, no-store");
        return reply.send({ url: data.signedUrl, expiresIn: TTL_SECONDS });
      } catch {
        // Do not serialize SDK errors, bearer tokens, or object paths.
        return deny();
      }
    },
  );
}
