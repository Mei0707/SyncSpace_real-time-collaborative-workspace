import * as Y from "yjs";
import { createMissingYjsUpdate, isEmptyYjsUpdate } from "./yjsSync";

function textOf(document: Y.Doc) {
  return document.getText("default").toString();
}

describe("Yjs reconnection sync", () => {
  it("detects empty update diffs", () => {
    const document = new Y.Doc();
    const update = createMissingYjsUpdate(document, Y.encodeStateVector(document));

    expect(isEmptyYjsUpdate(update)).toBe(true);
  });

  it("merges offline local edits with remote edits through state-vector exchange", () => {
    const serverDocument = new Y.Doc();
    const clientDocument = new Y.Doc();

    serverDocument.getText("default").insert(0, "Start");
    Y.applyUpdate(clientDocument, Y.encodeStateAsUpdate(serverDocument));

    clientDocument.getText("default").insert(textOf(clientDocument).length, " local");
    serverDocument.getText("default").insert(textOf(serverDocument).length, " remote");

    const clientStateVector = Y.encodeStateVector(clientDocument);
    const serverMissingUpdate = createMissingYjsUpdate(
      serverDocument,
      clientStateVector,
    );
    const serverStateVector = Y.encodeStateVector(serverDocument);

    Y.applyUpdate(clientDocument, serverMissingUpdate);

    const clientMissingUpdate = createMissingYjsUpdate(
      clientDocument,
      serverStateVector,
    );
    Y.applyUpdate(serverDocument, clientMissingUpdate);

    expect(textOf(clientDocument)).toBe(textOf(serverDocument));
    expect(textOf(clientDocument)).toContain("Start");
    expect(textOf(clientDocument)).toContain("local");
    expect(textOf(clientDocument)).toContain("remote");
  });
});
