import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole, Plus } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { HabitForm, Heatmap, LogForm } from './Tracker';
import { phoneStorage } from '../platform/storage';
import { vaultStorage } from '../platform/vault-storage';
import { backupSchema, changePin, createVault, emptyPrivateState, encryptPrivateState, exportPrivateBackup, moveToPrivate, restorePrivateBackup, unlockVault, type PrivateBackup, type VaultSession } from '../lib/vault';
import { dateKey, dateLabel, planAt, shiftDay, streaks, type Habit, type State } from '../lib/tracker';
import { canGoToNextWeek, nextWeekDate } from '../lib/calendar';

const IDLE_MS = 120_000;
type OpenSession = VaultSession & { revision: number };
type Setup = { session: VaultSession; recoveryCode: string };
export default function PrivateArea({ onExit }: { onExit: () => void }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [session, setSession] = useState<OpenSession | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [mode, setMode] = useState<'pin' | 'recover' | 'change'>('pin');
  const [pin, setPin] = useState(''), [confirmation, setConfirmation] = useState(''), [credential, setCredential] = useState('');
  const [recoveryCheck, setRecoveryCheck] = useState('');
  const [backup, setBackup] = useState<PrivateBackup | null>(null);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const epoch = useRef(0), operation = useRef(false), idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importGeneration = useRef(0);
  const clearCredentials = useCallback(() => { setPin(''); setConfirmation(''); setCredential(''); setRecoveryCheck(''); }, []);
  const lock = useCallback(() => {
    epoch.current++; vaultStorage.lock(); setSession(null); setSetup(null); clearCredentials(); setMode('pin'); setReplace(false); setMessage(''); setError('');
    operation.current = false; setBusy(false);
    if (idle.current) clearTimeout(idle.current);
  }, [clearCredentials]);
  const exit = () => { lock(); onExit(); };
  useEffect(() => {
    vaultStorage.screen(true); document.body.classList.add('mobile-app');
    try { setExists(vaultStorage.status().exists); } catch (e) { setError((e as Error).message); }
    const hidden = () => { if (document.hidden) lock(); };
    window.addEventListener('momentum-lock', lock); document.addEventListener('visibilitychange', hidden);
    return () => { importGeneration.current++; lock(); vaultStorage.screen(false); document.body.classList.remove('mobile-app'); window.removeEventListener('momentum-lock', lock); document.removeEventListener('visibilitychange', hidden); };
  }, [lock]);
  useEffect(() => {
    const activity = () => {
      if (idle.current) clearTimeout(idle.current);
      if (session || setup) idle.current = setTimeout(lock, IDLE_MS);
    };
    activity();
    window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity); window.addEventListener('scroll', activity, true);
    return () => { if (idle.current) clearTimeout(idle.current); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); window.removeEventListener('scroll', activity, true); };
  }, [session, setup, lock]);
  useEffect(() => {
    const back = () => { if (session || setup) lock(); else onExit(); };
    window.addEventListener('momentum-back', back);
    return () => window.removeEventListener('momentum-back', back);
  }, [session, setup, lock, onExit]);
  useEffect(() => {
    const exported = (event: Event) => { const result = (event as CustomEvent).detail; if (result.saved) setMessage('Encrypted backup saved.'); else if (result.error) setError(result.error); };
    window.addEventListener('momentum-export', exported); return () => window.removeEventListener('momentum-export', exported);
  }, []);
  async function run(action: (current: () => boolean) => Promise<void>) {
    if (operation.current) return;
    const generation = epoch.current; operation.current = true; setBusy(true); setError(''); setMessage('');
    const current = () => epoch.current === generation;
    try { await action(current); }
    catch (e) { if (current()) setError(e instanceof Error ? e.message : 'Unable to complete this action. Nothing was replaced.'); }
    finally { if (current()) { operation.current = false; setBusy(false); } }
  }
  function checkPin() {
    if (!/^\d{6}$/.test(pin)) throw new Error('Choose a six-digit PIN.');
    if (pin !== confirmation) throw new Error('The PINs do not match.');
  }
  async function submit() {
    await run(async current => {
      if (!exists && backup) {
        checkPin(); const restored = await restorePrivateBackup(backup, credential, pin);
        if (!current()) return;
        const result = vaultStorage.commit(restored.envelope, 0);
        setSession({ ...restored, ...result }); setExists(true); setBackup(null); clearCredentials(); return;
      }
      if (!exists) {
        checkPin(); const publicData = await phoneStorage.load();
        const prepared = await createVault(pin, emptyPrivateState(publicData.state));
        if (current()) { setSetup(prepared); clearCredentials(); } return;
      }
      if (mode !== 'pin') checkPin();
      const record = vaultStorage.attempt();
      const unlocked = mode === 'pin' ? await unlockVault(record.envelope, pin) : await changePin(record.envelope, credential, pin, mode === 'recover');
      if (!current()) return;
      vaultStorage.accept(record.token);
      const revision = mode === 'pin' ? record.revision : vaultStorage.commit(unlocked.envelope, record.revision).revision;
      setSession({ ...unlocked, revision }); clearCredentials(); setMode('pin');
    });
  }
  async function save(next: State, publicState?: State, publicRevision?: number) {
    if (!session || operation.current) return false;
    let saved = false;
    await run(async current => {
      const envelope = await encryptPrivateState(session, next);
      if (!current()) return;
      const result = vaultStorage.commit(envelope, session.revision, publicState, publicRevision);
      setSession({ ...session, state: next, envelope, ...result }); saved = true;
    });
    return saved;
  }
  const resetMode = (next: typeof mode) => { clearCredentials(); setError(''); setMode(next); };
  const pinFields = <>
    <label>{exists && mode === 'pin' && !session ? 'PIN' : 'New six-digit PIN'}<input aria-label="PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required /></label>
    {(!exists || mode !== 'pin' || (session && backup)) && <label>Confirm PIN<input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, ''))} required /></label>}
  </>;
  return <div className="private-area">
    <header className="private-header"><button className="text-button" onClick={exit}><ChevronLeft size={18} /> Back</button><span><LockKeyhole size={18} /> Private habits</span>{session && <button className="text-button" onClick={lock}>Lock</button>}</header>
    <main className="private-main">
      {error && <p role="alert" className="private-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {setup ? <section className="panel private-gate">
        <h1>Save your recovery code</h1><p>Write this down somewhere outside this phone. It unlocks encrypted backups and lets you reset a forgotten PIN. It is shown only now.</p>
        <code className="recovery-code">{setup.recoveryCode}</code>
        <p>If you lose both the PIN and recovery code, private records cannot be recovered.</p>
        <label>Enter the last four characters to confirm you saved it<input autoComplete="off" maxLength={4} value={recoveryCheck} onChange={e => setRecoveryCheck(e.target.value.toUpperCase())} /></label>
        <button className="primary" disabled={busy || recoveryCheck !== setup.recoveryCode.slice(-4)} onClick={() => void run(async current => {
          if (!current()) return; const result = vaultStorage.commit(setup.session.envelope, 0); setSession({ ...setup.session, ...result }); setExists(true); setSetup(null); clearCredentials();
        })}>Finish setup</button><button className="text-button" disabled={busy} onClick={lock}>Cancel setup</button>
      </section> : !session ? <section className="panel private-gate">
        <h1>{exists === null ? 'Private habits' : !exists ? backup ? 'Restore private backup' : 'Set up private habits' : mode === 'recover' ? 'Recover access' : mode === 'change' ? 'Change PIN' : 'Enter your PIN'}</h1>
        <p>{!exists ? 'Private habits stay separate from your public tracker. The area locks when you leave the app or after two minutes without activity.' : 'Unlock to view and update your private habits.'}</p>
        {exists !== null && <form onSubmit={e => { e.preventDefault(); void submit(); }}>
          {(mode !== 'pin' || (!exists && backup)) && <label>{mode === 'change' ? 'Current PIN' : 'Recovery code'}<input type="password" autoComplete="off" value={credential} onChange={e => setCredential(e.target.value)} required /></label>}
          {pinFields}<button className="primary" disabled={busy}>{busy ? 'Working…' : exists ? mode === 'pin' ? 'Unlock' : 'Set PIN and unlock' : backup ? 'Restore encrypted backup' : 'Create private area'}</button>
        </form>}
        {exists && <div className="button-row"><button className="text-button" disabled={busy} onClick={() => resetMode(mode === 'pin' ? 'recover' : 'pin')}>{mode === 'pin' ? 'Forgot PIN?' : 'Use PIN'}</button><button className="text-button" disabled={busy} onClick={() => resetMode('change')}>Change PIN</button></div>}
        {backup && exists && <p>Unlock your current private area first to review this backup replacement.</p>}
      </section> : <>
        {backup && <section className="panel private-gate"><h2>Restore selected backup</h2><p>This replaces all current private habits. Public habits are unaffected. Export your current private backup first if you need to keep it.</p>
          <form onSubmit={e => { e.preventDefault(); void run(async current => { checkPin(); if (!replace) throw new Error('Confirm replacement first.'); const restored = await restorePrivateBackup(backup, credential, pin); if (!current()) return; const result = vaultStorage.commit(restored.envelope, session.revision); setSession({ ...restored, ...result }); setBackup(null); setReplace(false); clearCredentials(); }); }}>
            <label>Backup recovery code<input type="password" autoComplete="off" value={credential} onChange={e => setCredential(e.target.value)} required /></label>{pinFields}
            <label className="private-check"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Replace my current private habits</label>
            <button className="primary" disabled={busy || !replace}>Restore private backup</button>
          </form><button className="text-button" disabled={busy} onClick={() => { setBackup(null); clearCredentials(); }}>Cancel restore</button>
        </section>}
        <PrivateWorkspace key={session.envelope.id} data={session.state} busy={busy} save={save} />
        <section className="panel private-gate"><h2>Private backup</h2><p>Ordinary exports contain public habits only. This encrypted backup requires your recovery code. Opening the file picker locks this area.</p>
          <button className="primary" disabled={busy} onClick={() => { const file = JSON.stringify(exportPrivateBackup(session.envelope)); phoneStorage.exportFile?.(`momentum-private-${dateKey()}.json`, file, 'application/json'); }}>Export encrypted backup</button>
        </section>
      </>}
      {!setup && <section className="private-import"><label className="text-button">Choose encrypted private backup<input type="file" accept=".json,application/json" disabled={busy} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        // The Android picker backgrounds the app. Keep only ciphertext across that lock,
        // and cancel the import if this screen closes or a newer file is selected.
        const generation = ++importGeneration.current;
        void (async () => {
          try {
            if (file.size > 4_000_000) throw new Error('Backup exceeds the 4 MB limit.');
            const parsed = backupSchema.parse(JSON.parse(await file.text()));
            if (generation === importGeneration.current) { setBackup(parsed); clearCredentials(); setReplace(false); setError(''); }
          } catch { if (generation === importGeneration.current) setError('Choose a valid encrypted Momentum private backup smaller than 4 MB.'); }
        })();
      }} /></label>{backup && !session && <button className="text-button" onClick={() => setBackup(null)}>Cancel selected backup</button>}</section>}
    </main>
  </div>;
}

function PrivateWorkspace({ data, busy, save }: { data: State; busy: boolean; save: (next: State, publicState?: State, publicRevision?: number) => Promise<boolean> }) {
  const [clock, setClock] = useState(() => new Date());
  const today = dateKey(clock, data.timezone);
  const [date, setDate] = useState(today), [year, setYear] = useState(+today.slice(0, 4));
  const [edit, setEdit] = useState<Habit | 'new' | null>(null), [log, setLog] = useState<Habit | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [publicData, setPublicData] = useState<{ state: State; revision: number } | null>(null), [moveId, setMoveId] = useState(''), [error, setError] = useState('');
  const current = data.habits.find(h => h.id === selected);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30_000); return () => clearInterval(timer); }, []);
  async function move() {
    if (!publicData || !moveId || busy) return;
    try { const result = moveToPrivate(publicData.state, data, moveId); if (await save(result.privateState, result.publicState, publicData.revision)) { setPublicData(null); setMoveId(''); } }
    catch (e) { setError((e as Error).message); }
  }
  return <>
    <section className="page-heading"><div><p className="eyebrow">ONLY IN YOUR PRIVATE AREA</p><h1>{current ? current.name : 'Your private practice.'}</h1></div><button className="primary" disabled={busy} onClick={() => setEdit('new')}><Plus size={18} /> New habit</button></section>
    {error && <p role="alert" className="private-error">{error}</p>}
    {current ? <section className="panel private-calendar">
      <div className="section-head"><button className="text-button" onClick={() => setSelected(null)}>All private habits</button><label>Year<select aria-label="Private calendar year" value={year} onChange={e => setYear(+e.target.value)}>{Array.from({ length: +today.slice(0, 4) - +current.created.slice(0, 4) + 1 }, (_, i) => +today.slice(0, 4) - i).map(y => <option key={y}>{y}</option>)}</select></label></div>
      <Heatmap data={data} habit={current} year={year} today={today} onDay={d => { setDate(d); setLog(current); }} />
      <div className="button-row"><span>{streaks(data, current, today).current} current streak · {streaks(data, current, today).best} best</span><button className="text-button" disabled={busy} onClick={() => setEdit(current)}>Edit habit</button></div>
    </section> : <section className="panel private-list">
      <div className="private-date"><button className="icon-button" aria-label="Previous private week" onClick={() => setDate(shiftDay(date, -7))}><ChevronLeft /></button><input aria-label="Private check-in date" type="date" value={date} max={today} onChange={e => { if (e.target.value && e.target.value <= today) setDate(e.target.value); }} /><button className="icon-button" aria-label="Next private week" disabled={!canGoToNextWeek(date, today)} onClick={() => setDate(nextWeekDate(date, today))}><ChevronRight /></button>{date !== today && <button className="text-button" onClick={() => setDate(today)}>Today</button>}</div>
      <p>{dateLabel(date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      {data.habits.length === 0 && <div className="empty-state"><LockKeyhole /><h2>A space just for you.</h2><p>Add a private habit or move one from your public tracker.</p></div>}
      {data.habits.map(h => <div className="private-habit" key={h.id}><div><strong>{h.name}</strong><small>{h.archived ? 'Archived' : `${planAt(h, date).target} ${planAt(h, date).unit}`} · {streaks(data, h, today).current} streak</small></div><div className="button-row"><button className="text-button" aria-label={`Private calendar for ${h.name}`} onClick={() => { setYear(+today.slice(0, 4)); setSelected(h.id); }}>Calendar</button><button className="primary" disabled={busy || date < h.created || !!h.archived && date >= h.archived} onClick={() => setLog(h)}>Log</button><button className="text-button" disabled={busy} onClick={() => setEdit(h)}>Edit</button></div></div>)}
    </section>}
    <section className="panel private-gate"><h2>Move a public habit here</h2><p>Its schedule and check-in history move with it. Existing exported files and manually written review notes are not changed.</p>
      {!publicData ? <button className="text-button" disabled={busy} onClick={() => { void phoneStorage.load().then(setPublicData).catch(e => setError(e.message)); }}>Choose a public habit</button> : <><label>Public habit<select value={moveId} onChange={e => setMoveId(e.target.value)}><option value="">Select a habit</option>{publicData.state.habits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><button className="primary" disabled={busy || !moveId} onClick={() => void move()}>Move to private habits</button><button className="text-button" onClick={() => setPublicData(null)}>Cancel</button></>}
    </section>
    <Dialog open={!!edit} onOpenChange={open => { if (!open && !busy) setEdit(null); }}><DialogContent className="app-dialog">{edit && <HabitForm key={edit === 'new' ? 'new' : edit.id} habit={edit} today={today} busy={busy} onSave={async habit => { const habits = edit === 'new' || !data.habits.some(h => h.id === habit.id) ? [...data.habits, habit] : data.habits.map(h => h.id === habit.id ? habit : h); if (await save({ ...data, habits })) setEdit(null); }} />}</DialogContent></Dialog>
    <Dialog open={!!log} onOpenChange={open => { if (!open && !busy) setLog(null); }}><DialogContent className="app-dialog">{log && <LogForm key={log.id + date} h={log} data={data} date={date} busy={busy} onSave={async (value, note, rest, remove) => { const entries = { ...data.entries, [log.id]: { ...data.entries[log.id] } }; if (remove) delete entries[log.id][date]; else entries[log.id][date] = { value: rest ? 0 : value, note, rest }; if (await save({ ...data, entries })) setLog(null); }} />}</DialogContent></Dialog>
  </>;
}
