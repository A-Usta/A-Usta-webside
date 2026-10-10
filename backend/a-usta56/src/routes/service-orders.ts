import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

/*
 * ============================================================
 * A-USTA SERVICE ORDERS
 * ============================================================
 *
 * Customer:
 * GET /service-orders
 * POST /service-orders
 * PATCH /service-orders/:orderId/cancel
 *
 * Customer:
 * POST /service-orders/:orderId/assignments
 *
 * Provider:
 * GET /service-order-assignments
 * PATCH /service-order-assignments/:assignmentId/accept
 * PATCH /service-order-assignments/:assignmentId/reject
 * PATCH /service-order-assignments/:assignmentId/start
 * PATCH /service-order-assignments/:assignmentId/complete
 *
 * Flow:
 *
 * pending
 *    ↓
 * offered assignment
 *    ↓
 * accepted
 *    ↓
 * in_progress
 *    ↓
 * completed
 *
 * ============================================================
 */

const allowedCategories = [
  "mechanic_service",
  "tow_service",
  "cargo_service",
] as const;

const allowedUrgencies = [
  "normal",
  "urgent",
] as const;

const allowedServiceModes = [
  "mobile",
  "shop",
] as const;

const allowedPriceStatuses = [
  "unknown",
  "estimated",
  "confirmed",
  "final",
] as const;

const allowedProviderTypes = [
  "mechanic",
  "shop",
  "tow",
  "cargo",
] as const;

type ServiceCategory =
  (typeof allowedCategories)[number];

type Urgency =
  (typeof allowedUrgencies)[number];

type ServiceMode =
  (typeof allowedServiceModes)[number];

type PriceStatus =
  (typeof allowedPriceStatuses)[number];

type ProviderType =
  (typeof allowedProviderTypes)[number];

type CreateServiceOrderBody = {
  vehicle_id?: unknown;
  service_category?: unknown;
  service_description?: unknown;
  urgency?: unknown;
  service_mode?: unknown;
  address?: unknown;
  region?: unknown;
  district?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  estimated_price_min?: unknown;
  estimated_price_max?: unknown;
  price_status?: unknown;
  customer_note?: unknown;

  client_order_id?: unknown;
  form_version?: unknown;
  answers?: unknown;
  evidence_files?: unknown;
};

type AssignmentBody = {
  provider_id?: unknown;
  provider_type?: unknown;
  distance_km?: unknown;
};

type CompleteAssignmentBody = {
  final_price?: unknown;
  price_status?: unknown;
};

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function optionalString(
  value: unknown,
): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function optionalNumber(
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

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function optionalJsonArray(
  value: unknown,
): unknown[] | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value;
}

function validateEvidenceFiles(
  value: unknown,
  customerId: string,
): unknown[] | null {
  const files =
    optionalJsonArray(value);

  if (files === null) {
    return null;
  }

  const requiredPrefix =
    `${customerId}/`;

  for (const item of files) {
    if (
      typeof item !== "object" ||
      item === null
    ) {
      return null;
    }

    const record =
      item as Record<string, unknown>;

    if (
      record.bucket !==
      "service-evidence"
    ) {
      return null;
    }

    if (
      typeof record.path !==
      "string"
    ) {
      return null;
    }

    if (
      !record.path.startsWith(
        requiredPrefix,
      )
    ) {
      return null;
    }

    if (
      record.path
        .split("/")
        .includes("..")
    ) {
      return null;
    }
  }

  return files;
}

type ServiceEvidenceStage =
  | "problem"
  | "before"
  | "after";

type ServiceEvidenceRecord = {
  bucket: "service-evidence";
  path: string;
  category: ServiceEvidenceStage;
  content_type?: string;
  uploaded_at?: string;
  assignment_id?: string;
};

function getEvidenceRecords(
  value: unknown,
): ServiceEvidenceRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is ServiceEvidenceRecord => {
      if (
        typeof item !== "object" ||
        item === null
      ) {
        return false;
      }

      const record =
        item as Record<string, unknown>;

      return (
        record.bucket ===
          "service-evidence" &&
        typeof record.path ===
          "string" &&
        (
          record.category ===
            "problem" ||
          record.category ===
            "before" ||
          record.category ===
            "after"
        )
      );
    },
  );
}

function hasAssignmentEvidence(
  evidenceFiles: unknown,
  category: "before" | "after",
  assignmentId: string,
): boolean {
  return getEvidenceRecords(
    evidenceFiles,
  ).some(
    (file) =>
      file.category === category &&
      file.assignment_id ===
        assignmentId,
  );
}

function safeFileExtension(
  mimeType: string,
): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function isAllowed<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  );
}

function getAuthenticatedUserId(
  request: import("fastify").FastifyRequest,
): string {
  return (request as AuthenticatedRequest).user.id;
}

function expectedProviderType(
  category: ServiceCategory,
  serviceMode: ServiceMode,
): ProviderType {
  switch (category) {
    case "mechanic_service":
      return serviceMode === "shop"
        ? "shop"
        : "mechanic";

    case "tow_service":
      return "tow";

    case "cargo_service":
      return "cargo";
  }
}

function sendBadRequest(
  reply: import("fastify").FastifyReply,
  message: string,
) {
  return reply.code(400).send({
    error: "Bad Request",
    message,
  });
}

function sendForbidden(
  reply: import("fastify").FastifyReply,
  message: string,
) {
  return reply.code(403).send({
    error: "Forbidden",
    message,
  });
}

function sendNotFound(
  reply: import("fastify").FastifyReply,
  message: string,
) {
  return reply.code(404).send({
    error: "Not Found",
    message,
  });
}

function sendConflict(
  reply: import("fastify").FastifyReply,
  message: string,
) {
  return reply.code(409).send({
    error: "Conflict",
    message,
  });
}

function sendServerError(
  reply: import("fastify").FastifyReply,
  message: string,
) {
  return reply.code(500).send({
    error: "Internal Server Error",
    message,
  });
}

export async function serviceOrderRoutes(
  app: FastifyInstance,
) {
  /*
   * ==========================================================
   * GET /service-orders
   * Customer öz service order-lərini görür.
   * ==========================================================
   */

  app.get(
    "/service-orders",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const customerId =
        getAuthenticatedUserId(request);

      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        app.log.error(error);

        return sendServerError(
          reply,
          "Service orders could not be loaded",
        );
      }

      const orders = data ?? [];
      const orderIds = orders.map(
        (order) => order.id,
      );

      if (orderIds.length === 0) {
        return reply.send({
          orders: [],
        });
      }

      const {
        data: assignments,
        error: assignmentsError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select(
          "id, order_id, provider_id, provider_type, status, accepted_at, completed_at",
        )
        .in("order_id", orderIds)
        .in("status", [
          "accepted",
          "completed",
        ]);

      if (assignmentsError) {
        app.log.error(
          assignmentsError,
        );

        return sendServerError(
          reply,
          "Service order provider information could not be loaded",
        );
      }

      const providerIds = [
        ...new Set(
          (assignments ?? []).map(
            (assignment) =>
              assignment.provider_id,
          ),
        ),
      ];

      let providers: Array<{
        id: string;
        full_name: string | null;
        phone: string | null;
        avatar_url: string | null;
        role: string | null;
      }> = [];

      if (providerIds.length > 0) {
        const {
          data: providerRows,
          error: providersError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, phone, avatar_url, role",
          )
          .in("id", providerIds);

        if (providersError) {
          app.log.error(
            providersError,
          );

          return sendServerError(
            reply,
            "Assigned provider profiles could not be loaded",
          );
        }

        providers =
          providerRows ?? [];
      }

      const providerById =
        new Map(
          providers.map(
            (provider) => [
              provider.id,
              provider,
            ],
          ),
        );

      const assignmentByOrderId =
        new Map<
          string,
          {
            id: string;
            order_id: string;
            provider_id: string;
            provider_type: string;
            status: string;
            accepted_at: string | null;
            completed_at: string | null;
          }
        >(
          (
            (assignments ?? []) as Array<{
              id: string;
              order_id: string;
              provider_id: string;
              provider_type: string;
              status: string;
              accepted_at: string | null;
              completed_at: string | null;
            }>
          ).map(
            (assignment) => [
              assignment.order_id,
              assignment,
            ],
          ),
        );

      const enrichedOrders =
        orders.map((order) => {
          const assignment =
            assignmentByOrderId.get(
              order.id,
            );

          if (!assignment) {
            return {
              ...order,
              assignment: null,
              provider: null,
            };
          }

          return {
            ...order,
            assignment,
            provider:
              providerById.get(
                assignment.provider_id,
              ) ?? null,
          };
        });

      return reply.send({
        orders: enrichedOrders,
      });
    },
  );

  /*
   * ==========================================================
   * POST /service-orders
   * Yeni service order yaradır.
   * ==========================================================
   */

  app.post(
    "/service-orders",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const customerId =
        getAuthenticatedUserId(request);

      const body =
        (request.body ?? {}) as CreateServiceOrderBody;

      if (
        !isAllowed(
          body.service_category,
          allowedCategories,
        )
      ) {
        return sendBadRequest(
          reply,
          "service_category must be mechanic_service, tow_service, or cargo_service",
        );
      }

      const serviceCategory =
        body.service_category;

      const urgency: Urgency =
        body.urgency === undefined ||
        body.urgency === null ||
        body.urgency === ""
          ? "normal"
          : (body.urgency as Urgency);

      if (
        !isAllowed(
          urgency,
          allowedUrgencies,
        )
      ) {
        return sendBadRequest(
          reply,
          "urgency must be normal or urgent",
        );
      }

      const serviceMode: ServiceMode =
        body.service_mode === undefined ||
        body.service_mode === null ||
        body.service_mode === ""
          ? "mobile"
          : (body.service_mode as ServiceMode);

      if (
        !isAllowed(
          serviceMode,
          allowedServiceModes,
        )
      ) {
        return sendBadRequest(
          reply,
          "service_mode must be mobile or shop",
        );
      }

      const priceStatus: PriceStatus =
        body.price_status === undefined ||
        body.price_status === null ||
        body.price_status === ""
          ? "unknown"
          : (body.price_status as PriceStatus);

      if (
        !isAllowed(
          priceStatus,
          allowedPriceStatuses,
        )
      ) {
        return sendBadRequest(
          reply,
          "price_status must be unknown, estimated, confirmed, or final",
        );
      }

      const clientOrderId =
  optionalString(
    body.client_order_id,
  );

const formVersion =
  optionalString(
    body.form_version,
  );

if (
  clientOrderId !== null &&
  clientOrderId.length > 120
) {
  return sendBadRequest(
    reply,
    "client_order_id is too long",
  );
}

const answers =
  optionalJsonArray(
    body.answers,
  );

if (answers === null) {
  return sendBadRequest(
    reply,
    "answers must be an array",
  );
}

const evidenceFiles =
  validateEvidenceFiles(
    body.evidence_files,
    customerId,
  );

if (evidenceFiles === null) {
  return sendBadRequest(
    reply,
    "evidence_files contains an invalid service-evidence path",
  );
}

      const invalidInitialEvidence =
        evidenceFiles.some((item) => {
          if (
            typeof item !== "object" ||
            item === null
          ) {
            return false;
          }

          const category =
            (
              item as Record<
                string,
                unknown
              >
            ).category;

          return (
            category === "before" ||
            category === "after"
          );
        });

      if (invalidInitialEvidence) {
        return sendBadRequest(
          reply,
          "Initial service order may only contain an optional problem photo",
        );
      }

      const latitude =
        optionalNumber(body.latitude);

      const longitude =
        optionalNumber(body.longitude);

      const estimatedPriceMin =
        optionalNumber(
          body.estimated_price_min,
        );

      const estimatedPriceMax =
        optionalNumber(
          body.estimated_price_max,
        );

      const numericFields: Array<
        [string, unknown]
      > = [
        ["latitude", body.latitude],
        ["longitude", body.longitude],
        [
          "estimated_price_min",
          body.estimated_price_min,
        ],
        [
          "estimated_price_max",
          body.estimated_price_max,
        ],
      ];

      for (
        const [fieldName, rawValue]
        of numericFields
      ) {
        if (
          rawValue !== undefined &&
          rawValue !== null &&
          rawValue !== ""
        ) {
          const parsed =
            optionalNumber(rawValue);

          if (parsed === null) {
            return sendBadRequest(
              reply,
              `${fieldName} must be a valid number`,
            );
          }
        }
      }

      if (
        latitude !== null &&
        (latitude < -90 ||
          latitude > 90)
      ) {
        return sendBadRequest(
          reply,
          "latitude must be between -90 and 90",
        );
      }

      if (
        longitude !== null &&
        (longitude < -180 ||
          longitude > 180)
      ) {
        return sendBadRequest(
          reply,
          "longitude must be between -180 and 180",
        );
      }

      if (
        estimatedPriceMin !== null &&
        estimatedPriceMin < 0
      ) {
        return sendBadRequest(
          reply,
          "estimated_price_min cannot be negative",
        );
      }

      if (
        estimatedPriceMax !== null &&
        estimatedPriceMax < 0
      ) {
        return sendBadRequest(
          reply,
          "estimated_price_max cannot be negative",
        );
      }

      if (
        estimatedPriceMin !== null &&
        estimatedPriceMax !== null &&
        estimatedPriceMin >
          estimatedPriceMax
      ) {
        return sendBadRequest(
          reply,
          "estimated_price_min cannot be greater than estimated_price_max",
        );
      }

      if (
        (priceStatus === "confirmed" ||
          priceStatus === "final") &&
        estimatedPriceMin === null &&
        estimatedPriceMax === null
      ) {
        return sendBadRequest(
          reply,
          "A price estimate is required when price_status is confirmed or final",
        );
      }

      const { data, error } =
        await supabase
          .from("service_orders")
         .insert({
  customer_id: customerId,

  client_order_id:
    clientOrderId,

  form_version:
    formVersion,

  answers:
    answers ?? [],

  evidence_files:
    evidenceFiles ?? [],

  vehicle_id:
    optionalString(
      body.vehicle_id,
    ),
            service_category:
              serviceCategory,
            service_description:
              optionalString(
                body.service_description,
              ),
            urgency,
            service_mode:
              serviceMode,
            address:
              optionalString(
                body.address,
              ),
            region:
              optionalString(
                body.region,
              ),
            district:
              optionalString(
                body.district,
              ),
            latitude,
            longitude,
            estimated_price_min:
              estimatedPriceMin,
            estimated_price_max:
              estimatedPriceMax,
            price_status:
              priceStatus,
            customer_note:
              optionalString(
                body.customer_note,
              ),
          })
          .select("*")
          .single();

   if (error) {
  app.log.error(error);

  if (
    error.code === "23505" &&
    clientOrderId
  ) {
    return sendConflict(
      reply,
      "This client_order_id already exists",
    );
  }

  return sendServerError(
    reply,
    "Service order could not be created",
  );
}

      return reply.code(201).send({
        message:
          "Service order created successfully",
        order: data,
      });
    },
  );

  /*
   * ==========================================================
   * POST /service-orders/:orderId/assignments
   * Customer provider-ə sifariş təklif edir.
   * ==========================================================
   */

  app.post(
    "/service-orders/:orderId/assignments",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const customerId =
        getAuthenticatedUserId(request);

      const params =
        request.params as {
          orderId?: string;
        };

      const body =
        (request.body ?? {}) as AssignmentBody;

      if (
        !isNonEmptyString(
          params.orderId,
        )
      ) {
        return sendBadRequest(
          reply,
          "orderId is required",
        );
      }

      if (
        !isNonEmptyString(
          body.provider_id,
        )
      ) {
        return sendBadRequest(
          reply,
          "provider_id is required",
        );
      }

      if (
        !isAllowed(
          body.provider_type,
          allowedProviderTypes,
        )
      ) {
        return sendBadRequest(
          reply,
          "provider_type must be mechanic, shop, tow, or cargo",
        );
      }

      const providerId =
        body.provider_id.trim();

      const providerType =
        body.provider_type;

      const distanceKm =
        optionalNumber(
          body.distance_km,
        );

      if (
        body.distance_km !==
          undefined &&
        body.distance_km !== null &&
        body.distance_km !== "" &&
        distanceKm === null
      ) {
        return sendBadRequest(
          reply,
          "distance_km must be a valid number",
        );
      }

      if (
        distanceKm !== null &&
        distanceKm < 0
      ) {
        return sendBadRequest(
          reply,
          "distance_km cannot be negative",
        );
      }

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("service_orders")
        .select(
          "id, status, customer_id, service_category, service_mode",
        )
        .eq(
          "id",
          params.orderId,
        )
        .single();

      if (
        orderError ||
        !order
      ) {
        return sendNotFound(
          reply,
          "Service order not found",
        );
      }

      if (
        order.customer_id !==
        customerId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to assign providers to this service order",
        );
      }

      if (
        order.status !==
        "pending"
      ) {
        return sendConflict(
          reply,
          "Assignments can only be created for pending service orders",
        );
      }

      const {
        data: provider,
        error: providerError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, role, is_active",
        )
        .eq(
          "id",
          providerId,
        )
        .single();

      if (
        providerError ||
        !provider
      ) {
        return sendNotFound(
          reply,
          "Provider not found",
        );
      }

      if (
        !provider.is_active
      ) {
        return sendConflict(
          reply,
          "Provider is not active",
        );
      }

      if (
        provider.role !==
        providerType
      ) {
        return sendConflict(
          reply,
          "Provider type does not match provider profile role",
        );
      }

      const serviceCategory =
        order.service_category as ServiceCategory;

      const serviceMode =
        order.service_mode as ServiceMode;

      if (
        !isAllowed(
          serviceCategory,
          allowedCategories,
        )
      ) {
        return sendConflict(
          reply,
          "Service category is not supported for provider assignment",
        );
      }

      if (
        !isAllowed(
          serviceMode,
          allowedServiceModes,
        )
      ) {
        return sendConflict(
          reply,
          "Service mode is not supported for provider assignment",
        );
      }

      const expectedType =
        expectedProviderType(
          serviceCategory,
          serviceMode,
        );

      if (
        providerType !==
        expectedType
      ) {
        return sendConflict(
          reply,
          "Provider type is not compatible with this service order",
        );
      }

      const {
        data: existingAssignment,
        error: existingError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select("id, status")
        .eq(
          "order_id",
          params.orderId,
        )
        .eq(
          "provider_id",
          providerId,
        )
        .maybeSingle();

      if (existingError) {
        app.log.error(
          existingError,
        );

        return sendServerError(
          reply,
          "Existing assignment could not be checked",
        );
      }

      if (
        existingAssignment
      ) {
        return reply.code(409).send({
          error: "Conflict",
          message:
            "This provider has already been assigned to this order",
          assignment:
            existingAssignment,
        });
      }

      const {
        data: assignment,
        error: assignmentError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .insert({
          order_id:
            params.orderId,
          provider_id:
            providerId,
          provider_type:
            providerType,
          status: "offered",
          distance_km:
            distanceKm,
        })
        .select("*")
        .single();

      if (assignmentError) {
        app.log.error(
          assignmentError,
        );

        return sendServerError(
          reply,
          "Service order assignment could not be created",
        );
      }

      return reply.code(201).send({
        message:
          "Service order offered to provider successfully",
        assignment,
      });
    },
  );

  /*
   * ==========================================================
   * PATCH /service-order-assignments/:assignmentId/accept
   * Provider sifarişi qəbul edir.
   * ==========================================================
   */

  app.patch(
    "/service-order-assignments/:assignmentId/accept",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const providerUserId =
        getAuthenticatedUserId(
          request,
        );

      const params =
        request.params as {
          assignmentId?: string;
        };

      if (
        !isNonEmptyString(
          params.assignmentId,
        )
      ) {
        return sendBadRequest(
          reply,
          "assignmentId is required",
        );
      }

      const {
        data: assignment,
        error: assignmentError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select("*")
        .eq(
          "id",
          params.assignmentId,
        )
        .single();

      if (
        assignmentError ||
        !assignment
      ) {
        return sendNotFound(
          reply,
          "Service order assignment not found",
        );
      }

      if (
        assignment.provider_id !==
        providerUserId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to accept this assignment",
        );
      }

      if (
        assignment.status !==
        "offered"
      ) {
        return sendConflict(
          reply,
          "Only offered assignments can be accepted",
        );
      }

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("service_orders")
        .select("id, status")
        .eq(
          "id",
          assignment.order_id,
        )
        .single();

      if (
        orderError ||
        !order
      ) {
        return sendNotFound(
          reply,
          "Service order not found",
        );
      }

      if (
        order.status !==
        "pending"
      ) {
        return sendConflict(
          reply,
          "This service order is no longer available for acceptance",
        );
      }

      const acceptedAt =
        new Date().toISOString();

      const {
        data: updatedOrder,
        error: updateOrderError,
      } = await supabase
        .from("service_orders")
        .update({
          status: "accepted",
          accepted_at:
            acceptedAt,
        })
        .eq(
          "id",
          assignment.order_id,
        )
        .eq(
          "status",
          "pending",
        )
        .select("*")
        .single();

      if (
        updateOrderError ||
        !updatedOrder
      ) {
        app.log.error(
          updateOrderError,
        );

        return sendConflict(
          reply,
          "Service order could not be accepted because it is no longer pending",
        );
      }

      const {
        data: acceptedAssignment,
        error: acceptError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .update({
          status: "accepted",
          accepted_at:
            acceptedAt,
        })
        .eq(
          "id",
          params.assignmentId,
        )
        .eq(
          "provider_id",
          providerUserId,
        )
        .eq(
          "status",
          "offered",
        )
        .select("*")
        .single();

      if (
        acceptError ||
        !acceptedAssignment
      ) {
        app.log.error(
          acceptError,
        );

        await supabase
          .from("service_orders")
          .update({
            status: "pending",
            accepted_at: null,
          })
          .eq(
            "id",
            assignment.order_id,
          )
          .eq(
            "status",
            "accepted",
          );

        return sendConflict(
          reply,
          "Service order assignment could not be accepted",
        );
      }

      const {
        error: cancelOtherError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .update({
          status: "cancelled",
        })
        .eq(
          "order_id",
          assignment.order_id,
        )
        .eq(
          "status",
          "offered",
        )
        .neq(
          "id",
          params.assignmentId,
        );

      if (cancelOtherError) {
        app.log.error(
          cancelOtherError,
        );
      }

      return reply.send({
        message:
          "Service order accepted successfully",
        order: updatedOrder,
        assignment:
          acceptedAssignment,
      });
    },
  );

  /*
   * ==========================================================
   * PATCH /service-order-assignments/:assignmentId/reject
   * Provider sifarişi rədd edir.
   * ==========================================================
   */

  app.patch(
    "/service-order-assignments/:assignmentId/reject",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const providerUserId =
        getAuthenticatedUserId(
          request,
        );

      const params =
        request.params as {
          assignmentId?: string;
        };

      if (
        !isNonEmptyString(
          params.assignmentId,
        )
      ) {
        return sendBadRequest(
          reply,
          "assignmentId is required",
        );
      }

      const {
        data: assignment,
        error: assignmentError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select("*")
        .eq(
          "id",
          params.assignmentId,
        )
        .single();

      if (
        assignmentError ||
        !assignment
      ) {
        return sendNotFound(
          reply,
          "Service order assignment not found",
        );
      }

      if (
        assignment.provider_id !==
        providerUserId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to reject this assignment",
        );
      }

      if (
        assignment.status !==
        "offered"
      ) {
        return sendConflict(
          reply,
          "Only offered assignments can be rejected",
        );
      }

      const {
        data: rejectedAssignment,
        error: rejectError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .update({
          status: "rejected",
          rejected_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          params.assignmentId,
        )
        .eq(
          "provider_id",
          providerUserId,
        )
        .eq(
          "status",
          "offered",
        )
        .select("*")
        .single();

      if (
        rejectError ||
        !rejectedAssignment
      ) {
        app.log.error(
          rejectError,
        );

        return sendConflict(
          reply,
          "Service order assignment could not be rejected",
        );
      }

      return reply.send({
        message:
          "Service order assignment rejected successfully",
        assignment:
          rejectedAssignment,
      });
    },
  );

  /*
   * ==========================================================
   * GET /service-order-assignments
   * Provider özünə təklif / təyin edilmiş sifarişləri görür.
   * Offered assignment-lər də qaytarılır ki, provider onları
   * qəbul və ya rədd edə bilsin.
   * ==========================================================
   */

  app.get(
    "/service-order-assignments",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const providerUserId =
        getAuthenticatedUserId(request);

      const {
        data: assignments,
        error: assignmentsError,
      } = await supabase
        .from("service_order_assignments")
        .select(
          "id, order_id, provider_id, provider_type, status, distance_km, offered_at, accepted_at, rejected_at, completed_at, created_at, updated_at",
        )
        .eq("provider_id", providerUserId)
        .order("created_at", {
          ascending: false,
        });

      if (assignmentsError) {
        app.log.error(assignmentsError);

        return sendServerError(
          reply,
          "Provider assignments could not be loaded",
        );
      }

      const providerAssignments =
        assignments ?? [];

      if (providerAssignments.length === 0) {
        return reply.send({
          assignments: [],
        });
      }

      const orderIds = [
        ...new Set(
          providerAssignments.map(
            (assignment) => assignment.order_id,
          ),
        ),
      ];

      const {
        data: orders,
        error: ordersError,
      } = await supabase
        .from("service_orders")
        .select("*")
        .in("id", orderIds);

      if (ordersError) {
        app.log.error(ordersError);

        return sendServerError(
          reply,
          "Assigned service orders could not be loaded",
        );
      }

      const orderById = new Map(
        (orders ?? []).map((order) => [
          order.id,
          order,
        ]),
      );

      const enrichedAssignments =
        providerAssignments.map(
          (assignment) => ({
            ...assignment,
            order:
              orderById.get(
                assignment.order_id,
              ) ?? null,
          }),
        );

      return reply.send({
        assignments: enrichedAssignments,
      });
    },
  );

  /*
   * ==========================================================
   * POST /service-order-assignments/:assignmentId/evidence/:stage
   * Assigned provider BEFORE / AFTER photo yükləyir.
   * BEFORE: order accepted olarkən.
   * AFTER: order in_progress olarkən.
   * ==========================================================
   */

  app.post(
    "/service-order-assignments/:assignmentId/evidence/:stage",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const providerUserId =
        getAuthenticatedUserId(
          request,
        );

      const params =
        request.params as {
          assignmentId?: string;
          stage?: string;
        };

      if (
        !isNonEmptyString(
          params.assignmentId,
        )
      ) {
        return sendBadRequest(
          reply,
          "assignmentId is required",
        );
      }

      if (
        params.stage !== "before" &&
        params.stage !== "after"
      ) {
        return sendBadRequest(
          reply,
          "stage must be before or after",
        );
      }

      const stage =
        params.stage as
          | "before"
          | "after";

      const {
        data: assignment,
        error: assignmentError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select("*")
        .eq(
          "id",
          params.assignmentId,
        )
        .single();

      if (
        assignmentError ||
        !assignment
      ) {
        return sendNotFound(
          reply,
          "Service order assignment not found",
        );
      }

      if (
        assignment.provider_id !==
        providerUserId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to upload evidence for this assignment",
        );
      }

    if (
  stage === "before" &&
  assignment.status !==
    "accepted"
) {
  return sendConflict(
    reply,
    "BEFORE photo can only be uploaded for an accepted assignment",
  );
}

if (
  stage === "after" &&
  assignment.status !==
    "in_progress"
) {
  return sendConflict(
    reply,
    "AFTER photo can only be uploaded for an in-progress assignment",
  );
}

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("service_orders")
        .select(
          "id, customer_id, client_order_id, status, evidence_files",
        )
        .eq(
          "id",
          assignment.order_id,
        )
        .single();

      if (
        orderError ||
        !order
      ) {
        return sendNotFound(
          reply,
          "Service order not found",
        );
      }

      if (
        stage === "before" &&
        order.status !== "accepted"
      ) {
        return sendConflict(
          reply,
          "BEFORE photo can only be uploaded before the service starts",
        );
      }

      if (
        stage === "after" &&
        order.status !==
          "in_progress"
      ) {
        return sendConflict(
          reply,
          "AFTER photo can only be uploaded while the service is in progress",
        );
      }

      let file:
        | Awaited<
            ReturnType<
              typeof request.file
            >
          >
        | undefined;

      try {
        file = await request.file();
      } catch (error) {
        app.log.error(error);

        return sendBadRequest(
          reply,
          "Photo upload could not be read",
        );
      }

      if (!file) {
        return sendBadRequest(
          reply,
          "Photo file is required",
        );
      }

      const extension =
        safeFileExtension(
          file.mimetype,
        );

      if (!extension) {
        return sendBadRequest(
          reply,
          "Only JPEG, PNG, or WEBP photos are allowed",
        );
      }

      let buffer: Buffer;

      try {
        buffer =
          await file.toBuffer();
      } catch (error) {
        app.log.error(error);

        return sendBadRequest(
          reply,
          "Photo could not be read or exceeds the upload limit",
        );
      }

      if (buffer.length === 0) {
        return sendBadRequest(
          reply,
          "Photo file is empty",
        );
      }

      if (
        buffer.length >
        10 * 1024 * 1024
      ) {
        return sendBadRequest(
          reply,
          "Photo cannot exceed 10 MB",
        );
      }

      const orderFolder =
        isNonEmptyString(
          order.client_order_id,
        )
          ? order.client_order_id
              .trim()
              .replace(
                /[^a-zA-Z0-9_-]/g,
                "_",
              )
          : order.id;

      const storagePath =
        `${order.customer_id}/${orderFolder}/${stage}/${Date.now()}-${randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("service-evidence")
        .upload(
          storagePath,
          buffer,
          {
            contentType:
              file.mimetype,
            upsert: false,
          },
        );

      if (uploadError) {
        app.log.error(
          uploadError,
        );

        return sendServerError(
          reply,
          "Photo could not be uploaded",
        );
      }

      const evidenceRecord:
        ServiceEvidenceRecord = {
        bucket:
          "service-evidence",
        path: storagePath,
        category: stage,
        content_type:
          file.mimetype,
        uploaded_at:
          new Date().toISOString(),
        assignment_id:
          assignment.id,
      };

      const existingEvidence =
        Array.isArray(
          order.evidence_files,
        )
          ? order.evidence_files
          : [];

      const nextEvidence = [
        ...existingEvidence,
        evidenceRecord,
      ];

      const expectedStatus =
        stage === "before"
          ? "accepted"
          : "in_progress";

      const {
        data: updatedOrder,
        error: evidenceUpdateError,
      } = await supabase
        .from("service_orders")
        .update({
          evidence_files:
            nextEvidence,
        })
        .eq(
          "id",
          order.id,
        )
        .eq(
          "status",
          expectedStatus,
        )
        .select("*")
        .single();

      if (
        evidenceUpdateError ||
        !updatedOrder
      ) {
        app.log.error(
          evidenceUpdateError,
        );

        const {
          error: removeError,
        } = await supabase.storage
          .from(
            "service-evidence",
          )
          .remove([
            storagePath,
          ]);

        if (removeError) {
          app.log.error(
            removeError,
          );
        }

        return sendConflict(
          reply,
          "Service order changed before the photo could be attached",
        );
      }

      return reply.code(201).send({
        message:
          stage === "before"
            ? "BEFORE photo uploaded successfully"
            : "AFTER photo uploaded successfully",
        evidence:
          evidenceRecord,
        order: updatedOrder,
      });
    },
  );

/*
 * ==========================================================
 * PATCH /service-order-assignments/:assignmentId/start
 * Provider qəbul etdiyi sifarişə başlayır.
 * Order və assignment birlikdə in_progress olur.
 * ==========================================================
 */

app.patch(
  "/service-order-assignments/:assignmentId/start",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
    const providerUserId =
      getAuthenticatedUserId(
        request,
      );

    const params =
      request.params as {
        assignmentId?: string;
      };

    if (
      !isNonEmptyString(
        params.assignmentId,
      )
    ) {
      return sendBadRequest(
        reply,
        "assignmentId is required",
      );
    }

    const {
      data: assignment,
      error: assignmentError,
    } = await supabase
      .from(
        "service_order_assignments",
      )
      .select("*")
      .eq(
        "id",
        params.assignmentId,
      )
      .single();

    if (
      assignmentError ||
      !assignment
    ) {
      return sendNotFound(
        reply,
        "Service order assignment not found",
      );
    }

    if (
      assignment.provider_id !==
      providerUserId
    ) {
      return sendForbidden(
        reply,
        "You are not allowed to start this assignment",
      );
    }

    if (
      assignment.status !==
      "accepted"
    ) {
      return sendConflict(
        reply,
        "Only accepted assignments can be started",
      );
    }

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("service_orders")
      .select("*")
      .eq(
        "id",
        assignment.order_id,
      )
      .single();

    if (
      orderError ||
      !order
    ) {
      return sendNotFound(
        reply,
        "Service order not found",
      );
    }

    if (
      order.status !==
      "accepted"
    ) {
      return sendConflict(
        reply,
        "Only accepted service orders can be started",
      );
    }

    if (
      !hasAssignmentEvidence(
        order.evidence_files,
        "before",
        assignment.id,
      )
    ) {
      return sendConflict(
        reply,
        "BEFORE photo is required before starting the service",
      );
    }

    const startedAt =
      new Date().toISOString();

    /*
     * Əvvəl order statusunu
     * in_progress edirik.
     */
    const {
      data: startedOrder,
      error: startOrderError,
    } = await supabase
      .from("service_orders")
      .update({
        status: "in_progress",
        started_at:
          startedAt,
      })
      .eq(
        "id",
        assignment.order_id,
      )
      .eq(
        "status",
        "accepted",
      )
      .select("*")
      .single();

    if (
      startOrderError ||
      !startedOrder
    ) {
      app.log.error(
        startOrderError,
      );

      return sendConflict(
        reply,
        "Service order could not be started",
      );
    }

    /*
     * Sonra assignment statusunu da
     * in_progress edirik.
     */
    const {
      data: startedAssignment,
      error: startAssignmentError,
    } = await supabase
      .from(
        "service_order_assignments",
      )
      .update({
        status: "in_progress",
        updated_at:
          startedAt,
      })
      .eq(
        "id",
        assignment.id,
      )
      .eq(
        "provider_id",
        providerUserId,
      )
      .eq(
        "status",
        "accepted",
      )
      .select("*")
      .single();

    if (
      startAssignmentError ||
      !startedAssignment
    ) {
      app.log.error(
        startAssignmentError,
      );

      /*
       * Assignment yenilənməzsə,
       * order-i accepted vəziyyətinə
       * geri qaytarırıq ki statuslar
       * bir-birindən ayrılmasın.
       */
      const {
        error: rollbackError,
      } = await supabase
        .from("service_orders")
        .update({
          status: "accepted",
          started_at: null,
        })
        .eq(
          "id",
          assignment.order_id,
        )
        .eq(
          "status",
          "in_progress",
        );

      if (rollbackError) {
        app.log.error(
          rollbackError,
        );
      }

      return reply
        .code(500)
        .send({
          error:
            "Internal Server Error",
          message:
            "Assignment could not be started",
        });
    }

    return reply.send({
      message:
        "Service order started successfully",
      order:
        startedOrder,
      assignment:
        startedAssignment,
    });
  },
);
  /*
   * ==========================================================
   * PATCH /service-order-assignments/:assignmentId/complete
   * Provider işi tamamlayır.
   * ==========================================================
   */

  app.patch(
    "/service-order-assignments/:assignmentId/complete",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const providerUserId =
        getAuthenticatedUserId(
          request,
        );

      const params =
        request.params as {
          assignmentId?: string;
        };

      const body =
        (request.body ?? {}) as CompleteAssignmentBody;

      if (
        !isNonEmptyString(
          params.assignmentId,
        )
      ) {
        return sendBadRequest(
          reply,
          "assignmentId is required",
        );
      }

      const {
        data: assignment,
        error: assignmentError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .select("*")
        .eq(
          "id",
          params.assignmentId,
        )
        .single();

      if (
        assignmentError ||
        !assignment
      ) {
        return sendNotFound(
          reply,
          "Service order assignment not found",
        );
      }

      if (
        assignment.provider_id !==
        providerUserId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to complete this assignment",
        );
      }

     if (
  assignment.status !==
  "in_progress"
) {
  return sendConflict(
    reply,
    "Only in-progress assignments can be completed",
  );
}

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("service_orders")
        .select("*")
        .eq(
          "id",
          assignment.order_id,
        )
        .single();

      if (
        orderError ||
        !order
      ) {
        return sendNotFound(
          reply,
          "Service order not found",
        );
      }

      if (
        order.status !==
        "in_progress"
      ) {
        return sendConflict(
          reply,
          "Only in-progress service orders can be completed",
        );
      }

      if (
        !hasAssignmentEvidence(
          order.evidence_files,
          "after",
          assignment.id,
        )
      ) {
        return sendConflict(
          reply,
          "AFTER photo is required before completing the service",
        );
      }

      let finalPrice:
        | number
        | null = null;

      if (
        body.final_price !==
          undefined &&
        body.final_price !==
          null &&
        body.final_price !== ""
      ) {
        finalPrice =
          optionalNumber(
            body.final_price,
          );

        if (
          finalPrice === null ||
          finalPrice < 0
        ) {
          return sendBadRequest(
            reply,
            "final_price must be a valid non-negative number",
          );
        }
      }

      const priceStatus: PriceStatus =
        body.price_status ===
          undefined ||
        body.price_status === null ||
        body.price_status === ""
          ? finalPrice !== null
            ? "final"
            : ((order.price_status ??
                "unknown") as PriceStatus)
          : (body.price_status as PriceStatus);

      if (
        !isAllowed(
          priceStatus,
          allowedPriceStatuses,
        )
      ) {
        return sendBadRequest(
          reply,
          "Invalid price_status",
        );
      }

      if (
        (priceStatus ===
          "confirmed" ||
          priceStatus === "final") &&
        finalPrice === null &&
        order.final_price === null
      ) {
        return sendBadRequest(
          reply,
          "final_price is required when price_status is confirmed or final",
        );
      }

      const completedAt =
        new Date().toISOString();

      const {
        data: completedAssignment,
        error:
          assignmentCompleteError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .update({
          status: "completed",
          completed_at:
            completedAt,
        })
        .eq(
          "id",
          params.assignmentId,
        )
        .eq(
          "provider_id",
          providerUserId,
        )
         .eq(
            "status",
           "in_progress"
        )
        .select("*")
        .single();

      if (
        assignmentCompleteError ||
        !completedAssignment
      ) {
        app.log.error(
          assignmentCompleteError,
        );

        return sendConflict(
          reply,
          "Service order assignment could not be completed",
        );
      }

      const orderUpdate:
        Record<string, unknown> = {
        status: "completed",
        completed_at:
          completedAt,
        price_status:
          priceStatus,
      };

      if (finalPrice !== null) {
        orderUpdate.final_price =
          finalPrice;
      }

      const {
        data: completedOrder,
        error:
          orderCompleteError,
      } = await supabase
        .from("service_orders")
        .update(orderUpdate)
        .eq(
          "id",
          assignment.order_id,
        )
        .eq(
          "status",
          "in_progress",
        )
        .select("*")
        .single();

      if (
        orderCompleteError ||
        !completedOrder
      ) {
        app.log.error(
          orderCompleteError,
        );

        await supabase
          .from(
            "service_order_assignments",
          )
        .update({
           status: "in_progress",
           completed_at: null,
         })
          .eq(
            "id",
            params.assignmentId,
          )
          .eq(
            "provider_id",
            providerUserId,
          )
          .eq(
            "status",
            "completed",
          );

        return sendConflict(
          reply,
          "Service order could not be completed",
        );
      }

      return reply.send({
        message:
          "Service order completed successfully",
        order: completedOrder,
        assignment:
          completedAssignment,
      });
    },
  );

  /*
   * ==========================================================
   * PATCH /service-orders/:orderId/cancel
   * Customer sifarişi ləğv edir.
   * ==========================================================
   */

  app.patch(
    "/service-orders/:orderId/cancel",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const customerId =
        getAuthenticatedUserId(
          request,
        );

      const params =
        request.params as {
          orderId?: string;
        };

      if (
        !isNonEmptyString(
          params.orderId,
        )
      ) {
        return sendBadRequest(
          reply,
          "orderId is required",
        );
      }

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("service_orders")
        .select("*")
        .eq(
          "id",
          params.orderId,
        )
        .single();

      if (
        orderError ||
        !order
      ) {
        return sendNotFound(
          reply,
          "Service order not found",
        );
      }

      if (
        order.customer_id !==
        customerId
      ) {
        return sendForbidden(
          reply,
          "You are not allowed to cancel this service order",
        );
      }

      if (
        order.status ===
        "completed"
      ) {
        return sendConflict(
          reply,
          "Completed service orders cannot be cancelled",
        );
      }

      if (
        order.status ===
        "cancelled"
      ) {
        return sendConflict(
          reply,
          "Service order is already cancelled",
        );
      }

      const {
        data: cancelledOrder,
        error: cancelError,
      } = await supabase
        .from("service_orders")
        .update({
          status: "cancelled",
        })
        .eq(
          "id",
          params.orderId,
        )
        .eq(
          "customer_id",
          customerId,
        )
        .not(
          "status",
          "in",
          "(completed,cancelled)",
        )
        .select("*")
        .single();

      if (
        cancelError ||
        !cancelledOrder
      ) {
        app.log.error(
          cancelError,
        );

        return sendConflict(
          reply,
          "Service order could not be cancelled",
        );
      }

      const {
        error: assignmentCancelError,
      } = await supabase
        .from(
          "service_order_assignments",
        )
        .update({
          status: "cancelled",
        })
        .eq(
          "order_id",
          params.orderId,
        )
        .in(
          "status",
          ["offered", "accepted"],
        );

      if (
        assignmentCancelError
      ) {
        app.log.error(
          assignmentCancelError,
        );

        return reply.code(500).send({
          error:
            "Internal Server Error",
          message:
            "Service order was cancelled, but assignments could not be fully cancelled",
          order:
            cancelledOrder,
        });
      }

      return reply.send({
        message:
          "Service order cancelled successfully",
        order: cancelledOrder,
      });
    },
  );
}
