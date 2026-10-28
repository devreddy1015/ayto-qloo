// Per-run user credentials, in memory only. A credential arrives with the run
// request, is used by the write stages, and is dropped when the run finishes
// or after TTL_MS, whichever comes first. Nothing here is ever serialised.
const TTL_MS = 30 * 60 * 1000;
const store = new Map(); // runId -> { provider, key, model, expires }

export function setRunCredential(runId, credential) {
  if (!credential) return;
  store.set(runId, { ...credential, expires: Date.now() + TTL_MS });
}

export function getRunCredential(runId) {
  const c = store.get(runId);
  if (!c) return undefined;
  if (c.expires < Date.now()) {
    store.delete(runId);
    return undefined;
  }
  return { provider: c.provider, key: c.key, model: c.model };
}

export const clearRunCredential = (runId) => store.delete(runId);
export const hasRunCredential = (runId) => Boolean(getRunCredential(runId));

setInterval(() => {
  const now = Date.now();
  for (const [id, c] of store) if (c.expires < now) store.delete(id);
}, 60000).unref();
