import { describe, it, expect } from "vitest";
import {
  classify,
  daysUntil,
  pickMatterDeadline,
  urgencyLabel,
  urgencyPalette,
} from "../deadline-urgency";

const ONE_DAY = 86_400_000;

function isoDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * ONE_DAY);
  return d.toISOString().slice(0, 10);
}

describe("daysUntil", () => {
  it("returns 0 when the deadline is today (UTC midnight anchored)", () => {
    const today = new Date();
    expect(daysUntil(today, today)).toBe(0);
  });

  it("returns positive integers for future dates", () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    const future = new Date(Date.UTC(2026, 0, 11));
    expect(daysUntil(future, now)).toBe(10);
  });

  it("returns negative integers for past dates (overdue)", () => {
    const now = new Date(Date.UTC(2026, 0, 11));
    const past = new Date(Date.UTC(2026, 0, 4));
    expect(daysUntil(past, now)).toBe(-7);
  });

  it("ignores time-of-day so a 23h difference doesn't hop a day bucket", () => {
    const now = new Date(Date.UTC(2026, 0, 1, 23, 0, 0));
    const same = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(daysUntil(same, now)).toBe(0);
  });
});

describe("classify", () => {
  it("buckets by the 0/7/30 day thresholds", () => {
    expect(classify(null)).toBe("none");
    expect(classify(-1)).toBe("overdue");
    expect(classify(-90)).toBe("overdue");
    expect(classify(0)).toBe("critical");
    expect(classify(7)).toBe("critical");
    expect(classify(8)).toBe("warning");
    expect(classify(30)).toBe("warning");
    expect(classify(31)).toBe("ok");
    expect(classify(365)).toBe("ok");
  });
});

describe("pickMatterDeadline", () => {
  it("returns urgency 'none' when no deadline fields are set", () => {
    const result = pickMatterDeadline({});
    expect(result.urgency).toBe("none");
    expect(result.date).toBeNull();
    expect(result.label).toBeNull();
    expect(result.daysRemaining).toBeNull();
  });

  it("picks the limitation date when only it is set", () => {
    const result = pickMatterDeadline({ limitationDate: isoDaysFromNow(20) });
    expect(result.label).toBe("Limitation date");
    expect(result.urgency).toBe("warning");
    expect(result.daysRemaining).toBe(20);
  });

  it("picks the most-imminent deadline among multiple set fields", () => {
    // Limitation date 60d out, but a procedural deadline 5d out beats it.
    const result = pickMatterDeadline({
      limitationDate: isoDaysFromNow(60),
      nextDeadline: isoDaysFromNow(5),
      nextDeadlineLabel: "Discovery cutoff",
    });
    expect(result.label).toBe("Discovery cutoff");
    expect(result.urgency).toBe("critical");
    expect(result.daysRemaining).toBe(5);
  });

  it("surfaces an overdue deadline rather than hiding it", () => {
    const result = pickMatterDeadline({ limitationDate: isoDaysFromNow(-3) });
    expect(result.urgency).toBe("overdue");
    expect(result.daysRemaining).toBe(-3);
  });

  it("uses the certification date when present", () => {
    const result = pickMatterDeadline({ certificationDate: isoDaysFromNow(2) });
    expect(result.label).toBe("Certification");
    expect(result.urgency).toBe("critical");
  });
});

describe("urgencyLabel", () => {
  it("formats overdue / today / tomorrow / general future correctly", () => {
    expect(
      urgencyLabel({ date: "x", label: "x", daysRemaining: -3, urgency: "overdue" }),
    ).toBe("Overdue 3d");
    expect(
      urgencyLabel({ date: "x", label: "x", daysRemaining: 0, urgency: "critical" }),
    ).toBe("Due today");
    expect(
      urgencyLabel({ date: "x", label: "x", daysRemaining: 1, urgency: "critical" }),
    ).toBe("Due tomorrow");
    expect(
      urgencyLabel({ date: "x", label: "x", daysRemaining: 14, urgency: "warning" }),
    ).toBe("Due in 14d");
    expect(
      urgencyLabel({ date: null, label: null, daysRemaining: null, urgency: "none" }),
    ).toBe("No deadline");
  });
});

describe("urgencyPalette", () => {
  it("returns distinct Tailwind class strings per urgency", () => {
    const tones = ["overdue", "critical", "warning", "ok", "none"] as const;
    const seen = new Set<string>();
    for (const t of tones) {
      const p = urgencyPalette(t);
      const sig = `${p.bg}|${p.text}|${p.border}`;
      expect(seen.has(sig)).toBe(false);
      seen.add(sig);
    }
  });
});
