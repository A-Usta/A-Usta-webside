// Supabase Auth Send SMS Hook adapter. Supabase generates and verifies the OTP.
// Configure the Auth hook only after Meta approves the authentication template and
// server secrets have been added to this TEST project.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function decodeSecret(value: string): Uint8Array | null {
  const raw = value.replace(/^v1,/, "").replace(/^whsec_/, "");
  try {
    const binary = atob(raw);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch { return null; }
}
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
async function validSignature(rawBody: string, headers: Headers, secret: string): Promise<boolean> {
  const id = headers.get("webhook-id") || "";
  const timestamp = headers.get("webhook-timestamp") || "";
  const supplied = headers.get("webhook-signature") || "";
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(id) || !/^\d{1,12}$/.test(timestamp)) return false;
  const epoch = Number(timestamp);
  if (!Number.isSafeInteger(epoch) || Math.abs(Math.floor(Date.now() / 1000) - epoch) > MAX_CLOCK_SKEW_SECONDS) return false;
  const keyBytes = decodeSecret(secret);
  if (!keyBytes?.length) return false;
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + "." + timestamp + "." + rawBody))));
  return supplied.split(/\s+/).some((versioned) => {
    const [version, signature] = versioned.split(",", 2);
    if (version !== "v1" || !signature || signature.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "GET") {
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "";
    const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID") || "";
    const wabaId = Deno.env.get("META_WA_WABA_ID") || "";
    const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN") || "";
    const templateName = Deno.env.get("META_WA_OTP_TEMPLATE_NAME") || "";
    const templateLanguage = Deno.env.get("META_WA_OTP_TEMPLATE_LANGUAGE") || "";
    const enabled = Deno.env.get("WHATSAPP_OTP_ENABLED") === "true" &&
      Deno.env.get("WHATSAPP_OTP_TEMPLATE_STATUS") === "APPROVED" &&
      Boolean(Deno.env.get("SEND_SMS_HOOK_SECRET")) &&
      /^v\\d+\\.\\d+$/.test(graphVersion) &&
      /^\\d{6,30}$/.test(phoneNumberId) &&
      /^\\d{6,30}$/.test(wabaId) &&
      Boolean(accessToken) &&
      /^[a-z0-9_]{3,512}$/.test(templateName) &&
      /^[a-z]{2,3}(?:_[A-Z]{2,3})?$/.test(templateLanguage);
    return json(200, { enabled });
  }
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET") || "";
  if (!secret) return json(503, { error: "whatsapp_auth_not_configured" });
  let rawBody: string;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  } catch { return json(400, { error: "invalid_request" }); }
  if (!(await validSignature(rawBody, request.headers, secret))) return json(401, { error: "invalid_signature" });
  if (Deno.env.get("WHATSAPP_OTP_ENABLED") !== "true" || Deno.env.get("WHATSAPP_OTP_TEMPLATE_STATUS") !== "APPROVED") {
    return json(503, { error: "whatsapp_auth_not_ready" });
  }
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "";
  const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID") || "";
  const wabaId = Deno.env.get("META_WA_WABA_ID") || "";
  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN") || "";
  const templateName = Deno.env.get("META_WA_OTP_TEMPLATE_NAME") || "";
  const templateLanguage = Deno.env.get("META_WA_OTP_TEMPLATE_LANGUAGE") || "";
  if (!/^v\d+\.\d+$/.test(graphVersion) || !/^\d{6,30}$/.test(phoneNumberId) || !/^\d{6,30}$/.test(wabaId) || !accessToken || !/^[a-z0-9_]{3,512}$/.test(templateName) || !/^[a-z]{2,3}(?:_[A-Z]{2,3})?$/.test(templateLanguage)) {
    return json(503, { error: "whatsapp_provider_not_configured" });
  }
  let payload: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  try { payload = JSON.parse(rawBody); } catch { return json(400, { error: "invalid_request" }); }
  const phone = typeof payload.user?.phone === "string" ? payload.user.phone : "";
  const otp = typeof payload.sms?.otp === "string" ? payload.sms.otp : "";
  if (!/^\+994\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) return json(400, { error: "invalid_auth_payload" });

  // Re-check Meta each time: deployment flags alone cannot mark a template approved.
  const templatesUrl = new URL("https://graph.facebook.com/" + graphVersion + "/" + wabaId + "/message_templates");
  templatesUrl.searchParams.set("name", templateName);
  templatesUrl.searchParams.set("status", "APPROVED");
  templatesUrl.searchParams.set("category", "AUTHENTICATION");
  templatesUrl.searchParams.set("language", templateLanguage);
  const templateCheck = await fetch(templatesUrl, {
    headers: { authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(10_000),
  });
  if (!templateCheck.ok) return json(503, { error: "whatsapp_template_status_unavailable" });
  const templateResult = await templateCheck.json() as { data?: Array<{ name?: string; language?: string; status?: string; category?: string; components?: Array<{ type?: string; buttons?: Array<{ type?: string; otp_type?: string }> }> }> };
  const approvedTemplate = templateResult.data?.some((item) =>
    item.name === templateName &&
    item.language === templateLanguage &&
    item.status === "APPROVED" &&
    item.category === "AUTHENTICATION" &&
    item.components?.some((component) =>
      component.type === "BUTTONS" &&
      component.buttons?.some((button) => button.type === "OTP" && button.otp_type === "COPY_CODE")
    )
  );
  if (!approvedTemplate) return json(503, { error: "approved_authentication_template_not_found" });

  // The generated code is sent only as a body variable and is never logged or stored.
  const response = await fetch("https://graph.facebook.com/" + graphVersion + "/" + phoneNumberId + "/messages", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone.slice(1),
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [{ type: "body", parameters: [{ type: "text", text: otp }] }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return json(502, { error: "whatsapp_delivery_failed" });
  return json(200, {});
});
