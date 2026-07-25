/** Sign in, sign up, email verification, and password reset. */
import { type FormEvent, useState } from "react";
import { ApiError, api } from "../api/client";

type Mode = "login" | "register" | "forgot";

interface Props {
  onSignedIn: () => void;
}

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

export function Auth({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        await api.login(email, password);
        onSignedIn();
      } else if (mode === "register") {
        await api.register(email, password);
        setNotice(
          "Check your email and follow the link to confirm your address. You can sign in once it is confirmed.",
        );
        setMode("login");
      } else {
        await api.forgotPassword(email);
        setNotice("If that address has an account, a reset link is on its way.");
        setMode("login");
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth">
      <h1>Character sheet manager</h1>
      <p className="auth__blurb">
        Keep a D&amp;D 3.5 character sheet that works out its own arithmetic — armour class, saves,
        skill totals, grapple, initiative, and encumbrance.
      </p>

      <nav className="auth__tabs">
        <button
          type="button"
          className={mode === "login" ? "tab tab--active" : "tab"}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "tab tab--active" : "tab"}
          onClick={() => setMode("register")}
        >
          Create an account
        </button>
        <button
          type="button"
          className={mode === "forgot" ? "tab tab--active" : "tab"}
          onClick={() => setMode("forgot")}
        >
          Forgot password
        </button>
      </nav>

      <form className="auth__form" onSubmit={submit}>
        <label className="field field--wide">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        {mode !== "forgot" && (
          <label className="field field--wide">
            <span className="field__label">Password</span>
            <input
              className="field__input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}

        {error !== null && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice !== null && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="button" disabled={busy}>
          {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
        </button>
      </form>
    </section>
  );
}

/** Handles the `?token=` links sent by email for verification and password reset. */
export function TokenLanding({ onDone }: { onDone: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const isReset = window.location.pathname.includes("reset-password");

  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    try {
      if (isReset) await api.resetPassword(token, password);
      else await api.verify(token);
      setState("done");
    } catch (caught) {
      setError(message(caught));
      setState("failed");
    }
  };

  if (state === "done") {
    return (
      <section className="auth">
        <h1>{isReset ? "Password changed" : "Address confirmed"}</h1>
        <button type="button" className="button" onClick={onDone}>
          Sign in
        </button>
      </section>
    );
  }

  return (
    <section className="auth">
      <h1>{isReset ? "Choose a new password" : "Confirm your address"}</h1>
      <form className="auth__form" onSubmit={run}>
        {isReset && (
          <label className="field field--wide">
            <span className="field__label">New password</span>
            <input
              className="field__input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {error !== null && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={state === "busy"}>
          {isReset ? "Set password" : "Confirm"}
        </button>
      </form>
    </section>
  );
}
