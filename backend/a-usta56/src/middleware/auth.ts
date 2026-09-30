import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../config/supabase.js";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  // Authorization header yoxdursa
  if (!authorization) {
    await reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication token is required",
      requestId: request.id,
    });
    return;
  }

  // Yalnız Bearer authentication qəbul edilir
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    await reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid authentication format",
      requestId: request.id,
    });
    return;
  }

  const token = match[1].trim();

  if (!token) {
    await reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication token is required",
      requestId: request.id,
    });
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      await reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid or expired authentication token",
        requestId: request.id,
      });
      return;
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };
  } catch (error) {
    request.log.warn(
      {
        err: error,
        requestId: request.id,
      },
      "Authentication verification failed",
    );

    await reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication could not be verified",
      requestId: request.id,
    });
  }
}
