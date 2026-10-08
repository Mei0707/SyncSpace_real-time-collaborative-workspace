import { expect, test } from "@playwright/test";

test("syncs edits between two browser sessions", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  const marker = `sync smoke ${Date.now()}`;

  await first.goto("/");
  await first.getByRole("button", { name: "Sign in" }).last().click();
  await expect(first.getByRole("heading", { name: "SyncSpace Product" })).toBeVisible();

  await second.goto("/");
  await second.getByRole("button", { name: "Sign in" }).last().click();
  await expect(second.getByRole("heading", { name: "SyncSpace Product" })).toBeVisible();

  await first.goto("/documents/doc-roadmap");
  await second.goto("/documents/doc-roadmap");

  await expect(first.getByText("Editor synced")).toBeVisible();
  await expect(second.getByText("Editor synced")).toBeVisible();

  await first.getByTestId("collaborative-editor").click();
  await first.keyboard.type(` ${marker}`);

  await expect(second.getByTestId("collaborative-editor")).toContainText(marker);

  await firstContext.close();
  await secondContext.close();
});
