/** Sign in, sign up, email verification, and password reset. */
import { type FormEvent, useState } from "react";
import { api } from "../api/client";
import { errorKey, useT, type TranslationKey } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { FieldLabel, controlClass } from "./fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "login" | "register" | "forgot";

interface Props {
  onSignedIn: () => void;
}

/**
 * One form serves all three modes rather than one per tab: an address typed on the sign-in tab
 * should still be there after a detour through "forgot password". That is why the form sits
 * outside `Tabs` — the tab strip only chooses the mode.
 */
export function Auth({ onSignedIn }: Props) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * Held as keys, not as sentences.
   *
   * Storing the *result* of `t()` freezes the message in whichever language was on when it was
   * set, so a user who registers and then reaches for the language switch — which is exactly when
   * they would — is left reading the one line on the card that did not change.
   */
  const [error, setError] = useState<TranslationKey | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);

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
        setNotice("auth.notice.registered");
        setMode("login");
      } else {
        await api.forgotPassword(email);
        setNotice("auth.notice.reset");
        setMode("login");
      }
    } catch (caught) {
      setError(errorKey(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto my-16 w-full max-w-[27rem]">
      <CardHeader>
        {/* The switcher sits on the sign-in card as well as in the signed-in header: a French
            speaker needs it *before* they have an account, not after. */}
        <div className="flex items-start justify-between gap-3">
          <CardTitle asChild>
            <h1 className="text-xl tracking-tight">{t("app.title")}</h1>
          </CardTitle>
          <LanguageSwitcher />
        </div>
        <CardDescription>{t("auth.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)} className="mb-4">
          <TabsList variant="line" className="w-full border-b">
            <TabsTrigger value="login">{t("auth.tab.login")}</TabsTrigger>
            <TabsTrigger value="register">{t("auth.tab.register")}</TabsTrigger>
            <TabsTrigger value="forgot">{t("auth.tab.forgot")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Label className="flex flex-col items-start gap-1">
            <FieldLabel>{t("auth.email")}</FieldLabel>
            <Input
              type="email"
              className={controlClass}
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Label>

          {mode !== "forgot" && (
            <Label className="flex flex-col items-start gap-1">
              <FieldLabel>{t("auth.password")}</FieldLabel>
              <Input
                type="password"
                className={controlClass}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Label>
          )}

          {error !== null && (
            <p className="text-sm text-destructive" role="alert">
              {t(error)}
            </p>
          )}
          {notice !== null && (
            <p className="text-sm text-ok" role="status">
              {t(notice)}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {mode === "login"
              ? t("auth.submit.login")
              : mode === "register"
                ? t("auth.submit.register")
                : t("auth.submit.forgot")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Handles the `?token=` links sent by email for verification and password reset. */
export function TokenLanding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const isReset = window.location.pathname.includes("reset-password");

  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const [error, setError] = useState<TranslationKey | null>(null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    try {
      if (isReset) await api.resetPassword(token, password);
      else await api.verify(token);
      setState("done");
    } catch (caught) {
      setError(errorKey(caught));
      setState("failed");
    }
  };

  if (state === "done") {
    return (
      <Card className="mx-auto my-16 w-full max-w-[27rem]">
        <CardHeader>
          <CardTitle asChild>
            <h1 className="text-xl tracking-tight">
              {isReset ? t("auth.landing.passwordChanged") : t("auth.landing.addressConfirmed")}
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onDone}>
            {t("auth.landing.signIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto my-16 w-full max-w-[27rem]">
      <CardHeader>
        <CardTitle asChild>
          <h1 className="text-xl tracking-tight">
            {isReset ? "Choose a new password" : "Confirm your address"}
          </h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={run}>
          {isReset && (
            <Label className="flex flex-col items-start gap-1">
              <FieldLabel>{t("auth.newPassword")}</FieldLabel>
              <Input
                type="password"
                className={controlClass}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Label>
          )}
          {error !== null && (
            <p className="text-sm text-destructive" role="alert">
              {t(error)}
            </p>
          )}
          <Button type="submit" disabled={state === "busy"}>
            {isReset ? t("auth.landing.setPassword") : t("auth.landing.confirm")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
