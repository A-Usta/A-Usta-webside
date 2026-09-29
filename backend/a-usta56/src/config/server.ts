import Fastify from "fastify";
import { env } from "./env.js";
import { serviceOrderRoutes } from "../routes/service-orders.js";
const app = Fastify({
  logger: true,
});
app.register(serviceOrderRoutes);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "A-USTA backend",
  };
});

const start = async () => {
  try {
    await app.listen({
      port: env.port,
      host: env.host,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
