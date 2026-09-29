import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.get(
    "/auth/me",
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const authenticatedRequest = request as AuthenticatedRequest;

      return {
        authenticated: true,
        user: authenticatedRequest.user,
      };
    },
  );
}
