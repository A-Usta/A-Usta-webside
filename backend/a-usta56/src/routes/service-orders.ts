import type { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

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

const allowedProviderTypes = [
  "mechanic",
  "shop",
  "tow",
  "cargo",
] as const;


export async function serviceOrderRoutes(app: FastifyInstance) {
  /*
   * =====================================================
   * GET /service-orders
   * Bütün service order-ləri gətir
   * =====================================================
   */
 app.get(
  "/service-orders",
  {
    preHandler: requireAuth,
  },
  async (request) => {
    const authenticatedRequest = request as AuthenticatedRequest;

    
    const { data, error } = await supabase
      .from("service_orders")
      .select("*")
      .eq("customer_id", authenticatedRequest.user.id)
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
  },
);

  /*
   * =====================================================
   * POST /service-orders
   * Yeni service order yarat
   * =====================================================
   */
app.post(
  "/service-orders",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
    const authenticatedRequest = request as AuthenticatedRequest;

    const body = request.body as {
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
       customer_id: authenticatedRequest.user.id,
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

  /*
   * =====================================================
   * POST /service-orders/:orderId/assignments
   * Sifarişi provider-ə təklif et
   * =====================================================
   */
  app.post(
  "/service-orders/:orderId/assignments",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
      const params = request.params as {
        orderId?: string;
      };

      const body = request.body as {
        provider_id?: string;
        provider_type?: string;
        distance_km?: number;
      };

      if (!params.orderId) {
        return reply.code(400).send({
          error: "orderId is required",
        });
      }

      if (!body.provider_id) {
        return reply.code(400).send({
          error: "provider_id is required",
        });
      }

      if (
        !body.provider_type ||
        !allowedProviderTypes.includes(
          body.provider_type as (typeof allowedProviderTypes)[number],
        )
      ) {
        return reply.code(400).send({
          error:
            "provider_type must be mechanic, shop, tow, or cargo",
        });
      }

      if (
        body.distance_km !== undefined &&
        body.distance_km < 0
      ) {
        return reply.code(400).send({
          error: "distance_km cannot be negative",
        });
      }

      /*
       * Sifariş mövcuddurmu?
       */
    const authenticatedRequest = request as AuthenticatedRequest;
    
    const { data: order, error: orderError } = await supabase
  .from("service_orders")
  .select("id, status, customer_id, service_category, service_mode")
  .eq("id", params.orderId)
  .single();

      if (orderError || !order) {
        return reply.code(404).send({
          error: "Service order not found",
        });
      }
    
    if (order.customer_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to assign providers to this service order",
  });
}

      /*
       * Artıq qəbul edilmiş sifarişə yeni provider
       * təklif edilmir.
       */
      if (order.status !== "pending") {
        return reply.code(409).send({
          error:
            "Assignments can only be created for pending service orders",
        });
      }

      /*
       * Provider mövcuddurmu və aktivdirmi?
       */
      const { data: provider, error: providerError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", body.provider_id)
        .single();

      if (providerError || !provider) {
        return reply.code(404).send({
          error: "Provider not found",
        });
      }

     if (!provider.is_active) {
  return reply.code(409).send({
    error: "Provider is not active",
  });
}

if (provider.role !== body.provider_type) {
  return reply.code(409).send({
    error: "Provider type does not match provider profile role",
  });
}

   let expectedProviderType: "mechanic" | "shop" | "tow" | "cargo";

switch (order.service_category) {
  case "mechanic_service":
    expectedProviderType =
      order.service_mode === "shop" ? "shop" : "mechanic";
    break;

  case "tow_service":
    expectedProviderType = "tow";
    break;

  case "cargo_service":
    expectedProviderType = "cargo";
    break;

  default:
    return reply.code(409).send({
      error: "Service category is not supported for provider assignment",
    });
}

if (body.provider_type !== expectedProviderType) {
  return reply.code(409).send({
    error: "Provider type is not compatible with this service order",
  });
}

      /*
       * Eyni sifariş + provider artıq mövcuddursa,
       * ikinci assignment yaratma.
       */
      const { data: existingAssignment, error: existingError } =
        await supabase
          .from("service_order_assignments")
          .select("id, status")
          .eq("order_id", params.orderId)
          .eq("provider_id", body.provider_id)
          .maybeSingle();

      if (existingError) {
        app.log.error(existingError);

        return reply.code(500).send({
          error: "Existing assignment could not be checked",
        });
      }

      if (existingAssignment) {
        return reply.code(409).send({
          error: "This provider has already been assigned to this order",
          assignment: existingAssignment,
        });
      }

      /*
       * Yeni assignment
       */
      const { data: assignment, error: assignmentError } =
        await supabase
          .from("service_order_assignments")
          .insert({
            order_id: params.orderId,
            provider_id: body.provider_id,
            provider_type: body.provider_type,
            status: "offered",
            distance_km: body.distance_km ?? null,
          })
          .select("*")
          .single();

      if (assignmentError) {
        app.log.error(assignmentError);

        return reply.code(500).send({
          error: "Service order assignment could not be created",
        });
      }

      return reply.code(201).send({
        message: "Service order offered to provider successfully",
        assignment,
      });
    },
  );

  /*
   * =====================================================
   * PATCH /service-order-assignments/:assignmentId/accept
   * Provider sifarişi qəbul edir
   * =====================================================
   */
 app.patch(
  "/service-order-assignments/:assignmentId/accept",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
      const params = request.params as {
        assignmentId?: string;
      };

    
    const authenticatedRequest = request as AuthenticatedRequest;
    
      if (!params.assignmentId) {
        return reply.code(400).send({
          error: "assignmentId is required",
        });
      }

      /*
       * Assignment-i tap
       */
      const { data: assignment, error: assignmentError } =
        await supabase
          .from("service_order_assignments")
          .select("*")
          .eq("id", params.assignmentId)
          .single();

  if (assignmentError || !assignment) {
  return reply.code(404).send({
    error: "Service order assignment not found",
  });
}

if (assignment.provider_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to accept this assignment",
  });
}

      /*
       * Yalnız offered assignment qəbul edilə bilər.
       */
      if (assignment.status !== "offered") {
        return reply.code(409).send({
          error:
            "Only offered assignments can be accepted",
        });
      }

      /*
       * Sifarişi yoxla
       */
      const { data: order, error: orderError } = await supabase
        .from("service_orders")
        .select("id, status")
        .eq("id", assignment.order_id)
        .single();

      if (orderError || !order) {
        return reply.code(404).send({
          error: "Service order not found",
        });
      }

      /*
       * Sifariş artıq başqa provider tərəfindən qəbul edilibsə,
       * ikinci qəbulun qarşısını al.
       */
      if (order.status !== "pending") {
        return reply.code(409).send({
          error:
            "This service order is no longer available for acceptance",
        });
      }

      /*
       * Assignment-i accepted et
       */
      const { data: acceptedAssignment, error: acceptError } =
        await supabase
          .from("service_order_assignments")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", params.assignmentId)
          .eq("status", "offered")
          .select("*")
          .single();

      if (acceptError || !acceptedAssignment) {
        app.log.error(acceptError);

        return reply.code(409).send({
          error:
            "Service order assignment could not be accepted",
        });
      }

      /*
       * Əsas sifariş statusunu accepted et
       */
     const { data: updatedOrder, error: updateOrderError } =
  await supabase
    .from("service_orders")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
          .eq("id", assignment.order_id)
          .eq("status", "pending")
          .select("*")
          .single();

      if (updateOrderError || !updatedOrder) {
        app.log.error(updateOrderError);

        /*
         * Əsas sifariş accepted ola bilmədisə,
         * assignment-i geri offered vəziyyətinə qaytar.
         */
        await supabase
          .from("service_order_assignments")
          .update({
            status: "offered",
            accepted_at: null,
          })
          .eq("id", params.assignmentId);

        return reply.code(409).send({
          error:
            "Service order could not be moved to accepted status",
        });
      }

      /*
       * Eyni sifarişə göndərilmiş digər offered
       * assignment-ləri ləğv et.
       */
      const { error: cancelOtherError } = await supabase
        .from("service_order_assignments")
        .update({
          status: "cancelled",
        })
        .eq("order_id", assignment.order_id)
        .eq("status", "offered")
        .neq("id", params.assignmentId);

      if (cancelOtherError) {
        app.log.error(cancelOtherError);
      }

      return reply.send({
        message: "Service order accepted successfully",
        order: updatedOrder,
        assignment: acceptedAssignment,
      });
    },
  );

  /*
   * =====================================================
   * PATCH /service-order-assignments/:assignmentId/reject
   * Provider sifarişi rədd edir
   * =====================================================
   */
  app.patch(
  "/service-order-assignments/:assignmentId/reject",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
     const params = request.params as {
  assignmentId?: string;
};

const authenticatedRequest = request as AuthenticatedRequest;

      if (!params.assignmentId) {
        return reply.code(400).send({
          error: "assignmentId is required",
        });
      }

      const { data: assignment, error: assignmentError } =
        await supabase
          .from("service_order_assignments")
          .select("*")
          .eq("id", params.assignmentId)
          .single();

      if (assignmentError || !assignment) {
        return reply.code(404).send({
          error: "Service order assignment not found",
        });
      }

    if (assignment.provider_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to reject this assignment",
  });
}
    
      if (assignment.status !== "offered") {
        return reply.code(409).send({
          error:
            "Only offered assignments can be rejected",
        });
      }

      const { data: rejectedAssignment, error: rejectError } =
        await supabase
          .from("service_order_assignments")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
          })
          .eq("id", params.assignmentId)
          .eq("status", "offered")
          .select("*")
          .single();

      if (rejectError || !rejectedAssignment) {
        app.log.error(rejectError);

        return reply.code(409).send({
          error:
            "Service order assignment could not be rejected",
        });
      }

      return reply.send({
        message: "Service order assignment rejected successfully",
        assignment: rejectedAssignment,
      });
    },
  );
   /*
   * =====================================================
   * PATCH /service-order-assignments/:assignmentId/start
   * Provider qəbul etdiyi sifarişə başlayır
   * =====================================================
   */
 app.patch(
  "/service-order-assignments/:assignmentId/start",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
     const params = request.params as {
  assignmentId?: string;
};

const authenticatedRequest = request as AuthenticatedRequest;

      if (!params.assignmentId) {
        return reply.code(400).send({
          error: "assignmentId is required",
        });
      }

      const { data: assignment, error: assignmentError } =
        await supabase
          .from("service_order_assignments")
          .select("*")
          .eq("id", params.assignmentId)
          .single();

     if (assignmentError || !assignment) {
  return reply.code(404).send({
    error: "Service order assignment not found",
  });
}

if (assignment.provider_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to start this assignment",
  });
}

      if (assignment.status !== "accepted") {
        return reply.code(409).send({
          error:
            "Only accepted assignments can be started",
        });
      }

      const { data: order, error: orderError } =
        await supabase
          .from("service_orders")
          .select("*")
          .eq("id", assignment.order_id)
          .single();

      if (orderError || !order) {
        return reply.code(404).send({
          error: "Service order not found",
        });
      }

      if (order.status !== "accepted") {
        return reply.code(409).send({
          error:
            "Only accepted service orders can be started",
        });
      }

      const { data: startedOrder, error: startError } =
  await supabase
    .from("service_orders")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
          .eq("id", assignment.order_id)
          .eq("status", "accepted")
          .select("*")
          .single();

      if (startError || !startedOrder) {
        app.log.error(startError);

        return reply.code(409).send({
          error:
            "Service order could not be started",
        });
      }

      return reply.send({
        message: "Service order started successfully",
        order: startedOrder,
        assignment,
      });
    },
  );

  /*
   * =====================================================
   * PATCH /service-order-assignments/:assignmentId/complete
   * Provider sifarişi tamamlayır
   * =====================================================
   */
 app.patch(
  "/service-order-assignments/:assignmentId/complete",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
      const params = request.params as {
  assignmentId?: string;
};

const authenticatedRequest = request as AuthenticatedRequest;

      const body = (request.body ?? {}) as {
        final_price?: number;
        price_status?: string;
      };

      if (!params.assignmentId) {
        return reply.code(400).send({
          error: "assignmentId is required",
        });
      }

      const { data: assignment, error: assignmentError } =
        await supabase
          .from("service_order_assignments")
          .select("*")
          .eq("id", params.assignmentId)
          .single();

  if (assignmentError || !assignment) {
  return reply.code(404).send({
    error: "Service order assignment not found",
  });
}

if (assignment.provider_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to complete this assignment",
  });
}

      if (assignment.status !== "accepted") {
        return reply.code(409).send({
          error:
            "Only accepted assignments can be completed",
        });
      }

      const { data: order, error: orderError } =
        await supabase
          .from("service_orders")
          .select("*")
          .eq("id", assignment.order_id)
          .single();

      if (orderError || !order) {
        return reply.code(404).send({
          error: "Service order not found",
        });
      }

      if (order.status !== "in_progress") {
        return reply.code(409).send({
          error:
            "Only in-progress service orders can be completed",
        });
      }

      const finalPrice =
        body.final_price !== undefined
          ? Number(body.final_price)
          : undefined;

      if (
        finalPrice !== undefined &&
        (!Number.isFinite(finalPrice) || finalPrice < 0)
      ) {
        return reply.code(400).send({
          error:
            "final_price must be a valid non-negative number",
        });
      }

      const priceStatus =
        body.price_status ??
        (finalPrice !== undefined
          ? "final"
          : order.price_status ?? "unknown");

      if (!allowedPriceStatuses.includes(priceStatus)) {
        return reply.code(400).send({
          error:
            "Invalid price_status",
        });
      }

      if (
        ["confirmed", "final"].includes(priceStatus) &&
        finalPrice === undefined &&
        order.final_price === null
      ) {
        return reply.code(400).send({
          error:
            "final_price is required when price_status is confirmed or final",
        });
      }

      /*
       * Əvvəl assignment tamamlanır.
       * Əgər order tamamlanmasa, assignment geri accepted vəziyyətinə qaytarılır.
       */
      const { data: completedAssignment, error: assignmentCompleteError } =
        await supabase
          .from("service_order_assignments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", params.assignmentId)
          .eq("status", "accepted")
          .select("*")
          .single();

      if (
        assignmentCompleteError ||
        !completedAssignment
      ) {
        app.log.error(assignmentCompleteError);

        return reply.code(409).send({
          error:
            "Service order assignment could not be completed",
        });
      }

     const orderUpdate: Record<string, unknown> = {
  status: "completed",
  completed_at: new Date().toISOString(),
  price_status: priceStatus,
};

      if (finalPrice !== undefined) {
        orderUpdate.final_price = finalPrice;
      }

      const { data: completedOrder, error: orderCompleteError } =
        await supabase
          .from("service_orders")
          .update(orderUpdate)
          .eq("id", assignment.order_id)
          .eq("status", "in_progress")
          .select("*")
          .single();

      if (orderCompleteError || !completedOrder) {
        app.log.error(orderCompleteError);

        /*
         * Order tamamlanmadısa assignment-i əvvəlki vəziyyətinə qaytarırıq.
         */
        await supabase
          .from("service_order_assignments")
          .update({
            status: "accepted",
            completed_at: null,
          })
          .eq("id", params.assignmentId)
          .eq("status", "completed");

        return reply.code(409).send({
          error:
            "Service order could not be completed",
        });
      }

      return reply.send({
        message: "Service order completed successfully",
        order: completedOrder,
        assignment: completedAssignment,
      });
    },
  );

  /*
   * =====================================================
   * PATCH /service-orders/:orderId/cancel
   * Sifarişin təhlükəsiz ləğvi
   * =====================================================
   */
 app.patch(
  "/service-orders/:orderId/cancel",
  {
    preHandler: requireAuth,
  },
  async (request, reply) => {
     const params = request.params as {
  orderId?: string;
};

const authenticatedRequest = request as AuthenticatedRequest;

      if (!params.orderId) {
        return reply.code(400).send({
          error: "orderId is required",
        });
      }

      const { data: order, error: orderError } =
        await supabase
          .from("service_orders")
          .select("*")
          .eq("id", params.orderId)
          .single();

     if (orderError || !order) {
  return reply.code(404).send({
    error: "Service order not found",
  });
}

if (order.customer_id !== authenticatedRequest.user.id) {
  return reply.code(403).send({
    error: "You are not allowed to cancel this service order",
  });
}

      if (order.status === "completed") {
        return reply.code(409).send({
          error:
            "Completed service orders cannot be cancelled",
        });
      }

      if (order.status === "cancelled") {
        return reply.code(409).send({
          error:
            "Service order is already cancelled",
        });
      }

      const { data: cancelledOrder, error: cancelError } =
        await supabase
          .from("service_orders")
          .update({
            status: "cancelled",
          })
          .eq("id", params.orderId)
          .not("status", "in", "(completed,cancelled)")
          .select("*")
          .single();

      if (cancelError || !cancelledOrder) {
        app.log.error(cancelError);

        return reply.code(409).send({
          error:
            "Service order could not be cancelled",
        });
      }

      /*
       * Açıq assignment-ləri də ləğv edirik.
       */
      const { error: assignmentCancelError } =
        await supabase
          .from("service_order_assignments")
          .update({
            status: "cancelled",
          })
          .eq("order_id", params.orderId)
          .in("status", ["offered", "accepted"]);

      if (assignmentCancelError) {
        app.log.error(assignmentCancelError);

        return reply.code(500).send({
          error:
            "Service order cancelled, but assignments could not be fully cancelled",
          order: cancelledOrder,
        });
      }

      return reply.send({
        message: "Service order cancelled successfully",
        order: cancelledOrder,
      });
    },
  );
}
