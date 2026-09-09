import { data } from "react-router";

// The error envelope from kurobb-design.md §06, reimplemented against React
// Router's actual convention: throw/return `data(payload, { status })` from a
// loader or action and let it propagate to the route's ErrorBoundary. This is
// NOT a centralized Express error middleware — `createRequestHandler` from
// @react-router/express handles the request/response lifecycle itself, so a
// generic `app.use((err, req, res, next) => ...)` never sees these. Status
// codes match decisions already made elsewhere in kurobb-design.md: 401
// unauthenticated, 403 a deny-overrides-allow permission failure (§05), 404
// missing resource, 409 duplicate username/email on register, 400 a Zod
// validation failure, 500 everything unexpected.
export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export interface AppErrorDetail {
  field: string;
  issue: string;
}

export interface AppErrorBody {
  error: {
    code: AppErrorCode;
    message: string;
    details?: AppErrorDetail[];
  };
}

/**
 * Throw from a service, loader, or action. Never catch-and-reformat this —
 * let it propagate to the route's ErrorBoundary.
 */
export function throwAppError(
  code: AppErrorCode,
  message: string,
  details?: AppErrorDetail[],
): never {
  const body: AppErrorBody = { error: { code, message, details } };
  throw data(body, { status: STATUS_BY_CODE[code] });
}
