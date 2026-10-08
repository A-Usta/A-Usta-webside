import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../config/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const ADMIN_ROLES = new Set(["admin"]);
const PROVIDER_TYPES = new Set(["mechanic", "shop", "tow", "cargo", "partner"]);
const LISTING_STATUSES = new Set(["draft", "published", "paused", "sold", "rented", "archived"]);
const RENTAL_INSPECTION_TYPES = new Set(["pickup", "return"]);
const RENTAL_SIGNER_ROLES = new Set(["owner", "renter", "staff"]);
const REVIEW_CONTEXTS = new Set(["service", "rental"]);

function userId(request: FastifyRequest): string {
  return (request as AuthenticatedRequest).user.id;
}

async function profileRole(id: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  return data?.role ?? null;
}

async function isAdminUser(request: FastifyRequest): Promise<boolean> {
  const role = await profileRole(userId(request));
  return Boolean(role && ADMIN_ROLES.has(role));
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!(await isAdminUser(request))) {
    await reply.code(403).send({ error: "Forbidden", message: "Admin role required" });
    return false;
  }
  return true;
}

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

function bad(reply: FastifyReply, message: string) {
  return reply.code(400).send({ error: "Bad Request", message });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ error: "Not Found", message });
}

function conflict(reply: FastifyReply, message: string) {
  return reply.code(409).send({ error: "Conflict", message });
}

function serverError(reply: FastifyReply, message: string) {
  return reply.code(500).send({ error: "Internal Server Error", message });
}

function finiteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function backendV1Routes(app: FastifyInstance) {
  /* ==========================================================
   * PROVIDERS / AVAILABILITY / LOCATION
   * ========================================================== */
  app.get("/v1/providers", { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as Record<string, unknown>;
    const type = stringOrNull(q.type);
    const region = stringOrNull(q.region);
    const district = stringOrNull(q.district);

    let query = supabase.from("provider_profiles").select("*").order("updated_at", { ascending: false });
    if (type && PROVIDER_TYPES.has(type)) query = query.eq("provider_type", type);
    if (region) query = query.eq("region", region);
    if (district) query = query.eq("district", district);

    const { data, error } = await query;
    if (error) return serverError(reply, "Providers could not be loaded");
    return reply.send({ providers: data ?? [] });
  });

  app.put("/v1/providers/me", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const providerType = stringOrNull(body.provider_type);

    if (!providerType || !PROVIDER_TYPES.has(providerType)) {
      return bad(reply, "provider_type must be mechanic, shop, tow, cargo, or partner");
    }

    const payload = {
      provider_id: id,
      provider_type: providerType,
      display_name: stringOrNull(body.display_name),
      bio: stringOrNull(body.bio),
      phone: stringOrNull(body.phone),
      region: stringOrNull(body.region),
      district: stringOrNull(body.district),
      is_online: body.is_online === true,
      is_available: body.is_available === true,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    };

    const { data, error } = await supabase.from("provider_profiles").upsert(payload).select("*").single();
    if (error) return serverError(reply, "Provider profile could not be saved");
    await audit(id, "provider_profile_upsert", "provider_profile", id);
    return reply.send({ provider: data });
  });

  app.put("/v1/providers/me/location", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const latitude = finiteNumber(body.latitude);
    const longitude = finiteNumber(body.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return bad(reply, "Valid latitude and longitude are required");
    }
    const { data, error } = await supabase.from("provider_locations").upsert({
      provider_id: id,
      latitude,
      longitude,
      accuracy_m: finiteNumber(body.accuracy_m),
    }).select("*").single();
    if (error) return serverError(reply, "Provider location could not be saved");
    return reply.send({ location: data });
  });

  app.put("/v1/providers/me/services", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const services = Array.isArray(body.services) ? body.services : [];
    if (!services.length) return bad(reply, "services must be a non-empty array");

    await supabase.from("provider_services").delete().eq("provider_id", id);
    const rows = services.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        provider_id: id,
        service_category: stringOrNull(item.service_category),
        service_mode: stringOrNull(item.service_mode),
        is_active: item.is_active !== false,
        metadata: typeof item.metadata === "object" && item.metadata ? item.metadata : {},
      };
    });
    if (rows.some((r) => !r.service_category)) return bad(reply, "Each provider service needs service_category");

    const { data, error } = await supabase.from("provider_services").insert(rows).select("*");
    if (error) return serverError(reply, "Provider services could not be saved");
    return reply.send({ services: data ?? [] });
  });

  app.put("/v1/providers/me/availability", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const slots = Array.isArray(body.slots) ? body.slots : [];
    if (!slots.length) return bad(reply, "slots must be a non-empty array");

    await supabase.from("provider_availability").delete().eq("provider_id", id);
    const rows = slots.map((raw) => {
      const item = raw as Record<string, unknown>;
      const weekday = finiteNumber(item.weekday);
      return {
        provider_id: id,
        weekday,
        start_time: stringOrNull(item.start_time),
        end_time: stringOrNull(item.end_time),
        is_closed: item.is_closed === true,
      };
    });
    if (rows.some((r) => r.weekday === null || (r.weekday as number) < 0 || (r.weekday as number) > 6)) return bad(reply, "weekday must be 0..6");

    const { data, error } = await supabase.from("provider_availability").insert(rows).select("*");
    if (error) return serverError(reply, "Provider availability could not be saved");
    return reply.send({ availability: data ?? [] });
  });

  app.get("/v1/providers/nearby", { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as Record<string, unknown>;
    const latitude = finiteNumber(q.latitude);
    const longitude = finiteNumber(q.longitude);
    const radiusKm = finiteNumber(q.radius_km) ?? 25;
    const providerType = stringOrNull(q.type);
    if (latitude === null || longitude === null) return bad(reply, "latitude and longitude are required");

    const { data, error } = await supabase.rpc("austa_find_nearby_providers", {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: radiusKm,
      p_provider_type: providerType,
    });
    if (error) return serverError(reply, "Nearby providers could not be loaded");
    return reply.send({ providers: data ?? [] });
  });

  /* ==========================================================
   * VEHICLES / VIN / SERVICE HISTORY
   * ========================================================== */
  app.get("/v1/vehicles", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { data, error } = await supabase.from("vehicles").select("*").eq("owner_id", id).order("created_at", { ascending: false });
    if (error) return serverError(reply, "Vehicles could not be loaded");
    return reply.send({ vehicles: data ?? [] });
  });

  app.post("/v1/vehicles", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const { data, error } = await supabase.from("vehicles").insert({
      owner_id: id,
      vin: stringOrNull(body.vin),
      plate_number: stringOrNull(body.plate_number),
      make: stringOrNull(body.make),
      model: stringOrNull(body.model),
      year: finiteNumber(body.year),
      color: stringOrNull(body.color),
      mileage: finiteNumber(body.mileage),
      fuel_type: stringOrNull(body.fuel_type),
      transmission: stringOrNull(body.transmission),
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return conflict(reply, error.code === "23505" ? "VIN already exists" : "Vehicle could not be created");
    await audit(id, "vehicle_create", "vehicle", data.id);
    return reply.code(201).send({ vehicle: data });
  });

  app.get("/v1/vehicles/:vehicleId/history", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { vehicleId } = request.params as { vehicleId?: string };
    if (!vehicleId) return bad(reply, "vehicleId is required");
    const { data: vehicle } = await supabase.from("vehicles").select("id, owner_id").eq("id", vehicleId).maybeSingle();
    if (!vehicle || vehicle.owner_id !== id) return notFound(reply, "Vehicle not found");
    const { data, error } = await supabase.from("vehicle_service_history").select("*").eq("vehicle_id", vehicleId).order("service_date", { ascending: false });
    if (error) return serverError(reply, "Vehicle service history could not be loaded");
    return reply.send({ history: data ?? [] });
  });

  app.post("/v1/vin-lookup-requests", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const vin = stringOrNull(body.vin);
    if (!vin) return bad(reply, "vin is required");
    const { data, error } = await supabase.from("vin_lookup_requests").insert({ requester_id: id, vin }).select("*").single();
    if (error) return serverError(reply, "VIN lookup request could not be created");
    await audit(id, "vin_lookup_request", "vin_lookup_request", data.id);
    return reply.code(201).send({ request: data });
  });

  /* ==========================================================
   * UNIVERSAL LISTINGS / PROMOTIONS / MARKETPLACE
   * No BEFORE/AFTER evidence here.
   * ========================================================== */
  app.get("/v1/listings", { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as Record<string, unknown>;
    const type = stringOrNull(q.type);
    const category = stringOrNull(q.category);
    const region = stringOrNull(q.region);

    let query = supabase.from("listings").select("*, listing_media(*), listing_promotions(*)").eq("status", "published").order("created_at", { ascending: false });
    if (type) query = query.eq("listing_type", type);
    if (category) query = query.eq("category", category);
    if (region) query = query.eq("region", region);
    const { data, error } = await query;
    if (error) return serverError(reply, "Listings could not be loaded");
    return reply.send({ listings: data ?? [] });
  });

  app.post("/v1/listings", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const title = stringOrNull(body.title);
    const listingType = stringOrNull(body.listing_type);
    if (!title || !listingType) return bad(reply, "title and listing_type are required");

    const status = stringOrNull(body.status) ?? "draft";
    if (!LISTING_STATUSES.has(status)) return bad(reply, "Invalid listing status");

    const { data, error } = await supabase.from("listings").insert({
      owner_id: id,
      listing_type: listingType,
      category: stringOrNull(body.category),
      title,
      description: stringOrNull(body.description),
      status,
      price: finiteNumber(body.price),
      currency: stringOrNull(body.currency) ?? "AZN",
      region: stringOrNull(body.region),
      district: stringOrNull(body.district),
      latitude: finiteNumber(body.latitude),
      longitude: finiteNumber(body.longitude),
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
      published_at: status === "published" ? new Date().toISOString() : null,
    }).select("*").single();
    if (error) return serverError(reply, "Listing could not be created");
    await audit(id, "listing_create", "listing", data.id, { listing_type: listingType });
    return reply.code(201).send({ listing: data });
  });

  app.patch("/v1/listings/:listingId", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { listingId } = request.params as { listingId?: string };
    if (!listingId) return bad(reply, "listingId is required");
    const body = (request.body ?? {}) as Record<string, unknown>;
    const { data: current } = await supabase.from("listings").select("owner_id").eq("id", listingId).maybeSingle();
    if (!current || current.owner_id !== id) return notFound(reply, "Listing not found");

    const patch: Record<string, unknown> = {};
    for (const key of ["title", "description", "listing_type", "category", "status", "currency", "region", "district"]) {
      if (key in body) patch[key] = body[key];
    }
    for (const key of ["price", "latitude", "longitude"]) {
      if (key in body) patch[key] = finiteNumber(body[key]);
    }
    if ("metadata" in body) patch.metadata = typeof body.metadata === "object" && body.metadata ? body.metadata : {};
    if (patch.status === "published") patch.published_at = new Date().toISOString();

    const { data, error } = await supabase.from("listings").update(patch).eq("id", listingId).eq("owner_id", id).select("*").single();
    if (error) return serverError(reply, "Listing could not be updated");
    await audit(id, "listing_update", "listing", listingId);
    return reply.send({ listing: data });
  });

  app.post("/v1/listings/:listingId/promotions", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { listingId } = request.params as { listingId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!listingId) return bad(reply, "listingId is required");
    const { data: listing } = await supabase.from("listings").select("owner_id").eq("id", listingId).maybeSingle();
    if (!listing || listing.owner_id !== id) return notFound(reply, "Listing not found");

    const type = stringOrNull(body.promotion_type);
    const startedAt = stringOrNull(body.started_at) ?? new Date().toISOString();
    const expiresAt = stringOrNull(body.expires_at);
    if (!type || !expiresAt) return bad(reply, "promotion_type and expires_at are required");

    const { data, error } = await supabase.from("listing_promotions").insert({
      listing_id: listingId,
      promotion_type: type,
      started_at: startedAt,
      expires_at: expiresAt,
      price: finiteNumber(body.price),
      status: "active",
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Listing promotion could not be created");
    await audit(id, "listing_promotion_create", "listing_promotion", data.id, { promotion_type: type });
    return reply.code(201).send({ promotion: data });
  });

  app.post("/v1/marketplace/orders", { preHandler: requireAuth }, async (request, reply) => {
    const buyerId = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const listingId = stringOrNull(body.listing_id);
    if (!listingId) return bad(reply, "listing_id is required");
    const { data: listing } = await supabase.from("listings").select("id, owner_id, price, status").eq("id", listingId).maybeSingle();
    if (!listing || listing.status !== "published") return notFound(reply, "Published listing not found");
    if (listing.owner_id === buyerId) return conflict(reply, "Owner cannot create a buyer order for own listing");

    const { data, error } = await supabase.from("marketplace_orders").insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.owner_id,
      order_type: stringOrNull(body.order_type) ?? "contact",
      status: "pending",
      amount: finiteNumber(body.amount) ?? listing.price,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Marketplace order could not be created");
    await audit(buyerId, "marketplace_order_create", "marketplace_order", data.id);
    return reply.code(201).send({ order: data });
  });

  /* ==========================================================
   * SHOPS / PARTS
   * ========================================================== */
  app.post("/v1/shops", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = stringOrNull(body.name);
    if (!name) return bad(reply, "name is required");
    const { data, error } = await supabase.from("shops").insert({
      owner_id: id,
      name,
      description: stringOrNull(body.description),
      phone: stringOrNull(body.phone),
      region: stringOrNull(body.region),
      district: stringOrNull(body.district),
      address: stringOrNull(body.address),
      latitude: finiteNumber(body.latitude),
      longitude: finiteNumber(body.longitude),
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Shop could not be created");
    await audit(id, "shop_create", "shop", data.id);
    return reply.code(201).send({ shop: data });
  });

  app.post("/v1/shops/:shopId/products", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { shopId } = request.params as { shopId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!shopId) return bad(reply, "shopId is required");
    const { data: shop } = await supabase.from("shops").select("owner_id").eq("id", shopId).maybeSingle();
    if (!shop || shop.owner_id !== id) return notFound(reply, "Shop not found");
    const name = stringOrNull(body.name);
    if (!name) return bad(reply, "name is required");
    const { data, error } = await supabase.from("shop_products").insert({
      shop_id: shopId,
      listing_id: stringOrNull(body.listing_id),
      sku: stringOrNull(body.sku),
      name,
      description: stringOrNull(body.description),
      brand: stringOrNull(body.brand),
      part_number: stringOrNull(body.part_number),
      condition: stringOrNull(body.condition),
      price: finiteNumber(body.price),
      currency: stringOrNull(body.currency) ?? "AZN",
      status: stringOrNull(body.status) ?? "active",
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Shop product could not be created");
    await supabase.from("shop_inventory").insert({ product_id: data.id, quantity: Math.max(0, finiteNumber(body.quantity) ?? 0) });
    await audit(id, "shop_product_create", "shop_product", data.id);
    return reply.code(201).send({ product: data });
  });

  /* ==========================================================
   * RENTAL: booking + PICKUP/RETURN evidence + two-sided proof
   * ========================================================== */
  app.post("/v1/rentals/bookings", { preHandler: requireAuth }, async (request, reply) => {
    const renterId = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const listingId = stringOrNull(body.listing_id);
    const startAt = stringOrNull(body.start_at);
    const endAt = stringOrNull(body.end_at);
    if (!listingId || !startAt || !endAt) return bad(reply, "listing_id, start_at and end_at are required");

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return bad(reply, "Invalid rental period");

    const { data: listing } = await supabase.from("rental_listings").select("listing_id, vehicle_id, daily_rate, deposit").eq("listing_id", listingId).maybeSingle();
    if (!listing) return notFound(reply, "Rental listing not found");
    const { data: baseListing } = await supabase.from("listings").select("owner_id, status").eq("id", listingId).maybeSingle();
    if (!baseListing || baseListing.status !== "published") return conflict(reply, "Rental listing is not available");
    if (baseListing.owner_id === renterId) return conflict(reply, "Owner cannot rent own vehicle");

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const extras = Array.isArray(body.extras) ? body.extras : [];
    const extrasAmount = finiteNumber(body.extras_amount) ?? 0;
    const total = listing.daily_rate * days + extrasAmount;

    const { data, error } = await supabase.from("rental_bookings").insert({
      listing_id: listingId,
      vehicle_id: listing.vehicle_id,
      owner_id: baseListing.owner_id,
      renter_id: renterId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      daily_rate: listing.daily_rate,
      days,
      extras,
      extras_amount: extrasAmount,
      deposit: listing.deposit,
      total_amount: total,
      status: "pending",
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Rental booking could not be created");
    await audit(renterId, "rental_booking_create", "rental_booking", data.id);
    return reply.code(201).send({ booking: data });
  });

  app.patch("/v1/rentals/bookings/:bookingId/accept", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const { data: booking } = await supabase.from("rental_bookings").select("id, owner_id, status").eq("id", bookingId).maybeSingle();
    if (!booking || booking.owner_id !== id) return notFound(reply, "Rental booking not found");
    if (booking.status !== "pending") return conflict(reply, "Only pending bookings can be accepted");
    const { data, error } = await supabase.from("rental_bookings").update({ status: "confirmed" }).eq("id", bookingId).eq("status", "pending").select("*").single();
    if (error) return conflict(reply, "Rental booking could not be accepted");
    await audit(id, "rental_booking_accept", "rental_booking", bookingId);
    return reply.send({ booking: data });
  });

  app.patch("/v1/rentals/bookings/:bookingId/start", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const { data: booking } = await supabase.from("rental_bookings").select("id, owner_id, renter_id, status").eq("id", bookingId).maybeSingle();
    if (!booking || (booking.owner_id !== id && booking.renter_id !== id)) return notFound(reply, "Rental booking not found");
    if (booking.status !== "confirmed") return conflict(reply, "Only confirmed bookings can be started");
    const { data: inspection } = await supabase.from("rental_inspections").select("id").eq("booking_id", bookingId).eq("inspection_type", "pickup").limit(1);
    if (!inspection || inspection.length === 0) return conflict(reply, "Pickup inspection is required before rental start");
    const { data, error } = await supabase.from("rental_bookings").update({ status: "active" }).eq("id", bookingId).eq("status", "confirmed").select("*").single();
    if (error) return conflict(reply, "Rental booking could not be started");
    await audit(id, "rental_booking_start", "rental_booking", bookingId);
    return reply.send({ booking: data });
  });

  app.patch("/v1/rentals/bookings/:bookingId/return", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const { data: booking } = await supabase.from("rental_bookings").select("id, owner_id, renter_id, status").eq("id", bookingId).maybeSingle();
    if (!booking || (booking.owner_id !== id && booking.renter_id !== id)) return notFound(reply, "Rental booking not found");
    if (booking.status !== "active") return conflict(reply, "Only active bookings can be returned");
    const { data: inspectionRows } = await supabase.from("rental_inspections").select("id").eq("booking_id", bookingId).eq("inspection_type", "return").limit(1);
    if (!inspectionRows || inspectionRows.length === 0) return conflict(reply, "Return inspection is required before return");
    const { data, error } = await supabase.from("rental_bookings").update({ status: "returned" }).eq("id", bookingId).eq("status", "active").select("*").single();
    if (error) return conflict(reply, "Rental booking could not be marked returned");
    await audit(id, "rental_booking_return", "rental_booking", bookingId);
    return reply.send({ booking: data });
  });

  app.patch("/v1/rentals/bookings/:bookingId/complete", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const { data: booking } = await supabase.from("rental_bookings").select("id, owner_id, status").eq("id", bookingId).maybeSingle();
    if (!booking || booking.owner_id !== id) return notFound(reply, "Rental booking not found");
    if (booking.status !== "returned") return conflict(reply, "Only returned bookings can be completed");
    const { data, error } = await supabase.from("rental_bookings").update({ status: "completed" }).eq("id", bookingId).eq("status", "returned").select("*").single();
    if (error) return conflict(reply, "Rental booking could not be completed");
    await audit(id, "rental_booking_complete", "rental_booking", bookingId);
    return reply.send({ booking: data });
  });

  app.get("/v1/rentals/bookings/:bookingId", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    if (!bookingId) return bad(reply, "bookingId is required");
    const { data, error } = await supabase.from("rental_bookings").select("*, rental_inspections(*, rental_evidence(*), rental_signoffs(*)), rental_damage_reports(*), disputes(*)").eq("id", bookingId).maybeSingle();
    if (error) return serverError(reply, "Rental booking could not be loaded");
    if (!data || (data.owner_id !== id && data.renter_id !== id)) return notFound(reply, "Rental booking not found");
    return reply.send({ booking: data });
  });

  app.post("/v1/rentals/bookings/:bookingId/inspections", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const inspectionType = stringOrNull(body.inspection_type);
    const performerRole = stringOrNull(body.performed_by_role);
    if (!bookingId || !inspectionType || !RENTAL_INSPECTION_TYPES.has(inspectionType)) return bad(reply, "inspection_type must be pickup or return");
    if (!performerRole || !RENTAL_SIGNER_ROLES.has(performerRole)) return bad(reply, "Invalid performed_by_role");

    const { data: booking } = await supabase.from("rental_bookings").select("owner_id, renter_id").eq("id", bookingId).maybeSingle();
    if (!booking || (booking.owner_id !== id && booking.renter_id !== id)) return notFound(reply, "Rental booking not found");

    const evidence = Array.isArray(body.evidence) ? body.evidence : [];
    for (const item of evidence) {
      if (!item || typeof item !== "object") return bad(reply, "Invalid inspection evidence");
      const record = item as Record<string, unknown>;
      if (record.bucket !== "rental-evidence" || typeof record.path !== "string") return bad(reply, "Inspection evidence must use rental-evidence bucket and a valid path");
      if (!record.path.startsWith(`${id}/`) || record.path.includes("..")) return bad(reply, "Inspection evidence path must belong to the authenticated user");
    }

    const { data, error } = await supabase.from("rental_inspections").insert({
      booking_id: bookingId,
      inspection_type: inspectionType,
      performed_by: id,
      performed_by_role: performerRole,
      mileage: finiteNumber(body.mileage),
      fuel_level: stringOrNull(body.fuel_level),
      notes: stringOrNull(body.notes),
      latitude: finiteNumber(body.latitude),
      longitude: finiteNumber(body.longitude),
      captured_at: stringOrNull(body.captured_at) ?? new Date().toISOString(),
    }).select("*").single();
    if (error) return serverError(reply, "Rental inspection could not be created");

    if (evidence.length) {
      const rows = evidence.map((raw) => {
        const item = raw as Record<string, unknown>;
        return {
          inspection_id: data.id,
          uploader_id: id,
          uploader_role: performerRole,
          storage_bucket: "rental-evidence",
          storage_path: item.path as string,
          media_type: stringOrNull(item.media_type) ?? "image",
          view_label: stringOrNull(item.view_label),
          description: stringOrNull(item.description),
          captured_at: stringOrNull(item.captured_at) ?? new Date().toISOString(),
        };
      });
      const { error: evidenceError } = await supabase.from("rental_evidence").insert(rows);
      if (evidenceError) return serverError(reply, "Inspection was created but evidence could not be stored");
    }

    await audit(id, "rental_inspection_create", "rental_inspection", data.id, { inspection_type: inspectionType });
    return reply.code(201).send({ inspection: data });
  });

  app.post("/v1/rentals/inspections/:inspectionId/signoff", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { inspectionId } = request.params as { inspectionId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const signerRole = stringOrNull(body.signer_role);
    if (!inspectionId || !signerRole || !RENTAL_SIGNER_ROLES.has(signerRole)) return bad(reply, "Valid signer_role is required");

    const { data: inspection } = await supabase.from("rental_inspections").select("id, booking_id").eq("id", inspectionId).maybeSingle();
    if (!inspection) return notFound(reply, "Inspection not found");
    const { data: booking } = await supabase.from("rental_bookings").select("owner_id, renter_id").eq("id", inspection.booking_id).maybeSingle();
    if (!booking || (booking.owner_id !== id && booking.renter_id !== id)) return notFound(reply, "Rental booking not found");

    const { data, error } = await supabase.from("rental_signoffs").upsert({
      inspection_id: inspectionId,
      signer_id: id,
      signer_role: signerRole,
      accepted: body.accepted === true,
      comment: stringOrNull(body.comment),
    }, { onConflict: "inspection_id,signer_id" }).select("*").single();
    if (error) return serverError(reply, "Inspection signoff could not be saved");
    await audit(id, "rental_inspection_signoff", "rental_inspection", inspectionId, { accepted: body.accepted === true });
    return reply.send({ signoff: data });
  });

  app.post("/v1/rentals/bookings/:bookingId/damages", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { bookingId } = request.params as { bookingId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!bookingId) return bad(reply, "bookingId is required");
    const { data: booking } = await supabase.from("rental_bookings").select("owner_id, renter_id").eq("id", bookingId).maybeSingle();
    if (!booking || (booking.owner_id !== id && booking.renter_id !== id)) return notFound(reply, "Rental booking not found");
    const description = stringOrNull(body.description);
    if (!description) return bad(reply, "description is required");

    const role = stringOrNull(body.reported_by_role);
    if (!role || !RENTAL_SIGNER_ROLES.has(role)) return bad(reply, "Invalid reported_by_role");
    const { data, error } = await supabase.from("rental_damage_reports").insert({
      booking_id: bookingId,
      inspection_id: stringOrNull(body.inspection_id),
      reported_by: id,
      reported_by_role: role,
      zone: stringOrNull(body.zone),
      severity: stringOrNull(body.severity),
      description,
      evidence_ids: Array.isArray(body.evidence_ids) ? body.evidence_ids : [],
      status: "open",
    }).select("*").single();
    if (error) return serverError(reply, "Damage report could not be created");
    await audit(id, "rental_damage_create", "rental_damage_report", data.id);
    return reply.code(201).send({ damage: data });
  });

  /* ==========================================================
   * REVIEWS / DISPUTES / KYC
   * ========================================================== */
  app.post("/v1/reviews", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contextType = stringOrNull(body.context_type);
    const contextId = stringOrNull(body.context_id);
    const revieweeId = stringOrNull(body.reviewee_id);
    const rating = finiteNumber(body.rating);
    if (!contextType || !REVIEW_CONTEXTS.has(contextType) || !contextId || !revieweeId || rating === null || rating < 1 || rating > 5) return bad(reply, "Invalid review payload");
    if (revieweeId === id) return conflict(reply, "Self-review is not allowed");

    if (contextType === "service") {
      const { data: order } = await supabase.from("service_orders").select("customer_id, status").eq("id", contextId).maybeSingle();
      if (!order || order.status !== "completed" || order.customer_id !== id) return conflict(reply, "Service review is only allowed by the completed order customer");
    } else {
      const { data: booking } = await supabase.from("rental_bookings").select("owner_id, renter_id, status").eq("id", contextId).maybeSingle();
      if (!booking || !["completed", "returned"].includes(booking.status) || (booking.owner_id !== id && booking.renter_id !== id)) return conflict(reply, "Rental review is only allowed after rental completion");
    }

    const { data, error } = await supabase.from("reviews").insert({
      context_type: contextType,
      context_id: contextId,
      reviewer_id: id,
      reviewee_id: revieweeId,
      rating,
      dimensions: typeof body.dimensions === "object" && body.dimensions ? body.dimensions : {},
      comment: stringOrNull(body.comment),
    }).select("*").single();
    if (error) return conflict(reply, error.code === "23505" ? "Review already exists" : "Review could not be created");
    await audit(id, "review_create", "review", data.id, { context_type: contextType });
    return reply.code(201).send({ review: data });
  });

  app.get("/v1/reviews/:revieweeId", { preHandler: requireAuth }, async (request, reply) => {
    const { revieweeId } = request.params as { revieweeId?: string };
    if (!revieweeId) return bad(reply, "revieweeId is required");
    const { data, error } = await supabase.from("reviews").select("*").eq("reviewee_id", revieweeId).order("created_at", { ascending: false });
    if (error) return serverError(reply, "Reviews could not be loaded");
    return reply.send({ reviews: data ?? [] });
  });

  app.post("/v1/disputes", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const contextType = stringOrNull(body.context_type);
    const contextId = stringOrNull(body.context_id);
    const reason = stringOrNull(body.reason);
    if (!contextType || !contextId || !reason) return bad(reply, "context_type, context_id and reason are required");
    const { data, error } = await supabase.from("disputes").insert({
      context_type: contextType,
      context_id: contextId,
      opened_by: id,
      reason,
      description: stringOrNull(body.description),
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Dispute could not be created");
    await audit(id, "dispute_create", "dispute", data.id, { context_type: contextType });
    return reply.code(201).send({ dispute: data });
  });

  app.get("/v1/disputes/:disputeId", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { disputeId } = request.params as { disputeId?: string };
    const { data, error } = await supabase.from("disputes").select("*").eq("id", disputeId).maybeSingle();
    if (error) return serverError(reply, "Dispute could not be loaded");
    if (!data) return notFound(reply, "Dispute not found");
    if (data.opened_by !== id && !(await isAdminUser(request))) return notFound(reply, "Dispute not found");
    return reply.send({ dispute: data });
  });

  app.post("/v1/kyc", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const subjectRole = stringOrNull(body.subject_role);
    if (!subjectRole) return bad(reply, "subject_role is required");
    const { data, error } = await supabase.from("kyc_requests").insert({ subject_id: id, subject_role: subjectRole }).select("*").single();
    if (error) return serverError(reply, "KYC request could not be created");
    await audit(id, "kyc_request_create", "kyc_request", data.id);
    return reply.code(201).send({ kyc: data });
  });

  app.post("/v1/kyc/:kycId/documents", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { kycId } = request.params as { kycId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const { data: kyc } = await supabase.from("kyc_requests").select("subject_id").eq("id", kycId).maybeSingle();
    if (!kyc || kyc.subject_id !== id) return notFound(reply, "KYC request not found");
    const path = stringOrNull(body.storage_path);
    const type = stringOrNull(body.document_type);
    if (!path || !type || !path.startsWith(`${id}/`) || path.includes("..")) return bad(reply, "storage_path must belong to the authenticated user");
    const { data, error } = await supabase.from("kyc_documents").insert({
      kyc_request_id: kycId,
      storage_bucket: stringOrNull(body.storage_bucket) ?? "kyc-documents",
      storage_path: path,
      document_type: type,
    }).select("*").single();
    if (error) return serverError(reply, "KYC document could not be saved");
    await audit(id, "kyc_document_create", "kyc_document", data.id);
    return reply.code(201).send({ document: data });
  });

  /* ==========================================================
   * NOTIFICATIONS / PAYMENTS
   * ========================================================== */
  app.get("/v1/notifications", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { data, error } = await supabase.from("notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return serverError(reply, "Notifications could not be loaded");
    return reply.send({ notifications: data ?? [] });
  });

  app.patch("/v1/notifications/:notificationId/read", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const { notificationId } = request.params as { notificationId?: string };
    const { data, error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", id).select("*").single();
    if (error || !data) return notFound(reply, "Notification not found");
    return reply.send({ notification: data });
  });

  app.post("/v1/payments", { preHandler: requireAuth }, async (request, reply) => {
    const id = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const amount = finiteNumber(body.amount);
    if (amount === null || amount < 0) return bad(reply, "amount must be a non-negative number");
    const { data, error } = await supabase.from("payments").insert({
      user_id: id,
      context_type: stringOrNull(body.context_type) ?? "listing",
      context_id: stringOrNull(body.context_id),
      amount,
      currency: stringOrNull(body.currency) ?? "AZN",
      status: "pending",
      provider: stringOrNull(body.provider),
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    }).select("*").single();
    if (error) return serverError(reply, "Payment record could not be created");
    await audit(id, "payment_create", "payment", data.id);
    return reply.code(201).send({ payment: data });
  });

  /* ==========================================================
   * ADMIN
   * ========================================================== */
  app.get("/v1/admin/summary", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const [orders, listings, kyc, disputes, users] = await Promise.all([
      supabase.from("service_orders").select("id", { count: "exact", head: true }),
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("kyc_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    return reply.send({
      orders: orders.count ?? 0,
      listings: listings.count ?? 0,
      pending_kyc: kyc.count ?? 0,
      open_disputes: disputes.count ?? 0,
      users: users.count ?? 0,
    });
  });

  app.patch("/v1/admin/disputes/:disputeId", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const actor = userId(request);
    const { disputeId } = request.params as { disputeId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const status = stringOrNull(body.status);
    if (!disputeId || !status) return bad(reply, "status is required");
    const { data, error } = await supabase.from("disputes").update({
      status,
      resolution: stringOrNull(body.resolution),
      resolved_by: ["resolved", "rejected"].includes(status) ? actor : null,
      resolved_at: ["resolved", "rejected"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", disputeId).select("*").single();
    if (error) return serverError(reply, "Dispute could not be updated");
    await audit(actor, "admin_dispute_update", "dispute", disputeId, { status });
    return reply.send({ dispute: data });
  });

  app.patch("/v1/admin/kyc/:kycId", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const actor = userId(request);
    const { kycId } = request.params as { kycId?: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const status = stringOrNull(body.status);
    if (!kycId || !status) return bad(reply, "status is required");
    const { data, error } = await supabase.from("kyc_requests").update({
      status,
      reviewed_by: actor,
      reviewed_at: new Date().toISOString(),
      review_note: stringOrNull(body.review_note),
    }).eq("id", kycId).select("*").single();
    if (error) return serverError(reply, "KYC request could not be updated");
    await audit(actor, "admin_kyc_update", "kyc_request", kycId, { status });
    return reply.send({ kyc: data });
  });
}
