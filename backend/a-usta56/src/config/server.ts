import Fastify from "fastify";
import { env } from "./config/env";
import { supabase } from "./supabase";

const app = Fastify({
  logger: true,
});

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
