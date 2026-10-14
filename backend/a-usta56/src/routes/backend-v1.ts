import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { supabase } from "../config/supabase.js";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

/*
 * ============================================================
 * A-USTA BACKEND V1
 * ============================================================
 *
 * Universal platform backend:
 *
 * Providers
 * GPS / Nearby
 * Vehicles
 * VIN
 * Universal Listings
 * Marketplace
 * Shops / Parts
 * Rental
 * Rental Evidence
 * Rental Inspection
 * Rental Signoff
 * Rental Damage
 * Reviews
 * Disputes
 * KYC
 * Notifications
 * Payments
 * Admin
 * Audit
 *
 * BEFORE / AFTER evidence:
 *
 * Service Orders -> existing service-evidence flow
 * Rental         -> rental-evidence flow
 *
 * Normal listings DO NOT use rental/service evidence.
 *
 * ============================================================
 */

const ADMIN_ROLES = new Set([
  "admin",
]);

const PROVIDER_TYPES = new Set([
  "mechanic",
  "shop",
  "tow",
  "cargo",
  "partner",
]);

const LISTING_STATUSES = new Set([
  "draft",
  "published",
  "paused",
  "sold",
  "rented",
  "archived",
]);

const PROMOTION_TYPES = new Set([
  "boost",
  "vip",
  "premium",
]);

const RENTAL_INSPECTION_TYPES = new Set([
  "pickup",
  "return",
]);

const RENTAL_SIGNER_ROLES = new Set([
  "owner",
  "renter",
  "staff",
]);

const REVIEW_CONTEXTS = new Set([
  "service",
  "rental",
]);

const DISPUTE_CONTEXTS = new Set([
  "service",
  "rental",
  "listing",
  "marketplace",
]);

const KYC_SUBJECT_ROLES = new Set([
  "customer",
  "mechanic",
  "shop",
  "tow",
  "cargo",
  "partner",
]);

const DISPUTE_STATUSES = new Set([
  "open",
  "under_review",
  "resolved",
  "rejected",
  "escalated",
]);

const KYC_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
]);

function userId(
  request: FastifyRequest,
): string {
  return (
    request as AuthenticatedRequest
  ).user.id;
}

async function profileRole(
  id: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  return data?.role ?? null;
}

async function isAdminUser(
  request: FastifyRequest,
): Promise<boolean> {
  const role = await profileRole(
    userId(request),
  );

  return Boolean(
    role &&
      ADMIN_ROLES.has(role),
  );
}

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (
    !(await isAdminUser(request))
  ) {
    await reply.code(403).send({
      error: "Forbidden",
      message:
        "Admin role required",
    });

    return false;
  }

  return true;
}

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<
    string,
    unknown
  > = {},
): Promise<void> {
  await supabase
    .from("audit_logs")
    .insert({
      actor_id: actorId,
      action,
      entity_type:
        entityType,
      entity_id:
        entityId,
      metadata,
    });
}

function bad(
  reply: FastifyReply,
  message: string,
) {
  return reply
    .code(400)
    .send({
      error: "Bad Request",
      message,
    });
}

function forbidden(
  reply: FastifyReply,
  message: string,
) {
  return reply
    .code(403)
    .send({
      error: "Forbidden",
      message,
    });
}

function notFound(
  reply: FastifyReply,
  message: string,
) {
  return reply
    .code(404)
    .send({
      error: "Not Found",
      message,
    });
}

function conflict(
  reply: FastifyReply,
  message: string,
) {
  return reply
    .code(409)
    .send({
      error: "Conflict",
      message,
    });
}

function serverError(
  reply: FastifyReply,
  message: string,
) {
  return reply
    .code(500)
    .send({
      error:
        "Internal Server Error",
      message,
    });
}

function finiteNumber(
  value: unknown,
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : null;
}

function stringOrNull(
  value: unknown,
): string | null {
  return typeof value ===
    "string" &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

function objectOrEmpty(
  value: unknown,
): Record<
  string,
  unknown
> {
  if (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function arrayOrEmpty(
  value: unknown,
): unknown[] {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}

/* ============================================================
 * ROLE / PROVIDER HELPERS
 * ============================================================ */

async function validateProviderRole(
  providerId: string,
  providerType: string,
): Promise<boolean> {
  const role =
    await profileRole(
      providerId,
    );

  if (!role) {
    return false;
  }

  /*
   * Existing A-USTA deployments may use either:
   *
   * mechanic / shop / tow / cargo / partner
   *
   * or generic:
   *
   * provider
   */
  return (
    role === providerType ||
    role === "provider"
  );
}

async function rentalParticipantRole(
  request: FastifyRequest,
  bookingId: string,
): Promise<
  | "owner"
  | "renter"
  | "staff"
  | null
> {
  const id =
    userId(request);

  const {
    data: booking,
  } = await supabase
    .from("rental_bookings")
    .select(
      "owner_id, renter_id",
    )
    .eq(
      "id",
      bookingId,
    )
    .maybeSingle();

  if (!booking) {
    return null;
  }

  if (
    booking.owner_id === id
  ) {
    return "owner";
  }

  if (
    booking.renter_id === id
  ) {
    return "renter";
  }

  if (
    await isAdminUser(
      request,
    )
  ) {
    return "staff";
  }

  return null;
}

async function validateRentalEvidence(
  user: string,
  value: unknown,
): Promise<{
  valid: boolean;
  items: Record<
    string,
    unknown
  >[];
}> {
  const values =
    arrayOrEmpty(value);

  const items: Record<
    string,
    unknown
  >[] = [];

  for (const raw of values) {
    if (
      typeof raw !==
        "object" ||
      raw === null ||
      Array.isArray(raw)
    ) {
      return {
        valid: false,
        items: [],
      };
    }

    const item =
      raw as Record<
        string,
        unknown
      >;

    const bucket =
      stringOrNull(
        item.bucket,
      );

    const path =
      stringOrNull(
        item.path,
      );

    if (
      bucket !==
        "rental-evidence" ||
      !path
    ) {
      return {
        valid: false,
        items: [],
      };
    }

    if (
      !path.startsWith(
        `${user}/`,
      ) ||
      path
        .split("/")
        .includes("..")
    ) {
      return {
        valid: false,
        items: [],
      };
    }

    items.push(item);
  }

  return {
    valid: true,
    items,
  };
}

async function getRentalBooking(
  bookingId: string,
) {
  return supabase
    .from("rental_bookings")
    .select(
      "id, listing_id, vehicle_id, owner_id, renter_id, status, start_at, end_at, daily_rate, days, extras, extras_amount, deposit, total_amount",
    )
    .eq(
      "id",
      bookingId,
    )
    .maybeSingle();
}

async function bothSidesAccepted(
  inspectionId: string,
): Promise<boolean> {
  const {
    data: signoffs,
  } = await supabase
    .from("rental_signoffs")
    .select(
      "signer_role, accepted",
    )
    .eq(
      "inspection_id",
      inspectionId,
    );

  const ownerAccepted =
    (signoffs ?? []).some(
      (item) =>
        item.signer_role ===
          "owner" &&
        item.accepted === true,
    );

  const renterAccepted =
    (signoffs ?? []).some(
      (item) =>
        item.signer_role ===
          "renter" &&
        item.accepted === true,
    );

  return (
    ownerAccepted &&
    renterAccepted
  );
}

async function validateDamageEvidence(
  bookingId: string,
  evidenceIds: string[],
): Promise<boolean> {
  if (
    evidenceIds.length ===
    0
  ) {
    return false;
  }

  const uniqueIds =
    [
      ...new Set(
        evidenceIds,
      ),
    ];

  const {
    data: evidence,
  } = await supabase
    .from("rental_evidence")
    .select(
      "id, inspection_id",
    )
    .in(
      "id",
      uniqueIds,
    );

  if (
    !evidence ||
    evidence.length !==
      uniqueIds.length
  ) {
    return false;
  }

  const inspectionIds =
    evidence.map(
      (item) =>
        item.inspection_id,
    );

  const {
    data: inspections,
  } = await supabase
    .from("rental_inspections")
    .select(
      "id, booking_id",
    )
    .in(
      "id",
      inspectionIds,
    );

  if (!inspections) {
    return false;
  }

  const validInspectionIds =
    new Set(
      inspections
        .filter(
          (item) =>
            item.booking_id ===
            bookingId,
        )
        .map(
          (item) =>
            item.id,
        ),
    );

  return evidence.every(
    (item) =>
      validInspectionIds.has(
        item.inspection_id,
      ),
  );
}

async function canAccessContext(
  request: FastifyRequest,
  contextType: string,
  contextId: string,
): Promise<boolean> {
  const actor =
    userId(request);

  if (
    await isAdminUser(
      request,
    )
  ) {
    return true;
  }

  if (
    contextType ===
    "service"
  ) {
    const {
      data: order,
    } = await supabase
      .from(
        "service_orders",
      )
      .select(
        "id, customer_id",
      )
      .eq(
        "id",
        contextId,
      )
      .maybeSingle();

    if (!order) {
      return false;
    }

    if (
      order.customer_id ===
      actor
    ) {
      return true;
    }

    const {
      data: assignment,
    } = await supabase
      .from(
        "service_order_assignments",
      )
      .select(
        "provider_id, status",
      )
      .eq(
        "order_id",
        contextId,
      )
      .eq(
        "provider_id",
        actor,
      )
      .in(
        "status",
        [
          "offered",
          "accepted",
          "rejected",
          "cancelled",
          "completed",
        ],
      )
      .limit(1)
      .maybeSingle();

    return Boolean(
      assignment,
    );
  }

  if (
    contextType ===
    "rental"
  ) {
    const {
      data: booking,
    } =
      await supabase
        .from(
          "rental_bookings",
        )
        .select(
          "owner_id, renter_id",
        )
        .eq(
          "id",
          contextId,
        )
        .maybeSingle();

    return Boolean(
      booking &&
        (
          booking.owner_id ===
            actor ||
          booking.renter_id ===
            actor
        ),
    );
  }

  if (
    contextType ===
    "listing"
  ) {
    const {
      data: listing,
    } = await supabase
      .from("listings")
      .select(
        "owner_id",
      )
      .eq(
        "id",
        contextId,
      )
      .maybeSingle();

    return Boolean(
      listing &&
        listing.owner_id ===
          actor,
    );
  }

  if (
    contextType ===
    "marketplace"
  ) {
    const {
      data: order,
    } = await supabase
      .from(
        "marketplace_orders",
      )
      .select(
        "buyer_id, seller_id",
      )
      .eq(
        "id",
        contextId,
      )
      .maybeSingle();

    return Boolean(
      order &&
        (
          order.buyer_id ===
            actor ||
          order.seller_id ===
            actor
        ),
    );
  }

  return false;
}

/* ============================================================
 * ROUTES
 * ============================================================ */

export async function backendV1Routes(
  app: FastifyInstance,
) {
  /* ==========================================================
   * PROVIDERS
   * ========================================================== */

  app.get(
    "/v1/providers",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const q =
        request.query as Record<
          string,
          unknown
        >;

      const type =
        stringOrNull(
          q.type,
        );

      const region =
        stringOrNull(
          q.region,
        );

      const district =
        stringOrNull(
          q.district,
        );

      if (
        type &&
        !PROVIDER_TYPES.has(
          type,
        )
      ) {
        return bad(
          reply,
          "Invalid provider type",
        );
      }

      let query =
        supabase
          .from(
            "provider_profiles",
          )
          .select("*")
          .order(
            "updated_at",
            {
              ascending:
                false,
            },
          );

      if (type) {
        query =
          query.eq(
            "provider_type",
            type,
          );
      }

      if (region) {
        query =
          query.eq(
            "region",
            region,
          );
      }

      if (district) {
        query =
          query.eq(
            "district",
            district,
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        return serverError(
          reply,
          "Providers could not be loaded",
        );
      }

      return reply.send({
        providers:
          data ?? [],
      });
    },
  );

  app.put(
    "/v1/providers/me",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const providerType =
        stringOrNull(
          body.provider_type,
        );

      if (
        !providerType ||
        !PROVIDER_TYPES.has(
          providerType,
        )
      ) {
        return bad(
          reply,
          "provider_type must be mechanic, shop, tow, cargo, or partner",
        );
      }

      const allowed =
        await validateProviderRole(
          id,
          providerType,
        );

      if (!allowed) {
        return forbidden(
          reply,
          "Provider type does not match the authenticated profile role",
        );
      }

      const payload =
        {
          provider_id:
            id,
          provider_type:
            providerType,
          display_name:
            stringOrNull(
              body.display_name,
            ),
          bio:
            stringOrNull(
              body.bio,
            ),
          phone:
            stringOrNull(
              body.phone,
            ),
          region:
            stringOrNull(
              body.region,
            ),
          district:
            stringOrNull(
              body.district,
            ),
          is_online:
            body.is_online ===
            true,
          is_available:
            body.is_available ===
            true,
          metadata:
            objectOrEmpty(
              body.metadata,
            ),
        };

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "provider_profiles",
          )
          .upsert(
            payload,
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Provider profile could not be saved",
        );
      }

      await audit(
        id,
        "provider_profile_upsert",
        "provider_profile",
        id,
      );

      return reply.send({
        provider:
          data,
      });
    },
  );

  app.put(
    "/v1/providers/me/location",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const latitude =
        finiteNumber(
          body.latitude,
        );

      const longitude =
        finiteNumber(
          body.longitude,
        );

      const accuracy =
        finiteNumber(
          body.accuracy_m,
        );

      if (
        latitude ===
          null ||
        longitude ===
          null ||
        latitude <
          -90 ||
        latitude >
          90 ||
        longitude <
          -180 ||
        longitude >
          180
      ) {
        return bad(
          reply,
          "Valid latitude and longitude are required",
        );
      }

      if (
        accuracy !==
          null &&
        accuracy < 0
      ) {
        return bad(
          reply,
          "accuracy_m cannot be negative",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "provider_locations",
          )
          .upsert({
            provider_id:
              id,
            latitude,
            longitude,
            accuracy_m:
              accuracy,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Provider location could not be saved",
        );
      }

      return reply.send({
        location:
          data,
      });
    },
  );

  app.put(
    "/v1/providers/me/services",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const services =
        Array.isArray(
          body.services,
        )
          ? body.services
          : [];

      if (
        services.length ===
        0
      ) {
        return bad(
          reply,
          "services must be a non-empty array",
        );
      }

      const rows =
        services.map(
          (
            raw,
          ) => {
            const item =
              raw as Record<
                string,
                unknown
              >;

            return {
              provider_id:
                id,
              service_category:
                stringOrNull(
                  item.service_category,
                ),
              service_mode:
                stringOrNull(
                  item.service_mode,
                ),
              is_active:
                item.is_active !==
                false,
              metadata:
                objectOrEmpty(
                  item.metadata,
                ),
            };
          },
        );

      if (
        rows.some(
          (row) =>
            !row.service_category,
        )
      ) {
        return bad(
          reply,
          "Each provider service needs service_category",
        );
      }

      await supabase
        .from(
          "provider_services",
        )
        .delete()
        .eq(
          "provider_id",
          id,
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "provider_services",
          )
          .insert(
            rows,
          )
          .select(
            "*",
          );

      if (error) {
        return serverError(
          reply,
          "Provider services could not be saved",
        );
      }

      return reply.send({
        services:
          data ?? [],
      });
    },
  );

  app.put(
    "/v1/providers/me/availability",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const slots =
        Array.isArray(
          body.slots,
        )
          ? body.slots
          : [];

      if (
        slots.length ===
        0
      ) {
        return bad(
          reply,
          "slots must be a non-empty array",
        );
      }

      const rows =
        slots.map(
          (
            raw,
          ) => {
            const item =
              raw as Record<
                string,
                unknown
              >;

            return {
              provider_id:
                id,
              weekday:
                finiteNumber(
                  item.weekday,
                ),
              start_time:
                stringOrNull(
                  item.start_time,
                ),
              end_time:
                stringOrNull(
                  item.end_time,
                ),
              is_closed:
                item.is_closed ===
                true,
            };
          },
        );

      if (
        rows.some(
          (row) =>
            row.weekday ===
              null ||
            (row.weekday as number) <
              0 ||
            (row.weekday as number) >
              6,
        )
      ) {
        return bad(
          reply,
          "weekday must be 0..6",
        );
      }

      await supabase
        .from(
          "provider_availability",
        )
        .delete()
        .eq(
          "provider_id",
          id,
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "provider_availability",
          )
          .insert(
            rows,
          )
          .select(
            "*",
          );

      if (error) {
        return serverError(
          reply,
          "Provider availability could not be saved",
        );
      }

      return reply.send({
        availability:
          data ?? [],
      });
    },
  );

  app.get(
    "/v1/providers/nearby",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const q =
        request.query as Record<
          string,
          unknown
        >;

      const latitude =
        finiteNumber(
          q.latitude,
        );

      const longitude =
        finiteNumber(
          q.longitude,
        );

      const radiusKm =
        finiteNumber(
          q.radius_km,
        ) ?? 25;

      const providerType =
        stringOrNull(
          q.type,
        );

      if (
        latitude ===
          null ||
        longitude ===
          null
      ) {
        return bad(
          reply,
          "latitude and longitude are required",
        );
      }

      if (
        radiusKm <=
          0 ||
        radiusKm >
          100
      ) {
        return bad(
          reply,
          "radius_km must be greater than 0 and no more than 100",
        );
      }

      if (
        providerType &&
        !PROVIDER_TYPES.has(
          providerType,
        )
      ) {
        return bad(
          reply,
          "Invalid provider type",
        );
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "austa_find_nearby_providers",
          {
            p_latitude:
              latitude,
            p_longitude:
              longitude,
            p_radius_km:
              radiusKm,
            p_provider_type:
              providerType,
          },
        );

      if (error) {
        return serverError(
          reply,
          "Nearby providers could not be loaded",
        );
      }

      return reply.send({
        providers:
          data ?? [],
      });
    },
  );

  /* ==========================================================
   * VEHICLES / VIN
   * ========================================================== */

  app.get(
    "/v1/vehicles",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vehicles",
          )
          .select(
            "*",
          )
          .eq(
            "owner_id",
            id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );

      if (error) {
        return serverError(
          reply,
          "Vehicles could not be loaded",
        );
      }

      return reply.send({
        vehicles:
          data ?? [],
      });
    },
  );

  app.post(
    "/v1/vehicles",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vehicles",
          )
          .insert({
            owner_id:
              id,
            vin:
              stringOrNull(
                body.vin,
              ),
            plate_number:
              stringOrNull(
                body.plate_number,
              ),
            make:
              stringOrNull(
                body.make,
              ),
            model:
              stringOrNull(
                body.model,
              ),
            year:
              finiteNumber(
                body.year,
              ),
            color:
              stringOrNull(
                body.color,
              ),
            mileage:
              finiteNumber(
                body.mileage,
              ),
            fuel_type:
              stringOrNull(
                body.fuel_type,
              ),
            transmission:
              stringOrNull(
                body.transmission,
              ),
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          error.code ===
            "23505"
            ? "VIN already exists"
            : "Vehicle could not be created",
        );
      }

      await audit(
        id,
        "vehicle_create",
        "vehicle",
        data.id,
      );

      return reply
        .code(201)
        .send({
          vehicle:
            data,
        });
    },
  );

  app.get(
    "/v1/vehicles/:vehicleId/history",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        vehicleId,
      } =
        request.params as {
          vehicleId?: string;
        };

      if (!vehicleId) {
        return bad(
          reply,
          "vehicleId is required",
        );
      }

      const {
        data: vehicle,
      } =
        await supabase
          .from(
            "vehicles",
          )
          .select(
            "id, owner_id",
          )
          .eq(
            "id",
            vehicleId,
          )
          .maybeSingle();

      if (
        !vehicle ||
        vehicle.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Vehicle not found",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vehicle_service_history",
          )
          .select(
            "*",
          )
          .eq(
            "vehicle_id",
            vehicleId,
          )
          .order(
            "service_date",
            {
              ascending:
                false,
            },
          );

      if (error) {
        return serverError(
          reply,
          "Vehicle service history could not be loaded",
        );
      }

      return reply.send({
        history:
          data ?? [],
      });
    },
  );

  app.post(
    "/v1/vin-lookup-requests",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const vin =
        stringOrNull(
          body.vin,
        );

      if (!vin) {
        return bad(
          reply,
          "vin is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vin_lookup_requests",
          )
          .insert({
            requester_id:
              id,
            vin,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "VIN lookup request could not be created",
        );
      }

      await audit(
        id,
        "vin_lookup_request",
        "vin_lookup_request",
        data.id,
      );

      return reply
        .code(201)
        .send({
          request:
            data,
        });
    },
  );

  /* ==========================================================
   * UNIVERSAL LISTINGS
   *
   * Normal listing system only.
   *
   * No BEFORE / AFTER evidence here.
   * ========================================================== */

  app.get(
    "/v1/listings",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const q =
        request.query as Record<
          string,
          unknown
        >;

      const type =
        stringOrNull(
          q.type,
        );

      const category =
        stringOrNull(
          q.category,
        );

      const region =
        stringOrNull(
          q.region,
        );

      let query =
        supabase
          .from(
            "listings",
          )
          .select(
            "*, listing_media(*), listing_promotions(*)",
          )
          .eq(
            "status",
            "published",
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );

      if (type) {
        query =
          query.eq(
            "listing_type",
            type,
          );
      }

      if (category) {
        query =
          query.eq(
            "category",
            category,
          );
      }

      if (region) {
        query =
          query.eq(
            "region",
            region,
          );
      }

      const {
        data,
        error,
      } =
        await query;

      if (error) {
        return serverError(
          reply,
          "Listings could not be loaded",
        );
      }

      return reply.send({
        listings:
          data ?? [],
      });
    },
  );

  app.post(
    "/v1/listings",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const title =
        stringOrNull(
          body.title,
        );

      const listingType =
        stringOrNull(
          body.listing_type,
        );

      if (
        !title ||
        !listingType
      ) {
        return bad(
          reply,
          "title and listing_type are required",
        );
      }

      const status =
        stringOrNull(
          body.status,
        ) ??
        "draft";

      if (
        !LISTING_STATUSES.has(
          status,
        )
      ) {
        return bad(
          reply,
          "Invalid listing status",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "listings",
          )
          .insert({
            owner_id:
              id,
            listing_type:
              listingType,
            category:
              stringOrNull(
                body.category,
              ),
            title,
            description:
              stringOrNull(
                body.description,
              ),
            status,
            price:
              finiteNumber(
                body.price,
              ),
            currency:
              stringOrNull(
                body.currency,
              ) ??
              "AZN",
            region:
              stringOrNull(
                body.region,
              ),
            district:
              stringOrNull(
                body.district,
              ),
            latitude:
              finiteNumber(
                body.latitude,
              ),
            longitude:
              finiteNumber(
                body.longitude,
              ),
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
            published_at:
              status ===
              "published"
                ? new Date().toISOString()
                : null,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Listing could not be created",
        );
      }

      await audit(
        id,
        "listing_create",
        "listing",
        data.id,
        {
          listing_type:
            listingType,
        },
      );

      return reply
        .code(201)
        .send({
          listing:
            data,
        });
    },
  );

  app.patch(
    "/v1/listings/:listingId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        listingId,
      } =
        request.params as {
          listingId?: string;
        };

      if (!listingId) {
        return bad(
          reply,
          "listingId is required",
        );
      }

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const {
        data: current,
      } =
        await supabase
          .from(
            "listings",
          )
          .select(
            "owner_id",
          )
          .eq(
            "id",
            listingId,
          )
          .maybeSingle();

      if (
        !current ||
        current.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Listing not found",
        );
      }

      const patch: Record<
        string,
        unknown
      > = {};

      for (const key of [
        "title",
        "description",
        "listing_type",
        "category",
        "currency",
        "region",
        "district",
      ]) {
        if (
          key in body
        ) {
          patch[key] =
            body[key];
        }
      }

      if (
        "status" in body
      ) {
        const status =
          stringOrNull(
            body.status,
          );

        if (
          !status ||
          !LISTING_STATUSES.has(
            status,
          )
        ) {
          return bad(
            reply,
            "Invalid listing status",
          );
        }

        patch.status =
          status;

        if (
          status ===
          "published"
        ) {
          patch.published_at =
            new Date().toISOString();
        }
      }

      for (const key of [
        "price",
        "latitude",
        "longitude",
      ]) {
        if (
          key in body
        ) {
          const value =
            finiteNumber(
              body[key],
            );

          if (
            body[key] !==
              null &&
            body[key] !==
              "" &&
            value === null
          ) {
            return bad(
              reply,
              `${key} must be a valid number`,
            );
          }

          patch[key] =
            value;
        }
      }

      if (
        "metadata" in body
      ) {
        patch.metadata =
          objectOrEmpty(
            body.metadata,
          );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "listings",
          )
          .update(
            patch,
          )
          .eq(
            "id",
            listingId,
          )
          .eq(
            "owner_id",
            id,
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Listing could not be updated",
        );
      }

      await audit(
        id,
        "listing_update",
        "listing",
        listingId,
      );

      return reply.send({
        listing:
          data,
      });
    },
  );

  app.post(
    "/v1/listings/:listingId/promotions",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        listingId,
      } =
        request.params as {
          listingId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      if (!listingId) {
        return bad(
          reply,
          "listingId is required",
        );
      }

      const {
        data: listing,
      } =
        await supabase
          .from(
            "listings",
          )
          .select(
            "owner_id, status",
          )
          .eq(
            "id",
            listingId,
          )
          .maybeSingle();

      if (
        !listing ||
        listing.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Listing not found",
        );
      }

      if (
        listing.status !==
        "published"
      ) {
        return conflict(
          reply,
          "Only published listings can be promoted",
        );
      }

      const type =
        stringOrNull(
          body.promotion_type,
        );

      const startedAt =
        stringOrNull(
          body.started_at,
        ) ??
        new Date().toISOString();

      const expiresAt =
        stringOrNull(
          body.expires_at,
        );

      if (
        !type ||
        !expiresAt
      ) {
        return bad(
          reply,
          "promotion_type and expires_at are required",
        );
      }

      if (
        !PROMOTION_TYPES.has(
          type,
        )
      ) {
        return bad(
          reply,
          "promotion_type must be boost, vip, or premium",
        );
      }

      const start =
        new Date(
          startedAt,
        );

      const end =
        new Date(
          expiresAt,
        );

      if (
        !Number.isFinite(
          start.getTime(),
        ) ||
        !Number.isFinite(
          end.getTime(),
        ) ||
        end <= start
      ) {
        return bad(
          reply,
          "Invalid promotion period",
        );
      }

      const price =
        finiteNumber(
          body.price,
        );

      if (
        price !== null &&
        price < 0
      ) {
        return bad(
          reply,
          "promotion price cannot be negative",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "listing_promotions",
          )
          .insert({
            listing_id:
              listingId,
            promotion_type:
              type,
            started_at:
              start.toISOString(),
            expires_at:
              end.toISOString(),
            price,
            status:
              "active",
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Listing promotion could not be created",
        );
      }

      await audit(
        id,
        "listing_promotion_create",
        "listing_promotion",
        data.id,
        {
          promotion_type:
            type,
        },
      );

      return reply
        .code(201)
        .send({
          promotion:
            data,
        });
    },
  );

  /* ==========================================================
   * MARKETPLACE
   * ========================================================== */

  app.post(
    "/v1/marketplace/orders",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const buyerId =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const listingId =
        stringOrNull(
          body.listing_id,
        );

      if (!listingId) {
        return bad(
          reply,
          "listing_id is required",
        );
      }

      const {
        data: listing,
      } =
        await supabase
          .from(
            "listings",
          )
          .select(
            "id, owner_id, price, status",
          )
          .eq(
            "id",
            listingId,
          )
          .maybeSingle();

      if (
        !listing ||
        listing.status !==
          "published"
      ) {
        return notFound(
          reply,
          "Published listing not found",
        );
      }

      if (
        listing.owner_id ===
        buyerId
      ) {
        return conflict(
          reply,
          "Owner cannot create a buyer order for own listing",
        );
      }

      /*
       * Amount comes from the listing.
       * Client cannot override listing price.
       */
      const amount =
        finiteNumber(
          listing.price,
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "marketplace_orders",
          )
          .insert({
            listing_id:
              listingId,
            buyer_id:
              buyerId,
            seller_id:
              listing.owner_id,
            order_type:
              stringOrNull(
                body.order_type,
              ) ??
              "contact",
            status:
              "pending",
            amount,
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Marketplace order could not be created",
        );
      }

      await audit(
        buyerId,
        "marketplace_order_create",
        "marketplace_order",
        data.id,
      );

      return reply
        .code(201)
        .send({
          order:
            data,
        });
    },
  );

  /* ==========================================================
   * SHOPS / PARTS
   * ========================================================== */

  app.post(
    "/v1/shops",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const name =
        stringOrNull(
          body.name,
        );

      if (!name) {
        return bad(
          reply,
          "name is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "shops",
          )
          .insert({
            owner_id:
              id,
            name,
            description:
              stringOrNull(
                body.description,
              ),
            phone:
              stringOrNull(
                body.phone,
              ),
            region:
              stringOrNull(
                body.region,
              ),
            district:
              stringOrNull(
                body.district,
              ),
            address:
              stringOrNull(
                body.address,
              ),
            latitude:
              finiteNumber(
                body.latitude,
              ),
            longitude:
              finiteNumber(
                body.longitude,
              ),
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Shop could not be created",
        );
      }

      await audit(
        id,
        "shop_create",
        "shop",
        data.id,
      );

      return reply
        .code(201)
        .send({
          shop:
            data,
        });
    },
  );

  app.post(
    "/v1/shops/:shopId/products",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        shopId,
      } =
        request.params as {
          shopId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      if (!shopId) {
        return bad(
          reply,
          "shopId is required",
        );
      }

      const {
        data: shop,
      } =
        await supabase
          .from(
            "shops",
          )
          .select(
            "owner_id",
          )
          .eq(
            "id",
            shopId,
          )
          .maybeSingle();

      if (
        !shop ||
        shop.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Shop not found",
        );
      }

      const name =
        stringOrNull(
          body.name,
        );

      if (!name) {
        return bad(
          reply,
          "name is required",
        );
      }

      const quantity =
        finiteNumber(
          body.quantity,
        ) ?? 0;

      if (
        quantity < 0
      ) {
        return bad(
          reply,
          "quantity cannot be negative",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "shop_products",
          )
          .insert({
            shop_id:
              shopId,
            listing_id:
              stringOrNull(
                body.listing_id,
              ),
            sku:
              stringOrNull(
                body.sku,
              ),
            name,
            description:
              stringOrNull(
                body.description,
              ),
            brand:
              stringOrNull(
                body.brand,
              ),
            part_number:
              stringOrNull(
                body.part_number,
              ),
            condition:
              stringOrNull(
                body.condition,
              ),
            price:
              finiteNumber(
                body.price,
              ),
            currency:
              stringOrNull(
                body.currency,
              ) ??
              "AZN",
            status:
              stringOrNull(
                body.status,
              ) ??
              "active",
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Shop product could not be created",
        );
      }

      const {
        error:
          inventoryError,
      } =
        await supabase
          .from(
            "shop_inventory",
          )
          .insert({
            product_id:
              data.id,
            quantity,
          });

      if (
        inventoryError
      ) {
        await supabase
          .from(
            "shop_products",
          )
          .delete()
          .eq(
            "id",
            data.id,
          );

        return serverError(
          reply,
          "Shop product could not be saved to inventory",
        );
      }

      await audit(
        id,
        "shop_product_create",
        "shop_product",
        data.id,
      );

      return reply
        .code(201)
        .send({
          product:
            data,
        });
    },
  );

  /* ==========================================================
   * RENTAL
   * ========================================================== */

  app.post(
    "/v1/rentals/bookings",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const renterId =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const listingId =
        stringOrNull(
          body.listing_id,
        );

      const startAt =
        stringOrNull(
          body.start_at,
        );

      const endAt =
        stringOrNull(
          body.end_at,
        );

      if (
        !listingId ||
        !startAt ||
        !endAt
      ) {
        return bad(
          reply,
          "listing_id, start_at and end_at are required",
        );
      }

      const start =
        new Date(
          startAt,
        );

      const end =
        new Date(
          endAt,
        );

      if (
        !Number.isFinite(
          start.getTime(),
        ) ||
        !Number.isFinite(
          end.getTime(),
        ) ||
        end <= start
      ) {
        return bad(
          reply,
          "Invalid rental period",
        );
      }

      const {
        data: rentalListing,
      } =
        await supabase
          .from(
            "rental_listings",
          )
          .select(
            "listing_id, vehicle_id, daily_rate, deposit",
          )
          .eq(
            "listing_id",
            listingId,
          )
          .maybeSingle();

      if (
        !rentalListing
      ) {
        return notFound(
          reply,
          "Rental listing not found",
        );
      }

      const {
        data: baseListing,
      } =
        await supabase
          .from(
            "listings",
          )
          .select(
            "owner_id, status",
          )
          .eq(
            "id",
            listingId,
          )
          .maybeSingle();

      if (
        !baseListing ||
        baseListing.status !==
          "published"
      ) {
        return conflict(
          reply,
          "Rental listing is not available",
        );
      }

      if (
        baseListing.owner_id ===
        renterId
      ) {
        return conflict(
          reply,
          "Owner cannot rent own vehicle",
        );
      }

      /*
       * Prevent overlapping active bookings.
       */
      const {
        data:
          overlappingBooking,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .select(
            "id",
          )
          .eq(
            "listing_id",
            listingId,
          )
          .in(
            "status",
            [
              "pending",
              "confirmed",
              "active",
            ],
          )
          .lt(
            "start_at",
            end.toISOString(),
          )
          .gt(
            "end_at",
            start.toISOString(),
          )
          .limit(
            1,
          )
          .maybeSingle();

      if (
        overlappingBooking
      ) {
        return conflict(
          reply,
          "This rental vehicle is already booked for the selected period",
        );
      }

      const days =
        Math.max(
          1,
          Math.ceil(
            (end.getTime() -
              start.getTime()) /
              86400000,
          ),
        );

      const extras =
        Array.isArray(
          body.extras,
        )
          ? body.extras
          : [];

      const extrasAmount =
        finiteNumber(
          body.extras_amount,
        ) ?? 0;

      if (
        extrasAmount <
        0
      ) {
        return bad(
          reply,
          "extras_amount cannot be negative",
        );
      }

      const dailyRate =
        finiteNumber(
          rentalListing.daily_rate,
        );

      if (
        dailyRate ===
          null ||
        dailyRate <
          0
      ) {
        return serverError(
          reply,
          "Rental listing has an invalid daily rate",
        );
      }

      const total =
        dailyRate *
          days +
        extrasAmount;

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .insert({
            listing_id:
              listingId,
            vehicle_id:
              rentalListing.vehicle_id,
            owner_id:
              baseListing.owner_id,
            renter_id:
              renterId,
            start_at:
              start.toISOString(),
            end_at:
              end.toISOString(),
            daily_rate:
              dailyRate,
            days,
            extras,
            extras_amount:
              extrasAmount,
            deposit:
              rentalListing.deposit,
            total_amount:
              total,
            status:
              "pending",
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Rental booking could not be created",
        );
      }

      await audit(
        renterId,
        "rental_booking_create",
        "rental_booking",
        data.id,
      );

      return reply
        .code(201)
        .send({
          booking:
            data,
        });
    },
  );

  app.patch(
    "/v1/rentals/bookings/:bookingId/accept",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data:
          booking,
      } =
        await getRentalBooking(
          bookingId,
        );

      if (
        !booking ||
        booking.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        booking.status !==
        "pending"
      ) {
        return conflict(
          reply,
          "Only pending bookings can be accepted",
        );
      }

      /*
       * Re-check overlap at acceptance time.
       */
      const {
        data:
          overlapping,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .select(
            "id",
          )
          .eq(
            "listing_id",
            booking.listing_id,
          )
          .in(
            "status",
            [
              "confirmed",
              "active",
            ],
          )
          .neq(
            "id",
            bookingId,
          )
          .lt(
            "start_at",
            booking.end_at,
          )
          .gt(
            "end_at",
            booking.start_at,
          )
          .limit(
            1,
          )
          .maybeSingle();

      if (
        overlapping
      ) {
        return conflict(
          reply,
          "Another rental booking already occupies this period",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .update({
            status:
              "confirmed",
          })
          .eq(
            "id",
            bookingId,
          )
          .eq(
            "status",
            "pending",
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          "Rental booking could not be accepted",
        );
      }

      await audit(
        id,
        "rental_booking_accept",
        "rental_booking",
        bookingId,
      );

      return reply.send({
        booking:
          data,
      });
    },
  );

  app.patch(
    "/v1/rentals/bookings/:bookingId/start",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data:
          booking,
      } =
        await getRentalBooking(
          bookingId,
        );

      if (
        !booking ||
        (
          booking.owner_id !==
            id &&
          booking.renter_id !==
            id
        )
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        booking.status !==
        "confirmed"
      ) {
        return conflict(
          reply,
          "Only confirmed bookings can be started",
        );
      }

      const {
        data:
          inspections,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .select(
            "id",
          )
          .eq(
            "booking_id",
            bookingId,
          )
          .eq(
            "inspection_type",
            "pickup",
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            1,
          );

      if (
        !inspections ||
        inspections.length ===
          0
      ) {
        return conflict(
          reply,
          "Pickup inspection is required before rental start",
        );
      }

      const inspectionId =
        inspections[0].id;

      if (
        !(await bothSidesAccepted(
          inspectionId,
        ))
      ) {
        return conflict(
          reply,
          "Both owner and renter must approve the pickup inspection",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .update({
            status:
              "active",
          })
          .eq(
            "id",
            bookingId,
          )
          .eq(
            "status",
            "confirmed",
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          "Rental booking could not be started",
        );
      }

      await audit(
        id,
        "rental_booking_start",
        "rental_booking",
        bookingId,
      );

      return reply.send({
        booking:
          data,
      });
    },
  );

  app.patch(
    "/v1/rentals/bookings/:bookingId/return",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data:
          booking,
      } =
        await getRentalBooking(
          bookingId,
        );

      if (
        !booking ||
        (
          booking.owner_id !==
            id &&
          booking.renter_id !==
            id
        )
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        booking.status !==
        "active"
      ) {
        return conflict(
          reply,
          "Only active bookings can be returned",
        );
      }

      const {
        data:
          inspections,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .select(
            "id",
          )
          .eq(
            "booking_id",
            bookingId,
          )
          .eq(
            "inspection_type",
            "return",
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            1,
          );

      if (
        !inspections ||
        inspections.length ===
          0
      ) {
        return conflict(
          reply,
          "Return inspection is required before return",
        );
      }

      const inspectionId =
        inspections[0].id;

      if (
        !(await bothSidesAccepted(
          inspectionId,
        ))
      ) {
        return conflict(
          reply,
          "Both owner and renter must approve the return inspection",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .update({
            status:
              "returned",
          })
          .eq(
            "id",
            bookingId,
          )
          .eq(
            "status",
            "active",
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          "Rental booking could not be marked returned",
        );
      }

      await audit(
        id,
        "rental_booking_return",
        "rental_booking",
        bookingId,
      );

      return reply.send({
        booking:
          data,
      });
    },
  );

  app.patch(
    "/v1/rentals/bookings/:bookingId/complete",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data:
          booking,
      } =
        await getRentalBooking(
          bookingId,
        );

      if (
        !booking ||
        booking.owner_id !==
          id
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        booking.status !==
        "returned"
      ) {
        return conflict(
          reply,
          "Only returned bookings can be completed",
        );
      }

      const {
        data:
          inspections,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .select(
            "id",
          )
          .eq(
            "booking_id",
            bookingId,
          )
          .eq(
            "inspection_type",
            "return",
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            1,
          );

      if (
        !inspections ||
        inspections.length ===
          0
      ) {
        return conflict(
          reply,
          "Return inspection is required before completion",
        );
      }

      if (
        !(await bothSidesAccepted(
          inspections[0].id,
        ))
      ) {
        return conflict(
          reply,
          "Both owner and renter must approve the return inspection",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .update({
            status:
              "completed",
          })
          .eq(
            "id",
            bookingId,
          )
          .eq(
            "status",
            "returned",
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          "Rental booking could not be completed",
        );
      }

      await audit(
        id,
        "rental_booking_complete",
        "rental_booking",
        bookingId,
      );

      return reply.send({
        booking:
          data,
      });
    },
  );

  app.get(
    "/v1/rentals/bookings/:bookingId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_bookings",
          )
          .select(
            "*, rental_inspections(*, rental_evidence(*), rental_signoffs(*)), rental_damage_reports(*)",
          )
          .eq(
            "id",
            bookingId,
          )
          .maybeSingle();

      if (error) {
        return serverError(
          reply,
          "Rental booking could not be loaded",
        );
      }

      if (
        !data ||
        (
          data.owner_id !==
            id &&
          data.renter_id !==
            id &&
          !(await isAdminUser(
            request,
          ))
        )
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      const {
        data:
          disputes,
        error:
          disputeError,
      } =
        await supabase
          .from(
            "disputes",
          )
          .select(
            "*",
          )
          .eq(
            "context_type",
            "rental",
          )
          .eq(
            "context_id",
            bookingId,
          );

      if (disputeError) {
        return serverError(
          reply,
          "Rental disputes could not be loaded",
        );
      }

      return reply.send({
        booking: {
          ...data,
          disputes:
            disputes ?? [],
        },
      });
    },
  );

  app.post(
    "/v1/rentals/bookings/:bookingId/inspections",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const inspectionType =
        stringOrNull(
          body.inspection_type,
        );

      const performerRole =
        stringOrNull(
          body.performed_by_role,
        );

      if (
        !bookingId ||
        !inspectionType ||
        !RENTAL_INSPECTION_TYPES.has(
          inspectionType,
        )
      ) {
        return bad(
          reply,
          "inspection_type must be pickup or return",
        );
      }

      if (
        !performerRole ||
        !RENTAL_SIGNER_ROLES.has(
          performerRole,
        )
      ) {
        return bad(
          reply,
          "Invalid performed_by_role",
        );
      }

      const actualRole =
        await rentalParticipantRole(
          request,
          bookingId,
        );

      if (
        !actualRole
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        actualRole !==
        performerRole
      ) {
        return bad(
          reply,
          "performed_by_role does not match the authenticated user",
        );
      }

      /*
       * One pickup and one return inspection
       * per booking.
       */
      const {
        data:
          existingInspection,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .select(
            "id",
          )
          .eq(
            "booking_id",
            bookingId,
          )
          .eq(
            "inspection_type",
            inspectionType,
          )
          .limit(
            1,
          )
          .maybeSingle();

      if (
        existingInspection
      ) {
        return conflict(
          reply,
          `A ${inspectionType} inspection already exists for this booking`,
        );
      }

      const evidenceResult =
        await validateRentalEvidence(
          id,
          body.evidence,
        );

      if (
        !evidenceResult.valid
      ) {
        return bad(
          reply,
          "Inspection evidence must use the rental-evidence bucket and belong to the authenticated user",
        );
      }

      const capturedAt =
        new Date().toISOString();

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .insert({
            booking_id:
              bookingId,
            inspection_type:
              inspectionType,
            performed_by:
              id,
            performed_by_role:
              performerRole,
            mileage:
              finiteNumber(
                body.mileage,
              ),
            fuel_level:
              stringOrNull(
                body.fuel_level,
              ),
            notes:
              stringOrNull(
                body.notes,
              ),
            latitude:
              finiteNumber(
                body.latitude,
              ),
            longitude:
              finiteNumber(
                body.longitude,
              ),
            captured_at:
              capturedAt,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Rental inspection could not be created",
        );
      }

      if (
        evidenceResult.items
          .length > 0
      ) {
        const rows =
          evidenceResult.items.map(
            (item) => ({
              inspection_id:
                data.id,
              uploader_id:
                id,
              uploader_role:
                performerRole,
              storage_bucket:
                "rental-evidence",
              storage_path:
                item.path as string,
              media_type:
                stringOrNull(
                  item.media_type,
                ) ??
                "image",
              view_label:
                stringOrNull(
                  item.view_label,
                ),
              description:
                stringOrNull(
                  item.description,
                ),
              captured_at:
                capturedAt,
            }),
          );

        const {
          error:
            evidenceError,
        } =
          await supabase
            .from(
              "rental_evidence",
            )
            .insert(
              rows,
            );

        if (evidenceError) {
          await supabase
            .from(
              "rental_inspections",
            )
            .delete()
            .eq(
              "id",
              data.id,
            );

          return serverError(
            reply,
            "Inspection was created but evidence could not be stored",
          );
        }
      }

      await audit(
        id,
        "rental_inspection_create",
        "rental_inspection",
        data.id,
        {
          inspection_type:
            inspectionType,
        },
      );

      return reply
        .code(201)
        .send({
          inspection:
            data,
        });
    },
  );

  app.post(
    "/v1/rentals/inspections/:inspectionId/signoff",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        inspectionId,
      } =
        request.params as {
          inspectionId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const signerRole =
        stringOrNull(
          body.signer_role,
        );

      if (
        !inspectionId ||
        !signerRole ||
        !RENTAL_SIGNER_ROLES.has(
          signerRole,
        )
      ) {
        return bad(
          reply,
          "Valid signer_role is required",
        );
      }

      const {
        data:
          inspection,
      } =
        await supabase
          .from(
            "rental_inspections",
          )
          .select(
            "id, booking_id, inspection_type",
          )
          .eq(
            "id",
            inspectionId,
          )
          .maybeSingle();

      if (!inspection) {
        return notFound(
          reply,
          "Inspection not found",
        );
      }

      const actualRole =
        await rentalParticipantRole(
          request,
          inspection.booking_id,
        );

      if (
        !actualRole
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      if (
        actualRole !==
        signerRole
      ) {
        return bad(
          reply,
          "signer_role does not match the authenticated user",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_signoffs",
          )
          .upsert(
            {
              inspection_id:
                inspectionId,
              signer_id:
                id,
              signer_role:
                signerRole,
              accepted:
                body.accepted ===
                true,
              comment:
                stringOrNull(
                  body.comment,
                ),
            },
            {
              onConflict:
                "inspection_id,signer_id",
            },
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Inspection signoff could not be saved",
        );
      }

      await audit(
        id,
        "rental_inspection_signoff",
        "rental_inspection",
        inspectionId,
        {
          accepted:
            body.accepted ===
            true,
        },
      );

      return reply.send({
        signoff:
          data,
      });
    },
  );

  app.post(
    "/v1/rentals/bookings/:bookingId/damages",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        bookingId,
      } =
        request.params as {
          bookingId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      if (!bookingId) {
        return bad(
          reply,
          "bookingId is required",
        );
      }

      const {
        data:
          booking,
      } =
        await getRentalBooking(
          bookingId,
        );

      if (
        !booking ||
        (
          booking.owner_id !==
            id &&
          booking.renter_id !==
            id
        )
      ) {
        return notFound(
          reply,
          "Rental booking not found",
        );
      }

      const description =
        stringOrNull(
          body.description,
        );

      if (!description) {
        return bad(
          reply,
          "description is required",
        );
      }

      const actualRole =
        booking.owner_id ===
        id
          ? "owner"
          : "renter";

      const role =
        stringOrNull(
          body.reported_by_role,
        );

      if (
        role !==
        actualRole
      ) {
        return bad(
          reply,
          "reported_by_role does not match the authenticated user",
        );
      }

      const evidenceIds =
        Array.isArray(
          body.evidence_ids,
        )
          ? body.evidence_ids.filter(
              (
                value,
              ): value is string =>
                typeof value ===
                "string",
            )
          : [];

      if (
        !(await validateDamageEvidence(
          bookingId,
          evidenceIds,
        ))
      ) {
        return bad(
          reply,
          "Damage evidence must contain valid rental evidence belonging to this booking",
        );
      }

      const inspectionId =
        stringOrNull(
          body.inspection_id,
        );

      if (inspectionId) {
        const {
          data:
            inspection,
        } =
          await supabase
            .from(
              "rental_inspections",
            )
            .select(
              "id, booking_id",
            )
            .eq(
              "id",
              inspectionId,
            )
            .maybeSingle();

        if (
          !inspection ||
          inspection.booking_id !==
            bookingId
        ) {
          return bad(
            reply,
            "inspection_id does not belong to this rental booking",
          );
        }
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "rental_damage_reports",
          )
          .insert({
            booking_id:
              bookingId,
            inspection_id:
              inspectionId,
            reported_by:
              id,
            reported_by_role:
              actualRole,
            zone:
              stringOrNull(
                body.zone,
              ),
            severity:
              stringOrNull(
                body.severity,
              ),
            description,
            evidence_ids:
              evidenceIds,
            status:
              "open",
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Damage report could not be created",
        );
      }

      await audit(
        id,
        "rental_damage_create",
        "rental_damage_report",
        data.id,
      );

      return reply
        .code(201)
        .send({
          damage:
            data,
        });
    },
  );

  /* ==========================================================
   * REVIEWS
   * ========================================================== */

  app.post(
    "/v1/reviews",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const contextType =
        stringOrNull(
          body.context_type,
        );

      const contextId =
        stringOrNull(
          body.context_id,
        );

      const revieweeId =
        stringOrNull(
          body.reviewee_id,
        );

      const rating =
        finiteNumber(
          body.rating,
        );

      if (
        !contextType ||
        !REVIEW_CONTEXTS.has(
          contextType,
        ) ||
        !contextId ||
        !revieweeId ||
        rating === null ||
        rating < 1 ||
        rating > 5
      ) {
        return bad(
          reply,
          "Invalid review payload",
        );
      }

      if (
        revieweeId ===
        id
      ) {
        return conflict(
          reply,
          "Self-review is not allowed",
        );
      }

      if (
        contextType ===
        "service"
      ) {
        const {
          data:
            order,
        } =
          await supabase
            .from(
              "service_orders",
            )
            .select(
              "customer_id, status",
            )
            .eq(
              "id",
              contextId,
            )
            .maybeSingle();

        if (
          !order ||
          order.status !==
            "completed"
        ) {
          return conflict(
            reply,
            "Service review is only allowed after the order is completed",
          );
        }

        const {
          data:
            assignment,
        } =
          await supabase
            .from(
              "service_order_assignments",
            )
            .select(
              "provider_id",
            )
            .eq(
              "order_id",
              contextId,
            )
            .eq(
              "status",
              "completed",
            )
            .order(
              "completed_at",
              {
                ascending:
                  false,
              },
            )
            .limit(
              1,
            )
            .maybeSingle();

        if (!assignment) {
          return conflict(
            reply,
            "Completed provider assignment not found",
          );
        }

        /*
         * Customer -> provider
         */
        if (
          order.customer_id ===
          id
        ) {
          if (
            revieweeId !==
            assignment.provider_id
          ) {
            return conflict(
              reply,
              "Service customer review must target the completed provider",
            );
          }
        }
        /*
         * Provider -> customer
         */
        else if (
          assignment.provider_id ===
          id
        ) {
          if (
            revieweeId !==
            order.customer_id
          ) {
            return conflict(
              reply,
              "Service provider review must target the customer",
            );
          }
        } else {
          return forbidden(
            reply,
            "You are not a participant in this service order",
          );
        }
      } else {
        const {
          data:
            booking,
        } =
          await supabase
            .from(
              "rental_bookings",
            )
            .select(
              "owner_id, renter_id, status",
            )
            .eq(
              "id",
              contextId,
            )
            .maybeSingle();

        if (
          !booking ||
          ![
            "returned",
            "completed",
          ].includes(
            booking.status,
          )
        ) {
          return conflict(
            reply,
            "Rental review is only allowed after the rental has been returned",
          );
        }

        if (
          booking.owner_id !==
            id &&
          booking.renter_id !==
            id
        ) {
          return forbidden(
            reply,
            "You are not a participant in this rental",
          );
        }

        const expectedReviewee =
          booking.owner_id ===
          id
            ? booking.renter_id
            : booking.owner_id;

        if (
          revieweeId !==
          expectedReviewee
        ) {
          return conflict(
            reply,
            "Rental review must target the other rental participant",
          );
        }
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "reviews",
          )
          .insert({
            context_type:
              contextType,
            context_id:
              contextId,
            reviewer_id:
              id,
            reviewee_id:
              revieweeId,
            rating,
            dimensions:
              objectOrEmpty(
                body.dimensions,
              ),
            comment:
              stringOrNull(
                body.comment,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return conflict(
          reply,
          error.code ===
            "23505"
            ? "Review already exists"
            : "Review could not be created",
        );
      }

      await audit(
        id,
        "review_create",
        "review",
        data.id,
        {
          context_type:
            contextType,
        },
      );

      return reply
        .code(201)
        .send({
          review:
            data,
        });
    },
  );

  app.get(
    "/v1/reviews/:revieweeId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const {
        revieweeId,
      } =
        request.params as {
          revieweeId?: string;
        };

      if (
        !revieweeId
      ) {
        return bad(
          reply,
          "revieweeId is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "reviews",
          )
          .select(
            "*",
          )
          .eq(
            "reviewee_id",
            revieweeId,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );

      if (error) {
        return serverError(
          reply,
          "Reviews could not be loaded",
        );
      }

      return reply.send({
        reviews:
          data ?? [],
      });
    },
  );

  /* ==========================================================
   * DISPUTES
   * ========================================================== */

  app.post(
    "/v1/disputes",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const contextType =
        stringOrNull(
          body.context_type,
        );

      const contextId =
        stringOrNull(
          body.context_id,
        );

      const reason =
        stringOrNull(
          body.reason,
        );

      if (
        !contextType ||
        !DISPUTE_CONTEXTS.has(
          contextType,
        ) ||
        !contextId ||
        !reason
      ) {
        return bad(
          reply,
          "context_type, context_id and reason are required",
        );
      }

      const allowed =
        await canAccessContext(
          request,
          contextType,
          contextId,
        );

      if (!allowed) {
        return forbidden(
          reply,
          "You are not allowed to open a dispute for this context",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "disputes",
          )
          .insert({
            context_type:
              contextType,
            context_id:
              contextId,
            opened_by:
              id,
            reason,
            description:
              stringOrNull(
                body.description,
              ),
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Dispute could not be created",
        );
      }

      await audit(
        id,
        "dispute_create",
        "dispute",
        data.id,
        {
          context_type:
            contextType,
        },
      );

      return reply
        .code(201)
        .send({
          dispute:
            data,
        });
    },
  );

  app.get(
    "/v1/disputes/:disputeId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        disputeId,
      } =
        request.params as {
          disputeId?: string;
        };

      if (!disputeId) {
        return bad(
          reply,
          "disputeId is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "disputes",
          )
          .select(
            "*",
          )
          .eq(
            "id",
            disputeId,
          )
          .maybeSingle();

      if (error) {
        return serverError(
          reply,
          "Dispute could not be loaded",
        );
      }

      if (!data) {
        return notFound(
          reply,
          "Dispute not found",
        );
      }

      const allowed =
        await canAccessContext(
          request,
          data.context_type,
          data.context_id,
        );

      if (!allowed) {
        return notFound(
          reply,
          "Dispute not found",
        );
      }

      return reply.send({
        dispute:
          data,
      });
    },
  );

  /* ==========================================================
   * KYC
   * ========================================================== */

  app.post(
    "/v1/kyc",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const subjectRole =
        stringOrNull(
          body.subject_role,
        );

      if (
        !subjectRole ||
        !KYC_SUBJECT_ROLES.has(
          subjectRole,
        )
      ) {
        return bad(
          reply,
          "Invalid subject_role",
        );
      }

      const authenticatedRole =
        await profileRole(
          id,
        );

      if (
        authenticatedRole !==
          subjectRole &&
        authenticatedRole !==
          "provider"
      ) {
        return forbidden(
          reply,
          "subject_role does not match the authenticated profile role",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "kyc_requests",
          )
          .insert({
            subject_id:
              id,
            subject_role:
              subjectRole,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "KYC request could not be created",
        );
      }

      await audit(
        id,
        "kyc_request_create",
        "kyc_request",
        data.id,
      );

      return reply
        .code(201)
        .send({
          kyc:
            data,
        });
    },
  );

  app.post(
    "/v1/kyc/:kycId/documents",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        kycId,
      } =
        request.params as {
          kycId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
            string,
            unknown
          >;

      const {
        data: kyc,
      } =
        await supabase
          .from(
            "kyc_requests",
          )
          .select(
            "subject_id",
          )
          .eq(
            "id",
            kycId,
          )
          .maybeSingle();

      if (
        !kyc ||
        kyc.subject_id !==
          id
      ) {
        return notFound(
          reply,
          "KYC request not found",
        );
      }

      const path =
        stringOrNull(
          body.storage_path,
        );

      const type =
        stringOrNull(
          body.document_type,
        );

      if (
        !path ||
        !type ||
        !path.startsWith(
          `${id}/`,
        ) ||
        path
          .split("/")
          .includes("..")
      ) {
        return bad(
          reply,
          "storage_path must belong to the authenticated user",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "kyc_documents",
          )
          .insert({
            kyc_request_id:
              kycId,
            storage_bucket:
              "kyc-documents",
            storage_path:
              path,
            document_type:
              type,
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "KYC document could not be saved",
        );
      }

      await audit(
        id,
        "kyc_document_create",
        "kyc_document",
        data.id,
      );

      return reply
        .code(201)
        .send({
          document:
            data,
        });
    },
  );

  /* ==========================================================
   * NOTIFICATIONS
   * ========================================================== */

  app.get(
    "/v1/notifications",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "notifications",
          )
          .select(
            "*",
          )
          .eq(
            "user_id",
            id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            100,
          );

      if (error) {
        return serverError(
          reply,
          "Notifications could not be loaded",
        );
      }

      return reply.send({
        notifications:
          data ?? [],
      });
    },
  );

  app.patch(
    "/v1/notifications/:notificationId/read",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const {
        notificationId,
      } =
        request.params as {
          notificationId?: string;
        };

      if (
        !notificationId
      ) {
        return bad(
          reply,
          "notificationId is required",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "notifications",
          )
          .update({
            is_read:
              true,
          })
          .eq(
            "id",
            notificationId,
          )
          .eq(
            "user_id",
            id,
          )
          .select(
            "*",
          )
          .single();

      if (
        error ||
        !data
      ) {
        return notFound(
          reply,
          "Notification not found",
        );
      }

      return reply.send({
        notification:
          data,
      });
    },
  );

  /* ==========================================================
   * PAYMENTS
   * ========================================================== */

  app.post(
    "/v1/payments",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      const id =
        userId(request);

      const body =
        (request.body ??
          {}) as Record<
          string,
          unknown
        >;

      const amount =
        finiteNumber(
          body.amount,
        );

      if (
        amount ===
          null ||
        amount < 0
      ) {
        return bad(
          reply,
          "amount must be a non-negative number",
        );
      }

      const contextType =
        stringOrNull(
          body.context_type,
        ) ??
        "listing";

      const contextId =
        stringOrNull(
          body.context_id,
        );

      if (
        contextId &&
        DISPUTE_CONTEXTS.has(
          contextType,
        )
      ) {
        const allowed =
          await canAccessContext(
            request,
            contextType,
            contextId,
          );

        if (!allowed) {
          return forbidden(
            reply,
            "You are not allowed to create a payment record for this context",
          );
        }
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "payments",
          )
          .insert({
            user_id:
              id,
            context_type:
              contextType,
            context_id:
              contextId,
            amount,
            currency:
              stringOrNull(
                body.currency,
              ) ??
              "AZN",
            status:
              "pending",
            provider:
              stringOrNull(
                body.provider,
              ),
            metadata:
              objectOrEmpty(
                body.metadata,
              ),
          })
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Payment record could not be created",
        );
      }

      await audit(
        id,
        "payment_create",
        "payment",
        data.id,
      );

      return reply
        .code(201)
        .send({
          payment:
            data,
        });
    },
  );

  /* ==========================================================
   * ADMIN
   * ========================================================== */

  app.get(
    "/v1/admin/summary",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      if (
        !(await requireAdmin(
          request,
          reply,
        ))
      ) {
        return;
      }

      const [
        orders,
        listings,
        kyc,
        disputes,
        users,
      ] =
        await Promise.all([
          supabase
            .from(
              "service_orders",
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              },
            ),

          supabase
            .from(
              "listings",
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              },
            ),

          supabase
            .from(
              "kyc_requests",
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              },
            )
            .eq(
              "status",
              "pending",
            ),

          supabase
            .from(
              "disputes",
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              },
            )
            .eq(
              "status",
              "open",
            ),

          supabase
            .from(
              "profiles",
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head: true,
              },
            ),
        ]);

      return reply.send({
        orders:
          orders.count ??
          0,

        listings:
          listings.count ??
          0,

        pending_kyc:
          kyc.count ??
          0,

        open_disputes:
          disputes.count ??
          0,

        users:
          users.count ??
          0,
      });
    },
  );

  app.patch(
    "/v1/admin/disputes/:disputeId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      if (
        !(await requireAdmin(
          request,
          reply,
        ))
      ) {
        return;
      }

      const actor =
        userId(request);

      const {
        disputeId,
      } =
        request.params as {
          disputeId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
            string,
            unknown
          >;

      const status =
        stringOrNull(
          body.status,
        );

      if (
        !disputeId ||
        !status
      ) {
        return bad(
          reply,
          "status is required",
        );
      }

      if (
        !DISPUTE_STATUSES.has(
          status,
        )
      ) {
        return bad(
          reply,
          "Invalid dispute status",
        );
      }

      const resolved =
        [
          "resolved",
          "rejected",
        ].includes(
          status,
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "disputes",
          )
          .update({
            status,
            resolution:
              stringOrNull(
                body.resolution,
              ),
            resolved_by:
              resolved
                ? actor
                : null,
            resolved_at:
              resolved
                ? new Date().toISOString()
                : null,
          })
          .eq(
            "id",
            disputeId,
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "Dispute could not be updated",
        );
      }

      await audit(
        actor,
        "admin_dispute_update",
        "dispute",
        disputeId,
        {
          status,
        },
      );

      return reply.send({
        dispute:
          data,
      });
    },
  );

  app.patch(
    "/v1/admin/kyc/:kycId",
    {
      preHandler:
        requireAuth,
    },
    async (
      request,
      reply,
    ) => {
      if (
        !(await requireAdmin(
          request,
          reply,
        ))
      ) {
        return;
      }

      const actor =
        userId(request);

      const {
        kycId,
      } =
        request.params as {
          kycId?: string;
        };

      const body =
        (request.body ??
          {}) as Record<
            string,
            unknown
          >;

      const status =
        stringOrNull(
          body.status,
        );

      if (
        !kycId ||
        !status
      ) {
        return bad(
          reply,
          "status is required",
        );
      }

      if (
        !KYC_STATUSES.has(
          status,
        )
      ) {
        return bad(
          reply,
          "Invalid KYC status",
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "kyc_requests",
          )
          .update({
            status,
            reviewed_by:
              actor,
            reviewed_at:
              new Date().toISOString(),
            review_note:
              stringOrNull(
                body.review_note,
              ),
          })
          .eq(
            "id",
            kycId,
          )
          .select(
            "*",
          )
          .single();

      if (error) {
        return serverError(
          reply,
          "KYC request could not be updated",
        );
      }

      await audit(
        actor,
        "admin_kyc_update",
        "kyc_request",
        kycId,
        {
          status,
        },
      );

      return reply.send({
        kyc:
          data,
      });
    },
  );
}
