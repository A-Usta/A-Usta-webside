import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type Category = "unexpected_internal" | "database_or_rpc" | "storage";

function errorName(error: unknown): string {
  // Do not inspect SDK messages, causes, custom names or arbitrary properties.
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof SyntaxError) return "SyntaxError";
  return error instanceof Error ? "Error" : "UnknownError";
}

function routeIdentity(request: FastifyRequest): string {
  // Registered route templates are code-owned; raw URLs/queries are not.
  return request.routeOptions?.url ?? "unmatched";
}

export const diagnosticsOptions = {
  requestIdHeader: false as const,
  genReqId: () => randomUUID(),
  logger: {
    serializers: {
      req: (request: FastifyRequest) => ({ method: request.method, url: routeIdentity(request) }),
      err: (error: unknown) => ({ type: errorName(error), message: "Diagnostic details omitted", stack: "" }),
    },
  },
};

export function logDiagnostic(request: FastifyRequest, category: Category, error: unknown, statusCode?: number) {
  // Handled routes log before sending: omit their not-yet-final HTTP status.
  // Completion logs carry the final status with the same Fastify request ID.
  request.log.error({
    event: "request_diagnostic",
    request_id: request.id,
    method: request.method,
    route: routeIdentity(request),
    ...(statusCode === undefined ? {} : { status_code: statusCode }),
    diagnostic_category: category,
    error_name: errorName(error),
  }, "Backend request diagnostic");
}

// Preserve known parser failures without reflecting parser/SDK error messages.
const parserFailures: Record<string, { status: number; error: string; message: string }> = {
  FST_ERR_CTP_BODY_TOO_LARGE: { status: 413, error: "Payload Too Large", message: "Request body is too large" },
  FST_ERR_CTP_INVALID_JSON_BODY: { status: 400, error: "Bad Request", message: "Invalid JSON body" },
  FST_ERR_CTP_EMPTY_JSON_BODY: { status: 400, error: "Bad Request", message: "JSON body is required" },
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: { status: 400, error: "Bad Request", message: "Invalid content length" },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: { status: 415, error: "Unsupported Media Type", message: "Unsupported content type" },
};

function unexpectedErrorHandler(error: Error & { code?: string; statusCode?: number }, request: FastifyRequest, reply: FastifyReply) {
  const parser = error.code && Object.hasOwn(parserFailures, error.code) ? parserFailures[error.code] : undefined;
  if (parser && error.statusCode === parser.status) {
    return reply.code(parser.status).send({ error: parser.error, message: parser.message });
  }
  logDiagnostic(request, "unexpected_internal", error, 500);
  return reply.code(500).send({
    error: "Internal Server Error",
    message: "Unexpected server error",
    request_id: request.id,
  });
}

export function installDiagnostics(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  // Preserve the default 404 wire contract without its raw-URL info log.
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    message: `Route ${request.raw.method}:${request.raw.url} not found`,
    error: "Not Found",
    statusCode: 404,
  }));
  app.setErrorHandler(unexpectedErrorHandler);
}
