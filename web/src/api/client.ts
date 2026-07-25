/**
 * The HTTP client.
 *
 * Errors arrive as RFC 7807 `application/problem+json`, so they are unwrapped once here rather
 * than at every call site. The 409 from a stale `version` is given its own type: the sheet has to
 * tell "someone else saved this" apart from "the network is down".
 */
import type {
  CharacterPatch,
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: init.body ? { "Content-Type": "application/json" } : {},
    ...init,
  });

  if (!response.ok) {
    let problem: Problem | null = null;
    try {
      problem = (await response.json()) as Problem;
    } catch {
      problem = null;
    }
    throw new ApiError(
      response.status,
      problem,
      problem?.detail ?? problem?.title ?? response.statusText,
    );
  }

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

  getCharacter: (id: string) => request<CharacterWithDerived>(`/api/characters/${id}`),

  patchCharacter: (id: string, patch: CharacterPatch) =>
    request<CharacterWithDerived>(`/api/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteCharacter: (id: string) =>
    request<void>(`/api/characters/${id}`, { method: "DELETE" }),

  /** Stateless. Persists nothing; every derived number on screen comes from here. */
  derive: (body: unknown) =>
    request<DerivedSheet>("/api/derive", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
