import * as Y from "yjs";

export function createMissingYjsUpdate(
  document: Y.Doc,
  remoteStateVector: Uint8Array,
) {
  return Y.encodeStateAsUpdate(document, remoteStateVector);
}

export function isEmptyYjsUpdate(update: Uint8Array) {
  return update.byteLength === 2 && update[0] === 0 && update[1] === 0;
}
