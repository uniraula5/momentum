import { z } from "zod";
import { dateKey } from "./tracker";
const day = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((s) => !["__proto__", "constructor", "prototype"].includes(s));
const category = z.enum(["Learning", "Career", "Training", "Wellbeing"]);
const amount = z.number().finite().min(0).max(1000000);
const plan = z
  .object({
    from: day,
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((a) => new Set(a).size === a.length),
    target: amount.refine((n) => n > 0),
    unit: z.string().trim().min(1).max(24),
  })
  .strict();
export const stateSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    timezone: z
      .string()
      .max(80)
      .refine((s) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: s });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone"),
    habits: z
      .array(
        z
          .object({
            id,
            name: z.string().trim().min(1).max(80),
            category,
            description: z.string().max(300),
            created: day,
            archived: day.nullable(),
            plans: z.array(plan).min(1).max(200),
          })
          .strict(),
      )
      .max(80),
    entries: z.record(
      id,
      z.record(
        day,
        z
          .object({
            value: amount,
            note: z.string().max(2000),
            rest: z.boolean(),
          })
          .strict(),
      ),
    ),
    goals: z
      .array(
        z
          .object({
            id,
            name: z.string().trim().min(1).max(100),
            category,
            target: amount.refine((n) => n > 0),
            current: amount,
            unit: z.string().trim().min(1).max(30),
            due: z.union([day, z.literal("")]),
          })
          .strict(),
      )
      .max(100),
    reviews: z.record(
      day,
      z
        .object({
          win: z.string().max(3000),
          friction: z.string().max(3000),
          next: z.string().max(3000),
          energy: z.number().int().min(1).max(5),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((s, ctx) => {
    const today = dateKey(new Date(), s.timezone);
    const ids = new Set(s.habits.map((h) => h.id));
    if (
      ids.size !== s.habits.length ||
      new Set(s.goals.map((g) => g.id)).size !== s.goals.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate IDs" });
    for (const h of s.habits) {
      if (
        h.created > today ||
        h.plans[0].from !== h.created ||
        (h.archived && h.archived < h.created)
      )
        ctx.addIssue({ code: "custom", message: "Invalid habit dates" });
      if (h.plans.some((p, i) => i > 0 && p.from <= h.plans[i - 1].from))
        ctx.addIssue({
          code: "custom",
          message: "Schedule history must be ordered",
        });
    }
    for (const [hid, entries] of Object.entries(s.entries)) {
      const h = s.habits.find((h) => h.id === hid);
      if (!h) {
        ctx.addIssue({ code: "custom", message: "Unknown habit" });
        continue;
      }
      for (const [d, e] of Object.entries(entries))
        if (d > today || d < h.created || (e.rest && e.value !== 0))
          ctx.addIssue({
            code: "custom",
            message: "Invalid entry date or recovery amount",
          });
    }
  });
