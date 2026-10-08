import { expect, test } from "@playwright/test";

test("owner invites, updates, and removes a workspace member", async ({
  page,
  request,
}) => {
  const email = `member-${Date.now()}@syncspace.local`;

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.getByRole("heading", { name: "SyncSpace Product" })).toBeVisible();

  await page.getByRole("link", { name: "Team" }).click();
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

  await page.getByLabel("Invite by email").fill(email);
  await page.getByLabel("Invite role").selectOption("viewer");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(
    page.getByTestId("invitation-row").filter({ hasText: email }),
  ).toContainText("pending");

  const register = await request.post("/api/auth/register", {
    data: { name: "Invited Member", email, password: "password" },
  });
  expect(register.ok()).toBeTruthy();

  await page.reload();
  const memberRow = page.getByTestId("member-row").filter({ hasText: email });
  await expect(memberRow).toContainText("viewer");

  await memberRow.getByLabel("Change Invited Member role").selectOption("editor");
  await expect(memberRow).toContainText("editor");

  await memberRow.getByRole("button", { name: "Remove" }).click();
  await expect(memberRow).toHaveCount(0);
});
