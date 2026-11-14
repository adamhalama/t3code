import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";

import { readThreadShell } from "../../state/entities";

export function lookupThread(key: string) {
  const ref = parseScopedThreadKey(key);
  return ref === null ? null : readThreadShell(ref);
}
