import type { Envelope } from '../lib/vault';
import type { State } from '../lib/tracker';
function native() {
  if (!window.Momentum?.vaultStatus) throw new Error('Install the updated Android app to use private habits.');
  return window.Momentum;
}
function decode<T>(raw: string): T {
  const value = JSON.parse(raw);
  if (value.error) throw new Error(value.error);
  return value;
}
export const vaultStorage = {
  status: () => decode<{ exists: boolean }>(native().vaultStatus()),
  attempt: () => decode<{ envelope: Envelope; revision: number; token: string }>(native().vaultAttempt()),
  accept: (token: string) => decode(native().vaultAccept(token)),
  commit: (envelope: Envelope, revision: number, publicState?: State, publicRevision = 0) =>
    decode<{ revision: number }>(native().vaultCommit(JSON.stringify(envelope), revision, publicState ? JSON.stringify(publicState) : null, publicRevision)),
  lock: () => window.Momentum?.vaultLock?.(),
  screen: (enabled: boolean) => window.Momentum?.privateScreen?.(enabled),
};
