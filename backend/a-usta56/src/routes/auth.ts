import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.get(
    "/auth/me",
    {
      preHandler: requireAuth,
    },
    async (request) => {
      return {
        authenticated: true,
        user: {
          id: request.user!.id,
          email: request.user!.email ?? null,
        },
      };
    },
  );
}
