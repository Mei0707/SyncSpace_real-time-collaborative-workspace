import { expect, test } from "@playwright/test";
import {
  authenticatedContext,
  createDocumentViaApi,
  createUserWithRole,
  loginViaApi,
} from "./helpers";

test("viewer cannot edit documents through UI, REST, or collaboration socket", async ({
  browser,
  request,
}) => {
  const owner = await loginViaApi(request);
  const document = await createDocumentViaApi(
    request,
    owner.token,
    `Viewer permission ${Date.now()}`,
  );
  const viewer = await createUserWithRole(request, owner.token, "viewer");
  const context = await authenticatedContext(browser, viewer.token);
  const page = await context.newPage();

  await page.goto(`/documents/${document.id}`);
  await expect(page.getByText("Viewing with read-only access.")).toBeVisible();
  await expect(page.getByText("Read-only", { exact: true })).toBeVisible();

  const forbiddenMarker = `viewer edit ${Date.now()}`;
  await page.getByTestId("collaborative-editor").click();
  await page.keyboard.type(forbiddenMarker);
  await expect(page.getByTestId("collaborative-editor")).not.toContainText(
    forbiddenMarker,
  );

  const patch = await request.patch(`/api/documents/${document.id}`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
    data: { title: "Viewer should not update this" },
  });
  expect(patch.status()).toBe(403);
  await expect(patch.json()).resolves.toEqual({
    message: "Editor access required",
  });

  const socketError = await page.evaluate(
    ({ documentId, token }) =>
      new Promise<string>((resolve, reject) => {
        const url = new URL(
          `/collaboration/${encodeURIComponent(documentId)}?token=${encodeURIComponent(token)}`,
          window.location.href,
        );
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

        const socket = new WebSocket(url);
        const timeout = window.setTimeout(() => {
          socket.close();
          reject(new Error("Timed out waiting for collaboration permission error."));
        }, 5_000);

        socket.addEventListener("open", () => {
          socket.send(new Uint8Array([0, 0]));
        });
        socket.addEventListener("message", (event) => {
          if (typeof event.data !== "string") {
            return;
          }

          const message = JSON.parse(event.data) as {
            type?: string;
            message?: string;
          };

          if (message.type === "error") {
            window.clearTimeout(timeout);
            socket.close();
            resolve(message.message ?? "");
          }
        });
        socket.addEventListener("error", () => {
          window.clearTimeout(timeout);
          reject(new Error("Collaboration socket failed before permission error."));
        });
      }),
    { documentId: document.id, token: viewer.token },
  );

  expect(socketError).toBe("Editor access required");
  await context.close();
});
