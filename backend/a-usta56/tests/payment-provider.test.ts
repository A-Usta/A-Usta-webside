import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { paymentReadiness, verifyWebhookHmacSha256 } from "../src/payments/provider.js";

test("payment readiness fails closed until a contracted split-settlement adapter exists", () => {
  assert.deepEqual(paymentReadiness({} as NodeJS.ProcessEnv), { enabled: false, provider: null, reason: "provider_not_configured" });
  assert.deepEqual(paymentReadiness({ AUSTA_PAYMENT_PROVIDER: "test", AUSTA_PAYMENT_WEBHOOK_SECRET: "configured" } as NodeJS.ProcessEnv), { enabled: false, provider: null, reason: "split_settlement_not_verified" });
});

test("webhook HMAC verification authenticates exact bytes and rejects malformed signatures", () => {
  const body = Buffer.from('{"id":"evt_test","type":"payment.succeeded"}');
  const secret = "TEST_ONLY_WEBHOOK_SECRET";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhookHmacSha256(body, signature, secret), true);
  assert.equal(verifyWebhookHmacSha256(Buffer.from(body.toString() + " "), signature, secret), false);
  assert.equal(verifyWebhookHmacSha256(body, "bad", secret), false);
  assert.equal(verifyWebhookHmacSha256(body, signature, ""), false);
});
