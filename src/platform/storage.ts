import { createInitial, dateKey, type State } from '../lib/tracker';
import { stateSchema } from '../lib/validation';
import { refreshStarterLabels } from '../lib/migrations';
export interface TrackerStorage {
  offline: boolean;
  load(): Promise<{ state: State; revision: number }>;
  save(state: State, revision: number): Promise<{ revision: number }>;
  exportFile?(name: string, content: string, type: string): void;
}
declare global {
  interface Window {
    Momentum?: { read(): string; write(document: string, revision: number): string; exportFile(name: string, content: string, type: string): void; closeApp(): void };
  }
}
function native() {
  if (!window.Momentum) throw new Error('Open Momentum from the installed Android app.');
  return window.Momentum;
}
function decode(raw: string) {
  const result = JSON.parse(raw);
  if (result.error) throw new Error(result.error);
  return result;
}
export const phoneStorage: TrackerStorage = {
  offline: true,
  async load() {
    const record = decode(native().read());
    if (record.state === null) {
      const state = createInitial(dateKey());
      const saved = await this.save(state, 0);
      return { state, revision: saved.revision };
    }
    // Never replace an unreadable database with a blank tracker.
    const original = stateSchema.parse(record.state);
    const state = refreshStarterLabels(original);
    const revision = state === original ? record.revision : (await this.save(state, record.revision)).revision;
    return { state, revision };
  },
  async save(state, revision) {
    const validated = stateSchema.parse(state);
    const document = JSON.stringify(validated);
    if (document.length > 2000000) throw new Error('Your tracker exceeds the 2 MB limit. Export a backup before making changes.');
    return decode(native().write(document, revision));
  },
  exportFile(name, content, type) { native().exportFile(name, content, type); }
};
