import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase.js";

export async function listingMediaRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      path?: string;
    };
  }>("/listing-media/signed-url", async (request, reply) => {
    try {
      const path = String(request.query.path || "").trim();

      if (!path) {
        return reply.code(400).send({
          error: "Media path tələb olunur.",
        });
      }

      if (path.includes("..")) {
        return reply.code(400).send({
          error: "Yanlış media path.",
        });
      }

      const { data, error } = await supabase.storage
        .from("listing-media")
        .createSignedUrl(
          path,
          60 * 60
        );

      if (error || !data?.signedUrl) {
        request.log.error(
          {
            error,
            path,
          },
          "Listing media signed URL error"
        );

        return reply.code(404).send({
          error: "Media tapılmadı.",
        });
      }

      return reply.send({
        url: data.signedUrl,
        expiresIn: 3600,
      });
    } catch (error) {
      request.log.error(
        {
          error,
        },
        "Listing media signed URL route error"
      );

      return reply.code(500).send({
        error: "Media URL yaradılarkən xəta baş verdi.",
      });
    }
  });
}
