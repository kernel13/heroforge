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

  // The tab strip and the submit button share their labels, but the tabs are `role="tab"`, so
  // the only `role="button"` submit in the form is unambiguous.
  const submit = page.locator("form button[type=submit]");

  await page.getByRole("tab", { name: "Create an account" }).click();
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

  // A total is shown only for a skill with a rank in it, so put one in Hide before reading it —
  // and wait for the derive that rank triggers, or `before.hide` reads an empty column as NaN.
  await page.getByLabel("Hide ranks").fill("1");
  await expect(hide).not.toBeEmpty();

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

/**
 * Switching the interface language, against the real stack.
 *
 * What the component tests cannot cover is the half of this that is not in the dictionaries: the
 * skill names are reference data, seeded from YAML into PostgreSQL and served by
 * `GET /api/skills`, so "Discrétion" on screen is evidence the column, the migration, the seed,
 * the response schema, and the client fallback all line up. It is also the only place the choice
 * is shown to survive a reload for real, through `localStorage` rather than through a mock.
 */
test("the interface and the skill list can be read in French", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/");
  const submit = page.locator("form button[type=submit]");

  await page.getByRole("tab", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await submit.click();
  await expect(submit).toHaveText("Sign in");

  // The switcher is on the sign-in card too: a French speaker needs it before they have a session.
  await page.getByRole("button", { name: "Français" }).click();
  await expect(submit).toHaveText("Se connecter");

  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await submit.click();

  await expect(page.getByRole("heading", { name: "Vos personnages" })).toBeVisible();

  await page.getByLabel("Nouveau personnage").fill("Bramwell");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByRole("heading", { name: "Classe d'armure" })).toBeVisible();
  await expect(page.getByLabel("Classe d'armure")).toBeVisible();

  // The skill's French name comes from the `skills` table, not from a frontend dictionary. What is
  // asserted is the *accessible name*, which composes from the translated skill name — so
  // `toBeAttached` rather than `toBeVisible`: a fresh character has no ranks, and an unranked
  // skill's total column is deliberately empty and therefore has no box to be visible in.
  await expect(page.getByLabel("Total de Discrétion")).toBeAttached();
  await expect(page.getByText("Natation", { exact: true })).toBeVisible();

  // And the table is read in the French alphabet, not in the stored order — which is the English
  // one, and which read in French opens Estimation, Équilibre, Bluff, Escalade.
  const names = await page
    .locator("table tbody tr td:nth-child(2) span > span")
    .allTextContents();
  expect(names.length).toBeGreaterThan(30);
  expect(names.slice(0, 4)).toEqual([
    "Acrobaties",
    "Art de la magie",
    "Artisanat",
    "Artisanat",
  ]);
  expect(names).toEqual([...names].sort(new Intl.Collator("fr").compare));

  // The choice outlives the page, and the document says which language it is in.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Compétences" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  // And back again, without losing the sheet.
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  await expect(page.getByLabel("Hide total")).toBeAttached();

  const english = await page
    .locator("table tbody tr td:nth-child(2) span > span")
    .allTextContents();
  expect(english.slice(0, 3)).toEqual(["Appraise", "Balance", "Bluff"]);
});
