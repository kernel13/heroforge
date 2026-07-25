/**
 * The one end-to-end test.
 *
 * Register, create a character, change Dexterity, and assert that armour class, touch AC,
 * initiative, the Reflex save, and a Dexterity-keyed skill all move together. That single
 * assertion exercises the whole stack: React state → the 250 ms debounce → `POST /api/derive`
 * → the rules engine → back onto the screen. It then waits out the separate 2 s save and
 * reloads, so persistence is covered too.
 *
 * The run sets `VERIFICATION_REQUIRED=false` so no mail server is needed; the register → verify →
 * login flow itself is covered by the API tests, which read the token from a captured mailbox.
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery-staple";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

async function value(locator: import("@playwright/test").Locator): Promise<number> {
  return Number(((await locator.textContent()) ?? "").replace("+", ""));
}

test("changing Dexterity moves every value that depends on it", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/");

  // The tab strip and the submit button share their labels, so the submit is addressed through
  // the form rather than by name.
  const submit = page.locator("form.auth__form button[type=submit]");

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await submit.click();

  // Registration returns to the sign-in form; wait for that before filling it in again.
  await expect(submit).toHaveText("Sign in");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await submit.click();

  await expect(page.getByRole("heading", { name: "Your characters" })).toBeVisible();

  await page.getByLabel("New character").fill("Bramwell");
  await page.getByRole("button", { name: "Create" }).click();

  const armorClass = page.getByLabel("Armour class");
  const touch = page.getByLabel("Touch");
  const initiative = page.getByLabel("Initiative", { exact: true });
  const reflex = page.getByLabel("Reflex total");
  const hide = page.getByLabel("Hide total");

  await expect(armorClass).toBeVisible();

  const before = {
    ac: await value(armorClass),
    touch: await value(touch),
    initiative: await value(initiative),
    reflex: await value(reflex),
    hide: await value(hide),
  };

  // Dexterity 10 → 16: a +3 modifier where there was none.
  await page.getByLabel("Dexterity score").fill("16");

  await expect(armorClass).toHaveText(String(before.ac + 3));
  await expect(touch).toHaveText(String(before.touch + 3));
  await expect(initiative).toHaveText(`+${before.initiative + 3}`);
  await expect(reflex).toHaveText(`+${before.reflex + 3}`);
  await expect(hide).toHaveText(`+${before.hide + 3}`);

  // The save runs on its own two-second timer, separately from the recomputation above.
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel("Dexterity score")).toHaveValue("16");
});
