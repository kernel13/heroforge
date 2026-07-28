/**
 * The HTTP client.
 *
 * Errors arrive as RFC 7807 `application/problem+json`, so they are unwrapped once here rather
 * than at every call site. The 409 from a stale `version` is given its own type: the sheet has to
 * tell "someone else saved this" apart from "the network is down".
 */
import type {
  CharacterPatch,
  CharacterPortrait,
  CharacterSummary,
  CharacterWithDerived,
  DerivedSheet,
  Problem,
  SkillDefinition,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;

  constructor(status: number, problem: Problem | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  /** Someone else saved this character since we loaded it. */
  get isVersionConflict(): boolean {
    return this.status === 409;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

/**
 * The `ApiError` a failed response carries.
 *
 * Split out of `request` because the portrait upload cannot go through it — it sends a `Blob`
 * under the image's own `Content-Type` — and an upload that failed should still fail in the one
 * shape the rest of the client throws.
 */
async function problemFrom(response: Response): Promise<ApiError> {
  let problem: Problem | null = null;
  try {
    problem = (await response.json()) as Problem;
  } catch {
    problem = null;
  }
  return new ApiError(
    response.status,
    problem,
    problem?.detail ?? problem?.title ?? response.statusText,
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: init.body ? { "Content-Type": "application/json" } : {},
    ...init,
  });

  if (!response.ok) throw await problemFrom(response);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  };
}

export const api = {
  register: (email: string, password: string) =>
    request<unknown>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  verify: (token: string) =>
    request<unknown>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  login: (email: string, password: string) =>
    request<void>("/api/auth/login", form({ username: email, password })),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<void>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<void>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  me: () => request<{ id: string; email: string }>("/api/users/me"),

  skills: () => request<SkillDefinition[]>("/api/skills"),

  listCharacters: () => request<CharacterSummary[]>("/api/characters"),

  createCharacter: (name: string) =>
    request<CharacterWithDerived>("/api/characters", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getCharacter: (id: string) =>
    request<CharacterWithDerived>(`/api/characters/${id}`),

  patchCharacter: (id: string, patch: CharacterPatch) =>
    request<CharacterWithDerived>(`/api/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteCharacter: (id: string) =>
    request<void>(`/api/characters/${id}`, { method: "DELETE" }),

  /**
   * The portrait, as the raw body with `Content-Type` naming the image's type.
   *
   * `request` sets `application/json` for any body it is given, so this does not go through it —
   * a `Blob` sent as JSON would be stored as a corrupt PNG rather than refused. It is also outside
   * the character's `version`: uploading a portrait must not 409 a sheet open in another tab.
   */
  uploadPortrait: async (
    id: string,
    image: Blob,
  ): Promise<CharacterPortrait> => {
    const response = await fetch(`/api/characters/${id}/portrait`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": image.type },
      body: image,
    });
    if (!response.ok) throw await problemFrom(response);
    return (await response.json()) as CharacterPortrait;
  },

  deletePortrait: (id: string) =>
    request<CharacterPortrait>(`/api/characters/${id}/portrait`, {
      method: "DELETE",
    }),

  /** Where the card points its `<img>`. Cache-busted, so a replacement is a different URL. */
  portraitUrl: (id: string, updatedAt: string) =>
    `/api/characters/${id}/portrait?v=${encodeURIComponent(updatedAt)}`,

  /** Stateless. Persists nothing; every derived number on screen comes from here. */
  derive: (body: unknown) =>
    request<DerivedSheet>("/api/derive", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
