import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";

import { serviceOrderRoutes } from "../routes/service-orders.js";
import { authRoutes } from "../routes/auth.js";
import { backendV1Routes } from "../routes/backend-v1.js";
import { ensureBackendV1Buckets } from "./backend-v1-storage.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: [
    "https://a-usta.github.io",
    "https://a-usta-webside.onrender.com",
  ],
  credentials: true,
});

await app.register(helmet);

await app.register(sensible);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "A-USTA backend",
  };
});

await app.register(serviceOrderRoutes);

await app.register(authRoutes);

await app.register(backendV1Routes);

await ensureBackendV1Buckets();

const port = Number(
  process.env.PORT || 3000,
);

await app.listen({
  port,
  host: "0.0.0.0",
});
