import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { installAdmission, admitActor } from "../diagnostics/admission.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const API_ROOT = "https://places.googleapis.com/v1/places";
const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location",
  "places.types", "places.primaryType", "places.nationalPhoneNumber", "places.regularOpeningHours.weekdayDescriptions",
  "places.rating", "places.userRatingCount",
].join(",");
const MAX_RADIUS_KM = 50;
const MAX_RESULTS = 20;
const EARTH_RADIUS_KM = 6371;

type CategorySpec =
  | { method: "nearby"; includedTypes: string[]; allowedTypes: string[] }
  | { method: "text"; textQuery: string; allowedTypes: string[] };

// Queries are code-owned and fixed. Client input can select only these keys,
// so it cannot turn this endpoint into a general-purpose paid search proxy.
const CATEGORIES: Record<string, CategorySpec> = {
  all: { method: "nearby", includedTypes: ["gas_station", "electric_vehicle_charging_station", "car_repair", "car_wash", "tire_shop", "parking", "parking_garage", "parking_lot", "auto_parts_store"], allowedTypes: ["gas_station", "electric_vehicle_charging_station", "car_repair", "car_wash", "tire_shop", "parking", "parking_garage", "parking_lot", "auto_parts_store"] },
  fuel: { method: "nearby", includedTypes: ["gas_station"], allowedTypes: ["gas_station"] },
  charging: { method: "nearby", includedTypes: ["electric_vehicle_charging_station"], allowedTypes: ["electric_vehicle_charging_station"] },
  service: { method: "nearby", includedTypes: ["car_repair"], allowedTypes: ["car_repair"] },
  tyre: { method: "nearby", includedTypes: ["tire_shop"], allowedTypes: ["tire_shop"] },
  wash: { method: "nearby", includedTypes: ["car_wash"], allowedTypes: ["car_wash"] },
  parts_shop: { method: "nearby", includedTypes: ["auto_parts_store"], allowedTypes: ["auto_parts_store"] },
  auto_electrician: { method: "text", textQuery: "automotive electrician", allowedTypes: ["car_repair"] },
  oil_change: { method: "text", textQuery: "automotive oil change service", allowedTypes: ["car_repair"] },
  diagnostics: { method: "text", textQuery: "automotive diagnostic service", allowedTypes: ["car_repair"] },
  inspection: { method: "text", textQuery: "vehicle technical inspection station", allowedTypes: ["car_repair"] },
  towing: { method: "text", textQuery: "vehicle towing service", allowedTypes: ["car_repair"] },
  parking: { method: "nearby", includedTypes: ["parking", "parking_garage", "parking_lot"], allowedTypes: ["parking", "parking_garage", "parking_lot"] },
  repair: { method: "nearby", includedTypes: ["car_repair"], allowedTypes: ["car_repair"] },
  alignment: { method: "text", textQuery: "vehicle wheel alignment service", allowedTypes: ["car_repair"] },
  other_auto: { method: "text", textQuery: "automotive services and repair", allowedTypes: ["car_repair"] },
  usta: { method: "nearby", includedTypes: ["car_repair"], allowedTypes: ["car_repair"] },
};

type SearchBody = { category?: unknown; latitude?: unknown; longitude?: unknown; radiusKm?: unknown };
type PlaceRecord = {
  id?: unknown;
  displayName?: { text?: unknown };
  formattedAddress?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  types?: unknown;
  primaryType?: unknown;
  nationalPhoneNumber?: unknown;
  regularOpeningHours?: { weekdayDescriptions?: unknown };
  rating?: unknown;
  userRatingCount?: unknown;
};

export type PlacesFetch = typeof fetch;
export type GooglePlacesRouteOptions = { apiKey?: string; fetchImpl?: PlacesFetch };

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (x: number) => x * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

function requestFor(spec: CategorySpec, latitude: number, longitude: number, radiusKm: number) {
  const circle = { center: { latitude, longitude }, radius: Math.min(radiusKm * 1000, 50_000) };
  if (spec.method === "nearby") return {
    url: `${API_ROOT}:searchNearby`,
    body: { includedTypes: spec.includedTypes, maxResultCount: MAX_RESULTS, rankPreference: "DISTANCE", languageCode: "az", regionCode: "AZ", locationRestriction: { circle } },
  };
  return {
    url: `${API_ROOT}:searchText`,
    body: { textQuery: spec.textQuery, maxResultCount: MAX_RESULTS, rankPreference: "DISTANCE", languageCode: "az", regionCode: "AZ", locationBias: { circle } },
  };
}

export async function registerGooglePlacesRoutes(app: FastifyInstance, options: GooglePlacesRouteOptions = {}) {
  installAdmission(app);
  const apiKey = options.apiKey ?? env.googlePlacesApiKey;
  const fetchImpl = options.fetchImpl ?? fetch;
  app.post<{ Body: SearchBody }>("/places/nearby-search", { preHandler: requireAuth }, async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const body = request.body ?? {};
    const category = typeof body.category === "string" ? body.category : "";
    if (Object.keys(body).some(key => !["category", "latitude", "longitude", "radiusKm"].includes(key)) ||
        !Object.hasOwn(CATEGORIES, category) || !finiteIn(body.latitude, -90, 90) ||
        !finiteIn(body.longitude, -180, 180) || !finiteIn(body.radiusKm, 1, MAX_RADIUS_KM)) {
      return reply.code(400).send({ error: "Yanlış məntəqə axtarışı parametrləri.", code: "INVALID_SEARCH" });
    }
    const user = (request as AuthenticatedRequest).user;
    if (!admitActor(app, request, reply, "places", user.id)) return;
    if (!apiKey) return reply.code(503).send({ error: "Xarici məntəqə axtarışı TEST serverində konfiqurasiya edilməyib.", code: "PLACES_NOT_CONFIGURED" });

    const spec = CATEGORIES[category];
    const center = { latitude: body.latitude as number, longitude: body.longitude as number };
    const radiusKm = body.radiusKm as number;
    const requests = [requestFor(spec, center.latitude, center.longitude, radiusKm)];
    let responses: Response[];
    try {
      responses = await Promise.all(requests.map(upstream => fetchImpl(upstream.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify(upstream.body),
        signal: AbortSignal.timeout(9_000),
      })));
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return reply.code(timedOut ? 504 : 502).send({
        error: timedOut ? "Məntəqə axtarışının vaxtı bitdi. Yenidən cəhd edin." : "Məntəqələr xidməti ilə əlaqə qurulmadı.",
        code: timedOut ? "PLACES_TIMEOUT" : "PLACES_NETWORK_ERROR",
      });
    }
    const failedResponse = responses.find(response => !response.ok);
    if (failedResponse) {
      // Inspect only enough of the upstream error in memory to classify a
      // deployment/configuration failure. Never log or return upstream text.
      let failureCode = "PLACES_UPSTREAM_ERROR";
      if (failedResponse.status === 403) {
        try {
          const upstreamError = await failedResponse.json() as { error?: { message?: unknown; status?: unknown } };
          const message = typeof upstreamError.error?.message === "string" ? upstreamError.error.message.toLowerCase() : "";
          const status = typeof upstreamError.error?.status === "string" ? upstreamError.error.status.toUpperCase() : "";
          if (/billing|billing account|billing must be enabled/.test(message)) failureCode = "PLACES_BILLING_REQUIRED";
          else if (/ip address|ipaddresses|source ip/.test(message)) failureCode = "PLACES_IP_RESTRICTION";
          else if (/api.*(disabled|not enabled|not authorized)|permission denied/.test(message) || status === "PERMISSION_DENIED") failureCode = "PLACES_API_PERMISSION";
        } catch { /* Keep the generic upstream result for a non-JSON response. */ }
      }
      return reply.code(failedResponse.status === 429 ? 429 : 502).send({
        error: failedResponse.status === 429 ? "Məntəqə axtarış limiti doldu. Bir az sonra yenidən cəhd edin."
          : failureCode === "PLACES_BILLING_REQUIRED" ? "Google Places TEST layihəsində billing aktiv deyil və ya sorğu üçün tələb olunur."
          : failureCode === "PLACES_IP_RESTRICTION" ? "TEST serverinin çıxış IP-si Google Places açarının icazə siyahısına uyğun deyil."
          : failureCode === "PLACES_API_PERMISSION" ? "Places API (New) və ya açar icazələri Google Cloud TEST layihəsində yoxlanmalıdır."
          : "Google Places axtarışı hazırda əlçatan deyil.",
        code: failedResponse.status === 429 ? "PLACES_RATE_LIMITED" : failureCode,
      });
    }
    let records: unknown[] = [];
    try {
      for (const response of responses) {
        const payload = await response.json() as { places?: unknown };
        if (payload.places !== undefined && !Array.isArray(payload.places)) throw new Error("invalid");
        if (Array.isArray(payload.places)) records.push(...payload.places);
      }
    }
    catch { return reply.code(502).send({ error: "Məntəqə xidmətindən düzgün cavab alınmadı.", code: "PLACES_INVALID_RESPONSE" }); }
    const seen = new Set<string>();
    const places = records.slice(0, MAX_RESULTS * requests.length)
      .filter((place): place is PlaceRecord => !!place && typeof place === "object")
      .flatMap(place => {
        const id = stringOrNull(place.id), name = stringOrNull(place.displayName?.text);
        const latitude = place.location?.latitude, longitude = place.location?.longitude;
        if (!id || !name || !finiteIn(latitude, -90, 90) || !finiteIn(longitude, -180, 180) || seen.has(id)) return [];
        const types = Array.isArray(place.types) ? place.types.filter((item): item is string => typeof item === "string") : [];
        const primaryType = stringOrNull(place.primaryType);
        if (primaryType && !types.includes(primaryType)) types.unshift(primaryType);
        if (!types.some(type => spec.allowedTypes.includes(type))) return [];
        const distance = distanceKm(center, { latitude, longitude });
        if (distance > radiusKm) return [];
        seen.add(id);
        const hours = place.regularOpeningHours?.weekdayDescriptions;
        return [{
          id, name, address: stringOrNull(place.formattedAddress), latitude, longitude,
          types: types.slice(0, 20),
          phone: stringOrNull(place.nationalPhoneNumber),
          opening_hours: Array.isArray(hours) ? hours.filter((item): item is string => typeof item === "string").slice(0, 7) : [],
          rating: finiteIn(place.rating, 0, 5) ? place.rating : null,
          user_rating_count: finiteIn(place.userRatingCount, 0, 10_000_000) ? place.userRatingCount : null,
          distance_km: Math.round(distance * 10) / 10,
          source: "google_places" as const,
          attribution: "Google Maps",
        }];
      });
    return reply.send({ places, source: "google_places", attribution: places.length ? "Google Maps" : null, returned: places.length });
  });
}

export async function googlePlacesRoutes(app: FastifyInstance) {
  await registerGooglePlacesRoutes(app);
}
