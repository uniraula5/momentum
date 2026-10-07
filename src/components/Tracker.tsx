"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Dumbbell,
  Flame,
  Leaf,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings2,
  Target,
  TrendingUp,
  Upload,
  X,
  CalendarDays,
  Sparkles,
  Smartphone,
  Home,
  NotebookPen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  type State,
  type Habit,
  type Category,
  type Goal,
  type Review,
  categories,
  dayNames,
  dateKey,
  parseDay,
  shiftDay,
  weekStart,
  dateLabel,
  dateRange,
  planAt,
  scheduled,
  activeOn,
  entryAt,
  completed,
  streaks,
  stats,
} from "@/lib/tracker";
import { canGoToNextWeek, nextWeekDate, activityDayStatus, calendarStatusLabels } from "@/lib/calendar";
import { stateSchema } from "@/lib/validation";
import { phoneStorage, type TrackerStorage } from "@/platform/storage";

const icons = {
  Learning: BookOpen,
  Career: BriefcaseBusiness,
  Training: Dumbbell,
  Wellbeing: Leaf,
};
function CatIcon({ category }: { category: Category }) {
  const Icon = icons[category];
  return (
    <span className={"cat-icon " + category.toLowerCase()}>
      <Icon size={20} />
    </span>
  );
}
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Meter({ value }: { value: number }) {
  return (
    <Progress value={Math.max(0, Math.min(100, value))} className="meter" />
  );
}
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Tracker({ storage = phoneStorage, onPrivate }: { storage?: TrackerStorage; onPrivate?: () => void }) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  const startHold = () => { cancelHold(); hold.current = setTimeout(() => { hold.current = null; onPrivate?.(); }, 900); };
  useEffect(() => cancelHold, []);
  const offline = storage.offline;
  function exportData(name: string, content: string, type = "application/json") {
    if (storage.exportFile) storage.exportFile(name, content, type);
    else download(name, content, type);
  }
  const [data, setData] = useState<State | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today"),
    [date, setDate] = useState(dateKey()),
    [category, setCategory] = useState("All"),
    [selectedHabit, setSelectedHabit] = useState<string | null>(null),
    [year, setYear] = useState(new Date().getFullYear());
  const [editHabit, setEditHabit] = useState<Habit | "new" | null>(null),
    [logHabit, setLogHabit] = useState<Habit | null>(null),
    [editGoal, setEditGoal] = useState<Goal | "new" | null>(null),
    [importData, setImportData] = useState<State | null>(null);
  const [conflict, setConflict] = useState(false),
    [reviewDrafts, setReviewDrafts] = useState<Record<string, Review>>({});
  const [pending, setPending] = useState<State | null>(null),
    [reviewWeek, setReviewWeek] = useState(weekStart(dateKey()));
  useEffect(() => { if (offline) window.scrollTo({ top: 0 }); }, [tab, offline]);
  const lock = useRef(false),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!offline) return;
    document.body.classList.add("mobile-app");
    try { setReviewDrafts(JSON.parse(localStorage.getItem("momentum-review-drafts") || "{}")); } catch { /* Saved reviews remain in SQLite. */ }
    const exported = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.error) toast.error(detail.error); else if (detail.saved) toast.success("Backup saved");
    };
    window.addEventListener("momentum-export", exported);
    return () => { document.body.classList.remove("mobile-app"); window.removeEventListener("momentum-export", exported); };
  }, [offline]);
  useEffect(() => {
    if (offline && loaded) {
      try { localStorage.setItem("momentum-review-drafts", JSON.stringify(reviewDrafts)); } catch { toast.error("Could not keep your review draft. Save the review before closing."); }
    }
  }, [reviewDrafts, offline, loaded]);
  useEffect(() => {
    if (!offline) return;
    const back = () => {
      if (editHabit) setEditHabit(null);
      else if (logHabit) setLogHabit(null);
      else if (editGoal) setEditGoal(null);
      else if (importData) setImportData(null);
      else if (tab === "consistency" && selectedHabit) setSelectedHabit(null);
      else if (tab !== "today") setTab("today");
      else window.Momentum?.closeApp();
    };
    window.addEventListener("momentum-back", back);
    return () => window.removeEventListener("momentum-back", back);
  }, [offline, editHabit, logHabit, editGoal, importData, tab, selectedHabit]);
  async function load() {
    try {
      const j = await storage.load();
      setData(j.state);
      setRevision(j.revision);
      setError("");
      setPending(null);
      setConflict(false);
      if (!loaded) {
        setDate(dateKey(new Date(), j.state.timezone));
        setYear(+dateKey(new Date(), j.state.timezone).slice(0, 4));
        setReviewWeek(weekStart(dateKey(new Date(), j.state.timezone)));
      }
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (
        lock.current ||
        pending ||
        Object.entries(reviewDrafts).some(
          ([w, r]) =>
            JSON.stringify(r) !== JSON.stringify(data?.reviews[w]) &&
            (r.win || r.friction || r.next),
        )
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [pending, reviewDrafts, data]);
  // Refresh the calendar at midnight without changing a deliberately selected past date.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(i);
  }, []);
  const today = dateKey(clock, data?.timezone);
  const previousToday = useRef(today);
  useEffect(() => {
    if (date === previousToday.current) setDate(today);
    previousToday.current = today;
  }, [today, date]);
  async function save(next: State) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const j = await storage.save(next, revision);
      setData(next);
      setRevision(j.revision);
      setPending(null);
      return true;
    } catch (e) {
      setConflict(Boolean((e as { conflict?: boolean }).conflict));
      const m =
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still available.";
      setError(m);
      setPending(next);
      toast.error(m);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function log(
    h: Habit,
    value: number,
    note: string,
    rest = false,
    remove = false,
  ) {
    if (!data) return false;
    const entries = { ...data.entries, [h.id]: { ...data.entries[h.id] } };
    if (remove) delete entries[h.id][date];
    else entries[h.id][date] = { value: rest ? 0 : value, note, rest };
    return save({ ...data, entries });
  }
  async function quick(h: Habit) {
    if (!data) return;
    const done = completed(data, h, date);
    if (
      await log(
        h,
        done ? 0 : planAt(h, date).target,
        entryAt(data, h, date)?.note ?? "",
        false,
        done,
      )
    ) {
      toast.success(done ? "Check-in removed" : h.name + " complete");
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 2000000)
        throw new Error("Backup must be smaller than 2 MB.");
      const parsed = stateSchema.safeParse(JSON.parse(await f.text()));
      if (!parsed.success)
        throw new Error("This is not a valid Momentum backup.");
      setImportData(parsed.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read backup.");
    }
  }
  if (!data)
    return (
      <div className="boot">
        <div className="brand">
          <span className="brand-mark">
            <TrendingUp size={23} />
          </span>
          momentum<span className="brand-dot">.</span>
        </div>
        {error ? (
          <>
            <h1>Your tracker is temporarily unavailable.</h1>
            <p role="alert">{error}</p>
            <button className="primary" onClick={() => void load()}>
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>Opening your daily practice…</p>
          </>
        )}
      </div>
    );
  const active = data.habits.filter((h) => !h.archived),
    dueHabits = data.habits.filter((h) => scheduled(h, date)),
    dueStats = stats(data, dueHabits, date, date),
    week = weekStart(date),
    weekDays = dateRange(week, shiftDay(week, 6));
  const thisWeek = stats(data, data.habits, weekStart(today), today);
  const bestCurrent = Math.max(
    0,
    ...active.map((h) => streaks(data, h, today).current),
  );
  const careerGoals = data.goals.filter((g) => g.category === "Career"),
    careerProgress = careerGoals.length
      ? Math.round(
          (careerGoals.reduce(
            (n, g) => n + Math.min(g.current / g.target, 1),
            0,
          ) /
            careerGoals.length) *
            100,
        )
      : 0;
  const shown = data.habits.filter(
    (h) => activeOn(h, date) && (category === "All" || h.category === category),
  );
  const careerDays = Math.max(
    0,
    Math.ceil(
      (parseDay("2027-06-01").getTime() - parseDay(today).getTime()) / 86400000,
    ),
  );
  const habitOptions = [
    ...data.habits.map((h) => ({
      value: h.id,
      label: h.name + (h.archived ? " · archived" : ""),
    })),
  ];
  const currentHabit = data.habits.find((h) => h.id === selectedHabit);
  return (
    <TooltipProvider>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" onPointerDown={startHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
            onContextMenu={e => e.preventDefault()} onKeyDown={e => { if (e.altKey && e.key === "Enter") { e.preventDefault(); cancelHold(); onPrivate?.(); } else if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startHold(); } }} onKeyUp={cancelHold} onBlur={cancelHold}
            href={offline ? "#" : "/"} onClick={offline ? (e) => { e.preventDefault(); setTab("today"); } : undefined} aria-label="Momentum home">
            <span className="brand-mark">
              <TrendingUp size={22} />
            </span>
            momentum<span className="brand-dot">.</span>
          </a>
          <span className="top-tag">THE DAILY PRACTICE</span>
          <div className="account">
            <span className="sync">
              {busy ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Smartphone size={16} />
              )}{" "}
              {busy
                ? "Saving…"
                : pending
                  ? "Unsaved changes"
                  : "Saved on phone"}
            </span>
            <span className="avatar" title={data.name}>
              {data.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <Tabs value={tab} onValueChange={setTab} className="main-tabs">
          <div className="nav-wrap">
            <TabsList variant="line" className="nav-tabs">
              <TabsTrigger value="today">{offline && <Home size={20} />}Today</TabsTrigger>
              <TabsTrigger value="consistency">{offline && <CalendarDays size={20} />}{offline ? "Calendar" : "Consistency"}</TabsTrigger>
              <TabsTrigger value="goals">{offline && <Target size={20} />}{offline ? "Goals" : "Milestones"}</TabsTrigger>
              <TabsTrigger value="review">{offline && <NotebookPen size={20} />}{offline ? "Review" : "Weekly review"}</TabsTrigger>
              <TabsTrigger value="settings">
                <Settings2 size={16} />
                <span>{offline ? "Routines" : "My routines"}</span>
              </TabsTrigger>
            </TabsList>
            <span className="nav-date">
              {dateLabel(today, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <main>
            {error && (
              <div className="error-banner" role="alert">
                <div>
                  <strong>Your latest changes haven’t been saved.</strong>
                  <p>{error}</p>
                </div>
                <div className="button-row">
                  {pending && (
                    <button
                      onClick={() =>
                        exportData(
                          "momentum-unsaved-draft.json",
                          JSON.stringify(pending, null, 2),
                        )
                      }
                    >
                      Download draft
                    </button>
                  )}
                  <button disabled={busy} onClick={() => void load()}>
                    Reload latest
                  </button>
                  {pending && !conflict && (
                    <button disabled={busy} onClick={() => void save(pending)}>
                      Retry save
                    </button>
                  )}
                </div>
              </div>
            )}
            <TabsContent value="today">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">BUILDING TOWARD SUMMER 2027</p>
                  <h1>A little better, every day.</h1>
                  <p>Make time for the person you’re becoming, {data.name}.</p>
                </div>
                <button className="primary" onClick={() => setEditHabit("new")}>
                  <Plus size={18} /> New habit
                </button>
              </section>
              <div className="today-layout">
                <div className="left-column">
                  <section className="daily-score panel">
                    <div>
                      <span className="eyebrow">
                        {date === today
                          ? "TODAY’S MOMENTUM"
                          : dateLabel(date, {
                              month: "long",
                              day: "numeric",
                            }).toUpperCase()}
                      </span>
                      <div className="score-number">
                        {dueStats.done}
                        <span> / {dueStats.due}</span>
                      </div>
                      <p>
                        {dueStats.due === 0
                          ? "A little room to recharge."
                          : dueStats.done === dueStats.due
                            ? "You showed up. Take that with you."
                            : "Small actions. Lasting progress."}
                      </p>
                      {dueStats.rest > 0 && (
                        <span className="rest-label">
                          {dueStats.rest} recovery{" "}
                          {dueStats.rest === 1 ? "day" : "check-ins"} protected
                        </span>
                      )}
                    </div>
                    <div className="score-right">
                      <div
                        className="progress-ring"
                        style={
                          {
                            "--progress": `${dueStats.percent}%`,
                          } as React.CSSProperties
                        }
                      >
                        <div>
                          <strong>{dueStats.percent}%</strong>
                          <span>complete</span>
                        </div>
                      </div>
                      <span>YOUR DAILY PRACTICE</span>
                    </div>
                  </section>
                  <section className="panel habit-panel">
                    <div className="section-head">
                      <div>
                        <h2>
                          {date === today
                            ? "Today’s habits"
                            : dateLabel(date, {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                        </h2>
                        <p>
                          {dueHabits.length} scheduled · show up in your own way
                        </p>
                      </div>
                      <div className="date-controls">
                        <button
                          className="icon-button"
                          aria-label="Previous week"
                          onClick={() => setDate(shiftDay(date, -7))}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <label className="date-input">
                          <CalendarDays size={16} />
                          <input
                            aria-label="Check-in date"
                            type="date"
                            min={data.habits.reduce(
                              (d, h) => (h.created < d ? h.created : d),
                              today,
                            )}
                            max={today}
                            value={date}
                            onInput={(e) =>
                              e.currentTarget.value &&
                              e.currentTarget.value <= today &&
                              setDate(e.currentTarget.value)
                            }
                            onChange={(e) =>
                              e.target.value &&
                              e.target.value <= today &&
                              setDate(e.target.value)
                            }
                          />
                        </label>
                        <button
                          className="icon-button"
                          aria-label="Next week"
                          disabled={!canGoToNextWeek(date, today)}
                          onClick={() => setDate(nextWeekDate(date, today))}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="week-strip">
                      {weekDays.map((d) => {
                        return (
                          <button
                            key={d}
                            className={d === date ? "selected" : ""}
                            disabled={d > today}
                            onClick={() => setDate(d)}
                            aria-pressed={d === date}
                          >
                            <span>{dateLabel(d, { weekday: "short" })}</span>
                            <strong>{parseDay(d).getUTCDate()}</strong>
                          </button>
                        );
                      })}
                    </div>
                    <div className="filter-row">
                      <div
                        className="category-filters"
                        aria-label="Filter habits"
                      >
                        {["All", ...categories].map((c) => (
                          <button
                            aria-pressed={category === c}
                            key={c}
                            onClick={() => setCategory(c)}
                            className={category === c ? "active" : ""}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {date !== today && (
                        <button
                          className="text-button"
                          onClick={() => setDate(today)}
                        >
                          Back to today
                        </button>
                      )}
                    </div>
                    <div className="habit-list">
                      {shown.length === 0 ? (
                        <div className="empty-state">
                          <Leaf />
                          <h3>No habits here yet.</h3>
                          <p>Add a routine or choose another day.</p>
                        </div>
                      ) : (
                        shown
                          .sort(
                            (a, b) =>
                              Number(scheduled(b, date)) -
                              Number(scheduled(a, date)),
                          )
                          .map((h) => {
                            const p = planAt(h, date),
                              e = entryAt(data, h, date),
                              done = completed(data, h, date),
                              rest = e?.rest,
                              st = streaks(data, h, today),
                              due = scheduled(h, date);
                            return (
                              <div
                                key={h.id}
                                className={
                                  "habit-row " +
                                  (done ? "is-done" : "") +
                                  (!due ? " is-optional" : "")
                                }
                              >
                                <Checkbox
                                  className="habit-check"
                                  aria-label={
                                    (done ? "Undo " : "Complete ") + h.name
                                  }
                                  checked={done}
                                  disabled={busy}
                                  onCheckedChange={() => void quick(h)}
                                />
                                <CatIcon category={h.category} />
                                <button
                                  className="habit-main"
                                  onClick={() => setLogHabit(h)}
                                >
                                  <strong>{h.name}</strong>
                                  <span>
                                    {rest
                                      ? "Recovery day"
                                      : `${e?.value ?? 0} / ${p.target} ${p.unit}`}
                                    <i>·</i>
                                    {due ? h.category : "Not scheduled"}
                                    {e?.note && <NotebookPen size={12} />}
                                  </span>
                                </button>
                                <div className="habit-tail">
                                  <span
                                    className={
                                      "streak " + (st.current ? "lit" : "")
                                    }
                                    title="Consecutive scheduled completions"
                                  >
                                    <Flame size={15} />
                                    {st.current}
                                  </span>
                                  <button
                                    className="log-button"
                                    onClick={() => setLogHabit(h)}
                                    aria-label={"Log " + h.name}
                                  >
                                    {done ? (
                                      <Check size={16} />
                                    ) : rest ? (
                                      <Leaf size={16} />
                                    ) : (
                                      <Plus size={16} />
                                    )}
                                    <span>
                                      {done ? "Done" : rest ? "Rest" : "Log"}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                    <div className="panel-foot">
                      <Leaf size={15} />
                      <span>
                        Rest is part of the routine. Recovery days protect your
                        streak without counting as a completion.
                      </span>
                    </div>
                  </section>
                </div>
                <aside className="right-column">
                  <section className="north-star">
                    <div className="card-kicker">
                      <Target size={17} /> YOUR NORTH STAR{" "}
                      <ArrowUpRight size={19} />
                    </div>
                    <h2>
                      Your next
                      <br />
                      opportunity.
                    </h2>
                    <p>
                      Software · CS & IT
                      <br />
                      Internship or co-op, summer 2027.
                    </p>
                    <div className="goal-progress">
                      <strong>{careerProgress}%</strong>
                      <span>of your career milestones</span>
                    </div>
                    <Meter value={careerProgress} />
                    <div className="north-bottom">
                      <span>
                        {careerDays > 0
                          ? `${careerDays} days to June 1`
                          : "Your next chapter starts here"}
                      </span>
                      <button
                        aria-label="View career milestones"
                        onClick={() => setTab("goals")}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                  </section>
                  <section className="panel week-summary">
                    <div className="section-head">
                      <h2>This week</h2>
                      <TrendingUp size={19} />
                    </div>
                    <div className="week-stat">
                      <span>Scheduled habits completed</span>
                      <strong>
                        {thisWeek.done}
                        <small> / {thisWeek.due}</small>
                      </strong>
                    </div>
                    <Meter value={thisWeek.percent} />
                    <div className="mini-stats">
                      <div>
                        <Flame size={17} />
                        <strong>{bestCurrent}</strong>
                        <span>best active streak</span>
                      </div>
                      <div>
                        <BookOpen size={17} />
                        <strong>
                          {Math.round((thisWeek.minutes / 60) * 10) / 10}
                          <small>h</small>
                        </strong>
                        <span>time logged</span>
                      </div>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setReviewWeek(weekStart(today));
                        setTab("review");
                      }}
                    >
                      Reflect on your week <ArrowUpRight size={15} />
                    </button>
                  </section>
                  <section className="small-note">
                    <Sparkles size={18} />
                    <div>
                      <h3>Quality over volume.</h3>
                      <p>
                        Log what you learned, built, or practiced. The small
                        details make your progress visible.
                      </p>
                    </div>
                  </section>
                </aside>
              </div>
            </TabsContent>
            <TabsContent value="consistency">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">EVERY CHECK-IN COUNTS</p>
                  <h1>{currentHabit ? currentHabit.name : "Your activity calendars."}</h1>
                  <p>One calendar per activity. Every check-in stays in its own history.</p>
                </div>
                {currentHabit ? (
                <Pick
                  label="Calendar year"
                  value={String(year)}
                  onChange={(s) => setYear(+s)}
                  options={Array.from(
                    {
                      length: Math.max(
                        1,
                        +today.slice(0, 4) -
                          Math.min(
                            +today.slice(0, 4),
                            ...data.habits.map((h) => +h.created.slice(0, 4)),
                          ) +
                          1,
                      ),
                    },
                    (_, i) => ({
                      value: String(+today.slice(0, 4) - i),
                      label: String(+today.slice(0, 4) - i),
                    }),
                  )}
                />
                ) : (
                  <button className="primary" onClick={() => setEditHabit("new")}><Plus size={18} /> New activity</button>
                )}
              </section>
              {currentHabit ? <>
              <button className="text-button calendar-back" onClick={() => setSelectedHabit(null)}><ChevronLeft size={18} /> All activity calendars</button>
              <section className="panel consistency-panel">
                <div className="section-head">
                  <Pick
                    label="Calendar activity"
                    value={currentHabit.id}
                    onChange={setSelectedHabit}
                    options={habitOptions}
                  />
                  <span className="subtle">
                    Select a day to log this activity
                  </span>
                </div>
                <Heatmap
                  data={data}
                  habit={currentHabit}
                  year={year}
                  today={today}
                  onDay={(d) => {
                    setDate(d);
                    setLogHabit(currentHabit);
                  }}
                />
                <div className="calendar-metrics">
                  {(() => {
                    const s = stats(
                      data,
                      [currentHabit],
                      `${year}-01-01`,
                      `${year}-12-31` < today ? `${year}-12-31` : today,
                    );
                    return (
                      <>
                        <div>
                          <strong>{s.done}</strong>
                          <span>scheduled completions</span>
                        </div>
                        <div>
                          <strong>{s.percent}%</strong>
                          <span>scheduled consistency</span>
                        </div>
                        <div>
                          <strong>{s.rest}</strong>
                          <span>recovery check-ins</span>
                        </div>
                        {currentHabit && (
                          <div>
                            <strong>
                              {streaks(data, currentHabit, today).best}
                            </strong>
                            <span>longest streak</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </section>
              </> : <>
              <div className="section-head activity-title">
                <div>
                  <h2>Choose an activity</h2>
                  <p>Last 12 weeks · tap a card for its full calendar</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="icon-button"
                      aria-label="How streaks work"
                    >
                      <CircleHelp size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="help-tooltip">
                    Streaks count consecutive scheduled completions. Unscheduled
                    and recovery days are neutral. Today stays open until
                    midnight in your timezone.
                  </TooltipContent>
                </Tooltip>
              </div>
              <CalendarLegend />
              <div className="activity-grid">
                {data.habits.map((h) => {
                  const st = streaks(data, h, today),
                    s = stats(data, [h], shiftDay(today, -27), today);
                  return (
                    <button
                      className="panel activity-card"
                      key={h.id}
                      aria-label={"View calendar for " + h.name}
                      onClick={() => {
                        setYear(+today.slice(0, 4));
                        setSelectedHabit(h.id);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      <div className="activity-card-head">
                        <CatIcon category={h.category} />
                        <span>
                          <strong>{h.name}</strong>
                          <small>{h.archived ? "Archived" : h.category}</small>
                        </span>
                        <ArrowUpRight size={17} />
                      </div>
                      <MiniHeatmap data={data} habit={h} today={today} />
                      <div className="activity-card-bottom">
                        <span>
                          <Flame size={15} />
                          <strong>{st.current}</strong> streak
                        </span>
                        <span>
                          <strong>{st.best}</strong> best
                        </span>
                        <span>
                          <strong>{s.percent}%</strong> in 28 days
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {data.habits.length === 0 && <div className="empty-state"><CalendarDays /><h3>Your first activity starts here.</h3><p>Create an activity and its calendar appears automatically.</p></div>}
              </>}
            </TabsContent>
            <TabsContent value="goals">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">PRACTICE WITH A PURPOSE</p>
                  <h1>The bigger milestones.</h1>
                  <p>
                    Your habits are the input. These are the outcomes you’re
                    working toward.
                  </p>
                </div>
                <button className="primary" onClick={() => setEditGoal("new")}>
                  <Plus size={18} /> Add milestone
                </button>
              </section>
              <div className="goals-banner">
                <Target size={28} />
                <div>
                  <h2>Summer 2027 · Your next opportunity</h2>
                  <p>
                    Build proof of your skills. Make connections. Keep your
                    pipeline moving.
                  </p>
                </div>
                <span>
                  {careerDays} <small>days to June 1</small>
                </span>
              </div>
              <p className="section-note">
                Suggested milestones are editable. Progress is updated manually,
                so applications and skill records stay accurate.
              </p>
              <div className="goals-grid">
                {data.goals.map((g) => (
                  <button
                    className="panel goal-card"
                    key={g.id}
                    onClick={() => setEditGoal(g)}
                  >
                    <div className="section-head">
                      <CatIcon category={g.category} />
                      <span className="badge">
                        {g.current >= g.target ? "Achieved" : g.category}
                      </span>
                    </div>
                    <h2>{g.name}</h2>
                    <div className="goal-count">
                      <strong>{g.current}</strong>
                      <span>
                        {" "}
                        / {g.target} {g.unit}
                      </span>
                    </div>
                    <Meter value={(g.current / g.target) * 100} />
                    <div className="goal-bottom">
                      <span>
                        {g.due
                          ? `${g.due < today && g.current < g.target ? "Past target · " : ""}${dateLabel(g.due, { month: "short", day: "numeric", year: "numeric" })}`
                          : "At your own pace"}
                      </span>
                      <span>
                        Update <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {data.goals.length === 0 && (
                <div className="empty-state">
                  <Target />
                  <h3>Give your practice a direction.</h3>
                  <button onClick={() => setEditGoal("new")}>
                    Add your first milestone
                  </button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="review">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">PAUSE. NOTICE. ADJUST.</p>
                  <h1>A week worth reflecting on.</h1>
                  <p>
                    Find what worked, then make next week a little more
                    intentional.
                  </p>
                </div>
                <div className="button-row">
                  <button
                    className="icon-button"
                    aria-label="Previous review week"
                    onClick={() => setReviewWeek(shiftDay(reviewWeek, -7))}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="review-range">
                    {dateLabel(reviewWeek)} –{" "}
                    {dateLabel(shiftDay(reviewWeek, 6))}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Next review week"
                    disabled={reviewWeek >= weekStart(today)}
                    onClick={() => setReviewWeek(shiftDay(reviewWeek, 7))}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </section>
              <ReviewPanel
                key={reviewWeek}
                data={data}
                week={reviewWeek}
                today={today}
                busy={busy}
                save={save}
                draft={reviewDrafts[reviewWeek]}
                onDraft={(r) =>
                  setReviewDrafts({ ...reviewDrafts, [reviewWeek]: r })
                }
              />
            </TabsContent>
            <TabsContent value="settings">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">BUILT AROUND YOUR LIFE</p>
                  <h1>Make the routine yours.</h1>
                  <p>
                    Adjust your targets, plan your days, and keep your data
                    close.
                  </p>
                </div>
                <button className="primary" onClick={() => setEditHabit("new")}>
                  <Plus size={18} /> New habit
                </button>
              </section>
              <div className="settings-layout">
                <section className="panel">
                  <div className="section-head">
                    <h2>Your habits</h2>
                    <span className="badge">{active.length} active</span>
                  </div>
                  <div className="settings-habits">
                    {data.habits.map((h) => (
                      <div className="settings-row" key={h.id}>
                        <CatIcon category={h.category} />
                        <div>
                          <strong>{h.name}</strong>
                          <p>
                            {h.archived
                              ? "Archived · history preserved"
                              : `${planAt(h, today).target} ${planAt(h, today).unit} · ${
                                  planAt(h, today).days.length === 7
                                    ? "Every day"
                                    : planAt(h, today)
                                        .days.map((d) => dayNames[d])
                                        .join(", ")
                                }`}
                          </p>
                          {h.plans.some((p) => p.from > today) && (
                            <small>
                              New schedule starts{" "}
                              {dateLabel(h.plans[h.plans.length - 1].from)}
                            </small>
                          )}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setEditHabit(h)}
                        >
                          {h.archived ? "View" : "Edit"}{" "}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="right-column">
                  <ProfileSettings
                    key={data.name + data.timezone}
                    data={data}
                    busy={busy}
                    save={save}
                  />
                  <section className="panel data-panel">
                    <h2>Your data, in your hands.</h2>
                    <p>
                      Everything stays on this phone and works offline. Export a backup regularly; uninstalling the app or losing your phone can remove your records.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        exportData(
                          `momentum-backup-${today}.json`,
                          JSON.stringify(data, null, 2),
                        )
                      }
                    >
                      <Download size={17} /> Export backup
                    </button>
                    <button
                      onClick={() => {
                        const rows = [
                          [
                            "Activity",
                            "Category",
                            "Date",
                            "Value",
                            "Unit",
                            "Recovery",
                            "Note",
                          ],
                          ...data.habits.flatMap((h) =>
                            Object.entries(data.entries[h.id] ?? {})
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([d, e]) => [
                                h.name,
                                h.category,
                                d,
                                String(e.value),
                                planAt(h, d).unit,
                                e.rest ? "yes" : "no",
                                e.note,
                              ]),
                          ),
                        ];
                        const safe = (s: string) => {
                          const escaped = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
                          return '"' + escaped.replaceAll('"', '""') + '"';
                        };
                        exportData(
                          `momentum-check-ins-${today}.csv`,
                          rows.map((r) => r.map(safe).join(",")).join("\r\n"),
                          "text/csv",
                        );
                      }}
                    >
                      <Download size={17} /> Export check-ins as CSV
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={17} /> Restore backup
                    </button>
                    <input
                      ref={file}
                      type="file"
                      accept=".json,application/json"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importFile(f);
                        e.target.value = "";
                      }}
                    />
                  </section>
                  <section className="small-note">
                    <CircleHelp size={20} />
                    <div>
                      <h3>How your streak works</h3>
                      <p>
                        Complete your target on scheduled days. A missed
                        scheduled day ends the streak. Rest days pause it.
                        Schedule changes take effect tomorrow and preserve your
                        history.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </TabsContent>
          </main>
        </Tabs>
        <footer>
          <span className="brand footer-brand">
            momentum<span className="brand-dot">.</span>
          </span>
          <span>Learning. Movement. Mindfulness. You.</span>
          <span>{data.timezone}</span>
        </footer>
      </div>
      <Toaster position="bottom-right" theme="light" />
      <Dialog
        open={!!logHabit}
        onOpenChange={(o) => !o && !busy && setLogHabit(null)}
      >
        <DialogContent className="app-dialog">
          {logHabit && (
            <LogForm
              key={logHabit.id + date}
              h={logHabit}
              data={data}
              date={date}
              busy={busy}
              onSave={async (v, n, r, remove) => {
                if (await log(logHabit, v, n, r, remove)) {
                  setLogHabit(null);
                  toast.success(
                    remove
                      ? "Check-in removed"
                      : r
                        ? "Recovery day saved"
                        : "Check-in saved",
                  );
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editHabit}
        onOpenChange={(o) => !o && !busy && setEditHabit(null)}
      >
        <DialogContent className="app-dialog">
          {editHabit && (
            <HabitForm
              key={editHabit === "new" ? "new" : editHabit.id}
              habit={editHabit}
              today={today}
              busy={busy}
              onSave={async (h) => {
                const habits =
                  editHabit === "new" || !data.habits.some((x) => x.id === h.id)
                    ? [...data.habits, h]
                    : data.habits.map((x) => (x.id === h.id ? h : x));
                if (await save({ ...data, habits })) {
                  setEditHabit(null);
                  toast.success("Routine saved");
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editGoal}
        onOpenChange={(o) => !o && !busy && setEditGoal(null)}
      >
        <DialogContent className="app-dialog">
          {editGoal && (
            <GoalForm
              key={editGoal === "new" ? "new" : editGoal.id}
              goal={editGoal}
              busy={busy}
              onSave={async (g, remove) => {
                const goals = remove
                  ? data.goals.filter((x) => x.id !== g.id)
                  : editGoal === "new"
                    ? [...data.goals, g]
                    : data.goals.map((x) => (x.id === g.id ? g : x));
                if (await save({ ...data, goals })) {
                  setEditGoal(null);
                  toast.success(
                    remove ? "Milestone removed" : "Milestone saved",
                  );
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!importData}
        onOpenChange={(o) => !o && setImportData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current habits, check-ins, milestones, and
              reviews. Export your current data first if you want to keep a
              copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (importData && (await save(importData))) {
                  setImportData(null);
                  setReviewDrafts({});
                  setTab("today");
                  toast.success("Backup restored");
                }
              }}
            >
              Replace with backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function CalendarLegend() {
  return <div className="legend" aria-label="Calendar colors">
    {(["complete", "partial", "recovery", "missed", "off"] as const).map(status => (
      <span className="legend-item" key={status}><i className={`heat-cell status-${status}`} />{calendarStatusLabels[status]}</span>
    ))}
  </div>;
}

export function Heatmap({
  data,
  habit,
  year,
  today,
  onDay,
}: {
  data: State;
  habit: Habit;
  year: number;
  today: string;
  onDay: (d: string) => void;
}) {
  const start = weekStart(`${year}-01-01`),
    end = shiftDay(weekStart(`${year}-12-31`), 6),
    days = dateRange(start, end),
    weeks = days.length / 7;
  const [focus, setFocus] = useState(
    days.filter(d => d.startsWith(String(year)) && activityDayStatus(data, habit, d, today) !== "unavailable").at(-1) ?? "",
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focused =
      days.filter(d => d.startsWith(String(year)) && activityDayStatus(data, habit, d, today) !== "unavailable").at(-1) ?? "";
    setFocus(focused);
    const el = scrollRef.current;
    if (el) {
      const proportion = Math.max(0, days.indexOf(focused)) / days.length;
      el.scrollLeft = Math.max(
        0,
        el.scrollWidth * proportion - el.clientWidth * 0.72,
      );
    }
  }, [year, today, habit.id, habit.created, habit.archived]);
  const total = Object.entries(data.entries[habit.id] ?? {}).filter(
    ([d]) => d.startsWith(String(year)) && completed(data, habit, d),
  ).length;
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll" ref={scrollRef}>
        <div
          className="heatmap-chart"
          style={{ "--weeks": weeks } as React.CSSProperties}
        >
          <div className="month-labels">
            {Array.from({ length: weeks }, (_, w) => {
              const d = days[w * 7];
              const monthStart = days
                .slice(w * 7, w * 7 + 7)
                .find(
                  (x) =>
                    x.startsWith(String(year)) &&
                    parseDay(x).getUTCDate() === 1,
                );
              return (
                <span key={d}>
                  {monthStart ? dateLabel(monthStart, { month: "short" }) : ""}
                </span>
              );
            })}
          </div>
          <div className="heatmap-body">
            <div className="day-axis">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="heatmap-grid">
              {days.map((d, i) => {
                const inYear = d.startsWith(String(year)),
                  status = activityDayStatus(data, habit, d, today),
                  unavailable = status === "unavailable";
                const label = `${habit.name}, ${dateLabel(d, { month: "long", day: "numeric", year: "numeric" })}: ${calendarStatusLabels[status]}`;
                return (
                  <button
                    key={d}
                    data-date={d}
                    title={label}
                    aria-label={label}
                    tabIndex={d === focus ? 0 : -1}
                    onFocus={() => setFocus(d)}
                    disabled={!inYear || unavailable}
                    className={`heat-cell status-${status} ${!inYear ? "outside" : ""} ${d === today ? "today-cell" : ""}`}
                    onClick={() => onDay(d)}
                    onKeyDown={(e) => {
                      const offset = {
                        ArrowUp: -1,
                        ArrowDown: 1,
                        ArrowLeft: -7,
                        ArrowRight: 7,
                      }[e.key];
                      if (offset) {
                        e.preventDefault();
                        const next = days[i + offset];
                        if (
                          next &&
                          activityDayStatus(data, habit, next, today) !== "unavailable" &&
                          next.startsWith(String(year))
                        ) {
                          setFocus(next);
                          e.currentTarget.parentElement
                            ?.querySelector<HTMLButtonElement>(
                              `[data-date="${next}"]`,
                            )
                            ?.focus();
                        }
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="heatmap-caption">
        <span>
          <strong>{total}</strong> completed check-ins in {year}
          {total === 0 ? " · Your first square is waiting." : ""}
        </span>
        <CalendarLegend />
      </div>
    </div>
  );
}
function MiniHeatmap({
  data,
  habit,
  today,
}: {
  data: State;
  habit: Habit;
  today: string;
}) {
  const start = shiftDay(weekStart(today), -77),
    days = dateRange(start, shiftDay(weekStart(today), 6));
  return (
    <div className="mini-heatmap" aria-hidden="true">
      {days.map((d) => (
        <i
          key={d}
          className={`heat-cell status-${activityDayStatus(data, habit, d, today)}`}
        />
      ))}
    </div>
  );
}

export function LogForm({
  h,
  data,
  date,
  busy,
  onSave,
}: {
  h: Habit;
  data: State;
  date: string;
  busy: boolean;
  onSave: (v: number, n: string, r: boolean, remove?: boolean) => Promise<void>;
}) {
  const e = entryAt(data, h, date),
    p = planAt(h, date);
  const [value, setValue] = useState(String(e?.value ?? p.target)),
    [note, setNote] = useState(e?.note ?? ""),
    [rest, setRest] = useState(e?.rest ?? false);
  return (
    <>
      <div className="dialog-icon">
        <CatIcon category={h.category} />
      </div>
      <DialogTitle>{h.name}</DialogTitle>
      <DialogDescription>
        {dateLabel(date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}{" "}
        · Target {p.target} {p.unit}
      </DialogDescription>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(Number(value), note, rest);
        }}
      >
        <p className="form-hint">{h.description}</p>
        <label>
          Amount completed{" "}
          <div className="input-with-unit">
            <input
              aria-label="Amount completed"
              type="number"
              min="0"
              max="1000000"
              step="any"
              required
              disabled={rest}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <span>{p.unit}</span>
          </div>
        </label>
        <label>
          Session notes{" "}
          <textarea
            maxLength={2000}
            rows={4}
            placeholder="What did you work on? How did it feel?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <Checkbox
            checked={rest}
            onCheckedChange={(v) => setRest(v === true)}
          />{" "}
          Mark as a recovery day
        </label>
        <p className="form-hint">
          Recovery protects your streak and is excluded from your completion
          rate. It does not add a completed day.
        </p>
        <div className="form-actions">
          {e && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => void onSave(0, "", false, true)}
            >
              Clear check-in
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save check-in"}
          </button>
        </div>
      </form>
    </>
  );
}
export function HabitForm({
  habit,
  today,
  busy,
  onSave,
}: {
  habit: Habit | "new";
  today: string;
  busy: boolean;
  onSave: (h: Habit) => Promise<void>;
}) {
  const h = habit === "new" ? null : habit,
    p = h?.plans[h.plans.length - 1];
  const [name, setName] = useState(h?.name ?? ""),
    [category, setCategory] = useState<Category>(h?.category ?? "Learning"),
    [description, setDescription] = useState(h?.description ?? ""),
    [target, setTarget] = useState(String(p?.target ?? 1)),
    [unit, setUnit] = useState(p?.unit ?? "session"),
    [days, setDays] = useState(p?.days ?? [1, 2, 3, 4, 5]),
    [start, setStart] = useState(h?.created ?? today);
  const build = (): Habit => ({
    id: h?.id ?? crypto.randomUUID(),
    name: name.trim(),
    category,
    description,
    created: start,
    archived: h?.archived ?? null,
    plans: h
      ? (() => {
          const from = h.created === today ? today : shiftDay(today, 1);
          return [
            ...h.plans.filter((p) => p.from < from),
            {
              from,
              days: [...days].sort(),
              target: Number(target),
              unit: unit.trim(),
            },
          ];
        })()
      : [
          {
            from: start,
            days: [...days].sort(),
            target: Number(target),
            unit: unit.trim(),
          },
        ],
  });
  return (
    <>
      <DialogTitle>
        {h?.archived
          ? "Archived habit"
          : h
            ? "Edit your habit"
            : "Create a habit"}
      </DialogTitle>
      <DialogDescription>
        {h?.archived
          ? "Your history is preserved. Restart creates a fresh routine."
          : h
            ? "Target and schedule changes start tomorrow (or today for a brand-new habit)."
            : "Start small. Choose a target you can come back to."}
      </DialogDescription>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!days.length) {
            toast.error("Choose at least one day.");
            return;
          }
          void onSave(build());
        }}
      >
        <fieldset disabled={busy || !!h?.archived}>
          <label>
            Habit name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read a research paper"
            />
          </label>
          <label>
            Area
            <Pick
              label="Habit area"
              value={category}
              onChange={(v) => setCategory(v as Category)}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </label>
          <div className="form-two">
            <label>
              Daily target
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label>
              Unit
              <input
                required
                maxLength={24}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="min, reps, sessions…"
              />
            </label>
          </div>
          <div>
            <span className="field-label">Scheduled days</span>
            <div className="day-picker">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d} className={days.includes(d) ? "chosen" : ""}>
                  <Checkbox
                    checked={days.includes(d)}
                    onCheckedChange={(v) =>
                      setDays(v ? [...days, d] : days.filter((x) => x !== d))
                    }
                  />
                  {dayNames[d]}
                </label>
              ))}
            </div>
          </div>
          {!h && (
            <label>
              Start tracking from
              <input
                type="date"
                required
                min="2020-01-01"
                max={today}
                value={start}
                onInput={(e) => setStart(e.currentTarget.value)}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
          )}
          <label>
            Your intention
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does showing up look like?"
            />
          </label>
        </fieldset>
        <div className="form-actions">
          {h && !h.archived && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void onSave({ ...h, archived: today })}
            >
              Archive habit
            </button>
          )}
          {h?.archived ? (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                void onSave({
                  ...h,
                  id: crypto.randomUUID(),
                  created: today,
                  archived: null,
                  plans: [{ ...h.plans[h.plans.length - 1], from: today }],
                })
              }
            >
              Restart as a new habit
            </button>
          ) : (
            <button className="primary" disabled={busy || !days.length}>
              {busy ? "Saving…" : "Save habit"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
function GoalForm({
  goal,
  busy,
  onSave,
}: {
  goal: Goal | "new";
  busy: boolean;
  onSave: (g: Goal, remove?: boolean) => Promise<void>;
}) {
  const g = goal === "new" ? null : goal;
  const [name, setName] = useState(g?.name ?? ""),
    [category, setCategory] = useState<Category>(g?.category ?? "Career"),
    [current, setCurrent] = useState(String(g?.current ?? 0)),
    [target, setTarget] = useState(String(g?.target ?? 1)),
    [unit, setUnit] = useState(g?.unit ?? "projects"),
    [due, setDue] = useState(g?.due ?? ""),
    [confirm, setConfirm] = useState(false);
  return (
    <>
      <DialogTitle>
        {g ? "Update milestone" : "Your next milestone"}
      </DialogTitle>
      <DialogDescription>
        Record your actual progress. You can adjust these targets anytime.
      </DialogDescription>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            id: g?.id ?? crypto.randomUUID(),
            name: name.trim(),
            category,
            current: Number(current),
            target: Number(target),
            unit: unit.trim(),
            due,
          });
        }}
      >
        <label>
          Milestone
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Area
          <Pick
            label="Milestone area"
            value={category}
            onChange={(v) => setCategory(v as Category)}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </label>
        <div className="form-two">
          <label>
            Current
            <input
              required
              type="number"
              min="0"
              max="1000000"
              step="any"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            Target
            <input
              required
              type="number"
              min="0.01"
              max="1000000"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
        </div>
        <div className="form-two">
          <label>
            Unit
            <input
              required
              maxLength={30}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>
          <label>
            Target date (optional)
            <input
              type="date"
              value={due}
              onInput={(e) => setDue(e.currentTarget.value)}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          {g && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() =>
                confirm ? void onSave(g, true) : setConfirm(true)
              }
            >
              {confirm ? "Confirm removal" : "Remove milestone"}
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save milestone"}
          </button>
        </div>
      </form>
    </>
  );
}

function ReviewPanel({
  data,
  week,
  today,
  busy,
  save,
  draft,
  onDraft,
}: {
  data: State;
  week: string;
  today: string;
  busy: boolean;
  save: (s: State) => Promise<boolean>;
  draft?: Review;
  onDraft: (r: Review) => void;
}) {
  const end = shiftDay(week, 6) < today ? shiftDay(week, 6) : today,
    s = stats(data, data.habits, week, end),
    prior = stats(data, data.habits, shiftDay(week, -7), shiftDay(week, -1));
  const [review, setReview] = useState<Review>(
      draft ??
        data.reviews[week] ?? { win: "", friction: "", next: "", energy: 3 },
    ),
    [dirty, setDirty] = useState(
      !!draft && JSON.stringify(draft) !== JSON.stringify(data.reviews[week]),
    );
  useEffect(() => {
    onDraft(review);
  }, [review]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  return (
    <>
      <div className="review-stats">
        <section className="panel">
          <span>Consistency</span>
          <strong>{s.percent}%</strong>
          <p>
            {s.done} of {s.due} scheduled habits
            {week === weekStart(today) ? " so far" : ""}
          </p>
        </section>
        <section className="panel">
          <span>Time logged</span>
          <strong>
            {Math.round((s.minutes / 60) * 10) / 10}
            <small> hours</small>
          </strong>
          <p>Across habits measured in minutes</p>
        </section>
        <section className="panel">
          <span>Recovery respected</span>
          <strong>{s.rest}</strong>
          <p>Recovery check-ins, streaks protected</p>
        </section>
      </div>
      <div className="review-layout">
        <section className="panel review-form">
          <h2>Your weekly reflection</h2>
          <p>
            {week === weekStart(today)
              ? "This week is still unfolding. You can update your reflection anytime."
              : "A few honest notes are enough."}
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save({
                  ...data,
                  reviews: { ...data.reviews, [week]: review },
                })
              ) {
                setDirty(false);
                toast.success("Weekly reflection saved");
              }
            }}
          >
            {(["win", "friction", "next"] as const).map((key, i) => (
              <label key={key}>
                {
                  [
                    "What went well?",
                    "What got in the way?",
                    "One adjustment for next week",
                  ][i]
                }
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={review[key]}
                  onChange={(e) => {
                    setReview({ ...review, [key]: e.target.value });
                    setDirty(true);
                  }}
                  placeholder={
                    [
                      "A breakthrough, a small win, or a day you showed up.",
                      "Time, energy, a routine that needs rethinking…",
                      "Keep it specific and kind to your future self.",
                    ][i]
                  }
                />
              </label>
            ))}
            <div>
              <span className="field-label">How was your energy?</span>
              <div
                className="energy-picker"
                role="group"
                aria-label="Weekly energy"
              >
                {["Depleted", "Low", "Steady", "Good", "Energized"].map(
                  (label, i) => (
                    <button
                      key={label}
                      aria-pressed={review.energy === i + 1}
                      type="button"
                      className={review.energy === i + 1 ? "selected" : ""}
                      onClick={() => {
                        setReview({ ...review, energy: i + 1 });
                        setDirty(true);
                      }}
                    >
                      <strong>{i + 1}</strong>
                      <span>{label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="form-actions">
              <span className="subtle">
                {dirty
                  ? "Unsaved reflection"
                  : data.reviews[week]
                    ? "Reflection saved"
                    : "Not saved yet"}
              </span>
              <button className="primary" disabled={busy}>
                Save reflection
              </button>
            </div>
          </form>
        </section>
        <aside className="panel balance-panel">
          <h2>A balanced practice.</h2>
          <p>Your scheduled consistency by area.</p>
          {categories.map((c) => {
            const st = stats(
              data,
              data.habits.filter((h) => h.category === c),
              week,
              end,
            );
            return (
              <div className="balance-row" key={c}>
                <div>
                  <CatIcon category={c} />
                  <strong>{c}</strong>
                  <span>
                    {st.done}/{st.due}
                  </span>
                </div>
                <Meter value={st.percent} />
              </div>
            );
          })}
          <div className="review-comparison">
            <TrendingUp size={20} />
            <p>
              {prior.due
                ? `Last week: ${prior.percent}% consistency across ${prior.due} scheduled habits. ${week === weekStart(today) ? "This week is still in progress." : ""}`
                : "Your weekly story starts here. Check in throughout the week to see what’s working."}
            </p>
          </div>
          <div className="review-table">
            {data.habits
              .filter((h) => dateRange(week, end).some((d) => scheduled(h, d)))
              .map((h) => {
                const st = stats(data, [h], week, end);
                return (
                  <div key={h.id}>
                    <span>{h.name}</span>
                    <strong>
                      {st.done}/{st.due}
                    </strong>
                  </div>
                );
              })}
          </div>
        </aside>
      </div>
    </>
  );
}
function ProfileSettings({
  data,
  busy,
  save,
}: {
  data: State;
  busy: boolean;
  save: (s: State) => Promise<boolean>;
}) {
  const [name, setName] = useState(data.name),
    [timezone, setTimezone] = useState(data.timezone);
  return (
    <section className="panel profile-settings">
      <h2>Your preferences</h2>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            new Intl.DateTimeFormat("en", { timeZone: timezone });
          } catch {
            toast.error("Enter a valid timezone, e.g. America/Denver.");
            return;
          }
          if (await save({ ...data, name: name.trim(), timezone }))
            toast.success("Preferences saved");
        }}
      >
        <label>
          Your name
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Timezone
          <input
            required
            maxLength={80}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            list="timezones"
          />
          <datalist id="timezones">
            {[
              "America/Denver",
              "America/New_York",
              "America/Chicago",
              "America/Los_Angeles",
              "Asia/Kathmandu",
              "Europe/London",
              "UTC",
            ].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <p className="form-hint">
          Days end at midnight here. Existing check-in dates stay the same if
          you change it.
        </p>
        <button disabled={busy} className="secondary">
          Save preferences
        </button>
      </form>
    </section>
  );
}
