import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";

import { env } from "./env.js";
import { serviceOrderRoutes } from "../routes/service-orders.js";
import { authRoutes } from "../routes/auth.js";

const app = Fastify({
  logger: true,

  // Böyük və lazımsız request body-lərinin qarşısını alır.
  bodyLimit: 1_048_576,

  // Reverse proxy arxasında real client məlumatlarının düzgün işlənməsi üçün.
  trustProxy: true,
});

// ---------------------------------------------------------
// SECURITY HEADERS
// ---------------------------------------------------------

await app.register(helmet);

// ---------------------------------------------------------
// CORS
// ---------------------------------------------------------

await app.register(cors, {
  origin: true,
  credentials: true,
});

// ---------------------------------------------------------
// FASTIFY SENSIBLE
// ---------------------------------------------------------

await app.register(sensible);

// ---------------------------------------------------------
// HEALTH
// ---------------------------------------------------------

app.get("/health", async () => {
  return {
    status: "ok",
    service: "A-USTA backend",
  };
});

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

await app.register(serviceOrderRoutes);
await app.register(authRoutes);

// ---------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------

app.setErrorHandler((error, request, reply) => {
  request.log.error(
    {
      err: error,
      requestId: request.id,
    },
    "Unhandled backend error",
  );

  if (error.validation) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Request məlumatları düzgün deyil.",
      requestId: request.id,
    });
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.code(error.statusCode).send({
      error: error.name || "Request Error",
      message: error.message,
      requestId: request.id,
    });
  }

  return reply.code(500).send({
    error: "Internal Server Error",
    message: "Server tərəfində gözlənilməyən xəta baş verdi.",
    requestId: request.id,
  });
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

const start = async () => {
  try {
    await app.listen({
      port: env.port,
      host: env.host,
    });

    app.log.info(
      {
        host: env.host,
        port: env.port,
      },
      "A-USTA backend started",
    );
  } catch (error) {
    app.log.error(error, "Failed to start A-USTA backend");
    process.exit(1);
  }
};

start();
