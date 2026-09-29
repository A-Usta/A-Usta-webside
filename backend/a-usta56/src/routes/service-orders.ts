import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase.js";

const allowedCategories = [
  "mechanic_service",
  "tow_service",
  "cargo_service",
] as const;

const allowedUrgencies = ["normal", "urgent"] as const;

const allowedServiceModes = ["mobile", "shop"] as const;

const allowedPriceStatuses = [
  "unknown",
  "estimated",
  "confirmed",
  "final",
] as const;

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

  app.post("/service-orders", async (request, reply) => {
    const body = request.body as {
      customer_id?: string;
      vehicle_id?: string;
      service_category?: string;
      service_description?: string;
      urgency?: string;
      service_mode?: string;
      address?: string;
      region?: string;
      district?: string;
      latitude?: number;
      longitude?: number;
      estimated_price_min?: number;
      estimated_price_max?: number;
      price_status?: string;
      customer_note?: string;
    };

    if (!body.customer_id) {
      return reply.code(400).send({
        error: "customer_id is required",
      });
    }

    if (
      !body.service_category ||
      !allowedCategories.includes(
        body.service_category as (typeof allowedCategories)[number],
      )
    ) {
      return reply.code(400).send({
        error:
          "service_category must be mechanic_service, tow_service, or cargo_service",
      });
    }

    const urgency = body.urgency ?? "normal";

    if (
      !allowedUrgencies.includes(
        urgency as (typeof allowedUrgencies)[number],
      )
    ) {
      return reply.code(400).send({
        error: "urgency must be normal or urgent",
      });
    }

    const serviceMode = body.service_mode ?? "mobile";

    if (
      !allowedServiceModes.includes(
        serviceMode as (typeof allowedServiceModes)[number],
      )
    ) {
      return reply.code(400).send({
        error: "service_mode must be mobile or shop",
      });
    }

    const priceStatus = body.price_status ?? "unknown";

    if (
      !allowedPriceStatuses.includes(
        priceStatus as (typeof allowedPriceStatuses)[number],
      )
    ) {
      return reply.code(400).send({
        error:
          "price_status must be unknown, estimated, confirmed, or final",
      });
    }

    if (
      body.estimated_price_min !== undefined &&
      body.estimated_price_max !== undefined &&
      body.estimated_price_min > body.estimated_price_max
    ) {
      return reply.code(400).send({
        error: "estimated_price_min cannot be greater than estimated_price_max",
      });
    }

    const { data, error } = await supabase
      .from("service_orders")
      .insert({
        customer_id: body.customer_id,
        vehicle_id: body.vehicle_id ?? null,
        service_category: body.service_category,
        service_description: body.service_description ?? null,
        urgency,
        service_mode: serviceMode,
        address: body.address ?? null,
        region: body.region ?? null,
        district: body.district ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        estimated_price_min: body.estimated_price_min ?? null,
        estimated_price_max: body.estimated_price_max ?? null,
        price_status: priceStatus,
        customer_note: body.customer_note ?? null,
      })
      .select("*")
      .single();

    if (error) {
      app.log.error(error);

      return reply.code(500).send({
        error: "Service order could not be created",
      });
    }

    return reply.code(201).send({
      message: "Service order created successfully",
      order: data,
    });
  });
}
