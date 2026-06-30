// Consistent HTTP error handling for Route Handlers.
//
// Handlers throw `HttpError` (or a ZodError from `.parse`) and wrap their body
// in `handleRoute`, which maps everything to the canonical `{ error: string }`
// shape with the right status code. Stack traces and raw DB errors never leak
// to clients (CLAUDE.md / SPEC §4 "Error hygiene").
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorBody = { error: string };

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Convenience constructors for the statuses the spec uses.
export const badRequest = (m = "Bad request") => new HttpError(400, m);
export const unauthorized = (m = "Unauthenticated") => new HttpError(401, m);
export const forbidden = (m = "Forbidden") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m = "Conflict") => new HttpError(409, m);
export const tooManyRequests = (m = "Too many requests") => new HttpError(429, m);

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/** Parse a JSON request body, mapping malformed JSON to a 400. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

export function errorResponse(status: number, message: string) {
  return NextResponse.json<ErrorBody>({ error: message }, { status });
}

/**
 * Wrap a Route Handler body. Maps:
 *  - ZodError      -> 400 with the first issue message
 *  - HttpError     -> its status + message
 *  - anything else -> 500 with a generic message (no internals leaked)
 */
export async function handleRoute(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const path = first?.path.join(".");
      const msg = first
        ? `${path ? `${path}: ` : ""}${first.message}`
        : "Invalid request";
      return errorResponse(400, msg);
    }
    if (err instanceof HttpError) {
      return errorResponse(err.status, err.message);
    }
    // Unexpected: log server-side, return a generic message.
    console.error("[unhandled route error]", err);
    return errorResponse(500, "Internal server error");
  }
}
