import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";

import { env } from "./env.js";
import { serviceOrderRoutes } from "../routes/service-orders.js";
import { authRoutes } from "../routes/auth.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(helmet);

await app.register(sensible);

await app.register(authRoutes);
await app.register(serviceOrderRoutes);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "A-USTA backend",
    version: "1.0.0",
  };
});

app.get("/ready", async () => {
  return {
    status: "ready",
    service: "A-USTA backend",
  };
});

const start = async () => {
  try {
    await app.listen({
      port: env.port,
      host: env.host,
    });

    app.log.info(
      `A-USTA backend running on ${env.host}:${env.port}`,
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
