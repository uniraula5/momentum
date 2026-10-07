import { z } from 'zod';
import { stateSchema } from './validation';
import type { State } from './tracker';

const ITERATIONS = 600_000;
const bytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const text = new TextEncoder();
const b64 = (value: Uint8Array) => { let s = ''; for (const n of value) s += String.fromCharCode(n); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const encoded = z.string().max(3_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const boxSchema = z.object({ iv: encoded.refine(s => unb64(s).length === 12), data: encoded.refine(s => unb64(s).length >= 16) }).strict();
const wrapSchema = z.object({ salt: encoded.refine(s => unb64(s).length === 16), box: boxSchema }).strict();
const shared = { version: z.literal(1), id: z.string().uuid(), recovery: wrapSchema, payload: boxSchema };
export const envelopeSchema = z.object({ ...shared, format: z.literal('momentum-vault'), pin: wrapSchema }).strict();
export const backupSchema = z.object({ ...shared, format: z.literal('momentum-private-backup') }).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type PrivateBackup = z.infer<typeof backupSchema>;
export type VaultSession = { key: CryptoKey; state: State; envelope: Envelope };
const pinValid = (pin: string) => { if (!/^\d{6}$/.test(pin)) throw new Error('Enter a six-digit PIN.'); };
export function normalizeRecovery(code: string) {
  const clean = code.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(clean)) throw new Error('Enter the complete recovery code.');
  return clean;
}
function privateState(value: unknown): State {
  const state = stateSchema.parse(value);
  if (state.goals.length || Object.keys(state.reviews).length) throw new Error('Invalid private habit document.');
  return state;
}
async function aes(raw: Uint8Array<ArrayBuffer>) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function derive(secret: string, salt: Uint8Array<ArrayBuffer>) {
  const source = await crypto.subtle.importKey('raw', text.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, source, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key: CryptoKey, raw: Uint8Array<ArrayBuffer>, context: string) {
  const iv = bytes(12);
  return { iv: b64(iv), data: b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: text.encode(context) }, key, raw))) };
}
async function open(key: CryptoKey, box: z.infer<typeof boxSchema>, context: string) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: text.encode(context) }, key, unb64(box.data)));
}
async function wrap(raw: Uint8Array<ArrayBuffer>, secret: string, context: string) {
  const salt = bytes(16);
  return { salt: b64(salt), box: await seal(await derive(secret, salt), raw, context) };
}
async function unwrap(wrapped: z.infer<typeof wrapSchema>, secret: string, context: string) {
  return open(await derive(secret, unb64(wrapped.salt)), wrapped.box, context);
}
export function emptyPrivateState(profile: Pick<State, 'name' | 'timezone'>): State {
  return { version: 1, name: profile.name, timezone: profile.timezone, habits: [], entries: {}, goals: [], reviews: {} };
}
export async function createVault(pin: string, state: State) {
  pinValid(pin); privateState(state);
  const raw = bytes(32), id = crypto.randomUUID();
  const recoveryCode = Array.from(bytes(32), n => n.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g)!.join('-');
  try {
    const key = await aes(raw);
    const envelope: Envelope = { version: 1, format: 'momentum-vault', id,
      pin: await wrap(raw, pin, `${id}:pin`),
      recovery: await wrap(raw, normalizeRecovery(recoveryCode), `${id}:recovery`),
      payload: await seal(key, text.encode(JSON.stringify(state)), `${id}:state`),
    };
    return { session: { key, state, envelope }, recoveryCode };
  } finally { raw.fill(0); }
}
export async function unlockVault(value: unknown, credential: string, recovery = false): Promise<VaultSession> {
  const envelope = envelopeSchema.parse(value);
  const secret = recovery ? normalizeRecovery(credential) : (pinValid(credential), credential);
  let raw: Uint8Array<ArrayBuffer> | undefined;
  try {
    raw = await unwrap(recovery ? envelope.recovery : envelope.pin, secret, `${envelope.id}:${recovery ? 'recovery' : 'pin'}`);
    const key = await aes(raw);
    const state = privateState(JSON.parse(new TextDecoder().decode(await open(key, envelope.payload, `${envelope.id}:state`))));
    return { key, state, envelope };
  } catch { throw new Error('Incorrect code or damaged private data. Nothing was changed.'); }
  finally { raw?.fill(0); }
}
export async function encryptPrivateState(session: VaultSession, state: State): Promise<Envelope> {
  const document = JSON.stringify(privateState(state));
  if (document.length > 2_000_000) throw new Error('Private habits exceed the 2 MB limit. Export a backup.');
  return { ...session.envelope, payload: await seal(session.key, text.encode(document), `${session.envelope.id}:state`) };
}
export async function changePin(value: unknown, credential: string, nextPin: string, recovery = false) {
  pinValid(nextPin);
  const session = await unlockVault(value, credential, recovery), e = session.envelope;
  const raw = await unwrap(recovery ? e.recovery : e.pin, recovery ? normalizeRecovery(credential) : credential, `${e.id}:${recovery ? 'recovery' : 'pin'}`);
  try { return { ...session, envelope: { ...e, pin: await wrap(raw, nextPin, `${e.id}:pin`) } }; }
  finally { raw.fill(0); }
}
export function exportPrivateBackup(envelope: Envelope): PrivateBackup {
  const { pin: _pin, format: _format, ...rest } = envelope;
  // A portable backup never exposes the low-entropy PIN wrapper to offline guessing.
  return { ...rest, format: 'momentum-private-backup' };
}
export async function restorePrivateBackup(value: unknown, recoveryCode: string, nextPin: string): Promise<VaultSession> {
  pinValid(nextPin);
  const backup = backupSchema.parse(value);
  const raw = await unwrap(backup.recovery, normalizeRecovery(recoveryCode), `${backup.id}:recovery`).catch(() => { throw new Error('Incorrect recovery code or damaged backup.'); });
  try {
    const key = await aes(raw);
    const state = privateState(JSON.parse(new TextDecoder().decode(await open(key, backup.payload, `${backup.id}:state`))));
    const envelope: Envelope = { ...backup, format: 'momentum-vault', pin: await wrap(raw, nextPin, `${backup.id}:pin`) };
    return { key, state, envelope };
  } finally { raw.fill(0); }
}
export function moveToPrivate(publicState: State, privateData: State, id: string) {
  const habit = publicState.habits.find(h => h.id === id);
  if (!habit || privateData.habits.some(h => h.id === id)) throw new Error('This habit cannot be moved. Reload and try again.');
  const entries = { ...publicState.entries }; delete entries[id];
  return {
    publicState: stateSchema.parse({ ...publicState, habits: publicState.habits.filter(h => h.id !== id), entries }),
    privateState: privateState({ ...privateData, habits: [...privateData.habits, habit], entries: { ...privateData.entries, [id]: publicState.entries[id] ?? {} } }),
  };
}
