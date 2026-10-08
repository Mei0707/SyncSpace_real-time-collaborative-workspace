import { expect, test } from "@playwright/test";
import {
  authenticatedContext,
  createDocumentViaApi,
  loginViaApi,
} from "./helpers";

test("syncs simultaneous edits between two browser sessions", async ({
  browser,
  request,
}) => {
  const { token } = await loginViaApi(request);
  const document = await createDocumentViaApi(
    request,
    token,
    `Simultaneous editing ${Date.now()}`,
  );
  const firstContext = await authenticatedContext(browser, token);
  const secondContext = await authenticatedContext(browser, token);
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  const firstMarker = `first edit ${Date.now()}`;
  const secondMarker = `second edit ${Date.now()}`;

  await first.goto(`/documents/${document.id}`);
  await second.goto(`/documents/${document.id}`);

  await expect(first.getByText("Editor synced")).toBeVisible();
  await expect(second.getByText("Editor synced")).toBeVisible();

  await first.getByTestId("collaborative-editor").click();
  await first.keyboard.type(firstMarker);
  await second.getByTestId("collaborative-editor").click();
  await second.keyboard.type(` ${secondMarker}`);

  await expect(first.getByTestId("collaborative-editor")).toContainText(secondMarker);
  await expect(second.getByTestId("collaborative-editor")).toContainText(firstMarker);

  await firstContext.close();
  await secondContext.close();
});

test("merges offline edits with remote edits after reconnection", async ({
  browser,
  request,
}) => {
  const { token } = await loginViaApi(request);
  const document = await createDocumentViaApi(
    request,
    token,
    `Reconnect editing ${Date.now()}`,
  );
  const offlineContext = await authenticatedContext(browser, token);
  const onlineContext = await authenticatedContext(browser, token);
  const offlinePage = await offlineContext.newPage();
  const onlinePage = await onlineContext.newPage();
  const offlineMarker = `offline edit ${Date.now()}`;
  const onlineMarker = `online edit ${Date.now()}`;

  await offlinePage.goto(`/documents/${document.id}`);
  await onlinePage.goto(`/documents/${document.id}`);
  await expect(offlinePage.getByText("Editor synced")).toBeVisible();
  await expect(onlinePage.getByText("Editor synced")).toBeVisible();

  await offlineContext.setOffline(true);
  await offlinePage.getByTestId("collaborative-editor").click();
  await offlinePage.keyboard.type(offlineMarker);

  await onlinePage.getByTestId("collaborative-editor").click();
  await onlinePage.keyboard.type(` ${onlineMarker}`);
  await expect(onlinePage.getByTestId("collaborative-editor")).toContainText(
    onlineMarker,
  );

  await offlineContext.setOffline(false);
  await expect(offlinePage.getByText("Editor synced")).toBeVisible();
  await expect(offlinePage.getByTestId("collaborative-editor")).toContainText(
    onlineMarker,
  );
  await expect(onlinePage.getByTestId("collaborative-editor")).toContainText(
    offlineMarker,
  );

  await offlineContext.close();
  await onlineContext.close();
});
