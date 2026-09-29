import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase.js";

export async function serviceOrderRoutes(app: FastifyInstance) {
  app.get("/service-orders", async () => {
    const { data, error } = await supabase
      .from("service_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      app.log.error(error);

      return {
        error: "Service orders could not be loaded",
      };
    }

    return {
      orders: data ?? [],
    };
  });
}
