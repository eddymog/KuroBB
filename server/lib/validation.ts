import type { z } from "zod";

import { throwAppError } from "./errors";

/**
 * Parse form data against a Zod schema, or throw a VALIDATION_ERROR (§06)
 * whose `details` map field-by-field onto the request — call this at the
 * top of an action, before touching a service.
 *
 * Accepts a `Request` (the common case) or an already-read `FormData` — a
 * Request's body can only be read once, so any action that needs to branch
 * on a field (e.g. an `_action` discriminator) before validating must call
 * `request.formData()` itself first and pass the result here, not the
 * Request a second time. Two admin routes hit exactly this as a real bug
 * ("Body is unusable: Body has already been read") before this overload
 * existed.
 */
export async function parseFormData<Schema extends z.ZodType>(
  requestOrFormData: Request | FormData,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const formData =
    requestOrFormData instanceof FormData
      ? requestOrFormData
      : await requestOrFormData.formData();
  const result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    throwAppError(
      "VALIDATION_ERROR",
      "One or more fields are invalid.",
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      })),
    );
  }

  return result.data;
}

export type FieldErrors = Record<string, string>;

/**
 * Like `parseFormData`, but returns a result instead of throwing — for
 * actions that need per-field errors to actually reach a `Field`'s error
 * slot (frontend-design-implementation.md Step 4's "write forms" group),
 * rather than bubbling to the root ErrorBoundary with no per-field display
 * at all. A deliberate sibling to `parseFormData`, not a replacement for
 * it — most actions (register, login, admin, replies) don't render
 * per-field errors and are better served by the throw-and-let-the-boundary-
 * handle-it default; only forms that actually show `Field`'s error prop
 * need this one.
 */
export async function safeParseFormData<Schema extends z.ZodType>(
  requestOrFormData: Request | FormData,
  schema: Schema,
): Promise<{ success: true; data: z.infer<Schema> } | { success: false; fieldErrors: FieldErrors }> {
  const formData =
    requestOrFormData instanceof FormData
      ? requestOrFormData
      : await requestOrFormData.formData();
  const result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message; // first error per field wins
    }
    return { success: false, fieldErrors };
  }

  return { success: true, data: result.data };
}
