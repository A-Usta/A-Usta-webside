import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentMethod = "card" | "cash";
export type PaymentReadiness = {
  enabled: false;
  provider: null;
  reason: "provider_not_configured" | "split_settlement_not_verified";
};

/** No provider has been selected or contracted, so readiness deliberately fails closed. */
export function paymentReadiness(env: NodeJS.ProcessEnv = process.env): PaymentReadiness {
  const configured = Boolean(env.AUSTA_PAYMENT_PROVIDER && env.AUSTA_PAYMENT_WEBHOOK_SECRET);
  return {
    enabled: false,
    provider: null,
    reason: configured ? "split_settlement_not_verified" : "provider_not_configured",
  };
}

/** Verify a provider signature over the exact raw request bytes before parsing JSON. */
export function verifyWebhookHmacSha256(rawBody: Uint8Array, suppliedHex: string, secret: string): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
