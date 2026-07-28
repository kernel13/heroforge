/**
 * Turning a failed request into something the user can read in their own language.
 *
 * The `detail` of an RFC 7807 problem document is written by the API, in English, and no component
 * literal will ever cover it — so it is not shown. What the client can say for itself is what the
 * status code means, which is the part a user can act on anyway ("wrong password", "wait a
 * moment") rather than the part that helps an operator read a log.
 */
import { ApiError } from "../api/client";
import type { TranslationKey } from "./en";

const BY_STATUS: Record<number, TranslationKey> = {
  400: "error.credentials",
  401: "error.credentials",
  403: "error.credentials",
  404: "error.notFound",
  422: "error.invalid",
  429: "error.rateLimited",
};

/** The message key for a caught error. Anything not an `ApiError` never reached the server. */
export function errorKey(error: unknown): TranslationKey {
  if (!(error instanceof ApiError)) return "error.generic";
  const known = BY_STATUS[error.status];
  if (known !== undefined) return known;
  return error.status >= 500 ? "error.server" : "error.generic";
}
