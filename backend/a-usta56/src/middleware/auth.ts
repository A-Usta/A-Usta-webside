import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../config/supabase.js";

export type AuthenticatedRequest = FastifyRequest & {
  user: {
    id: string;
    email?: string;
  };
};

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication token is required",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication token is required",
    });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired authentication token",
    });
  }

  (request as AuthenticatedRequest).user = {
    id: data.user.id,
    email: data.user.email,
  };
}
