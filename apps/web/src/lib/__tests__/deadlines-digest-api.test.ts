import { describe, it, expect, beforeEach } from "vitest";
import { GET as digestGet } from "../../app/api/digests/deadlines/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";

const ONE_DAY = 86_400_000;
function isoDaysFromNow(days: number): Date {
  return new Date(Date.now() + days * ONE_DAY);
}

describe("GET /api/digests/deadlines", () => {
  let store: InMemoryMatterStore;

  beforeEach(() => {
    store = new InMemoryMatterStore();
    setMatterStore(store);
  });

  async function call(query = ""): Promise<{
    items: Array<{
      matterId: string;
      matterTitle: string;
      daysRemaining: number;
      urgency: string;
    }>;
    count: number;
    windowDays: number;
    includeOverdue: boolean;
  }> {
    const req = new Request(`http://localhost/api/digests/deadlines${query}`);
    const res = await digestGet(req as unknown as Parameters<typeof digestGet>[0]);
    expect(res.status).toBe(200);
    return res.json() as Promise<{
      items: Array<{
        matterId: string;
        matterTitle: string;
        daysRemaining: number;
        urgency: string;
      }>;
      count: number;
      windowDays: number;
      includeOverdue: boolean;
    }>;
  }

  it("returns an empty digest when no matters have deadlines", async () => {
    await store.create({
      title: "Plain Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const body = await call();
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
    expect(body.windowDays).toBe(30);
  });

  it("includes only deadlines within the window (default 30d)", async () => {
    await store.create({
      title: "Soon",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(10),
      nextDeadlineLabel: "Discovery",
    });
    await store.create({
      title: "Far",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(120),
      nextDeadlineLabel: "Trial",
    });
    const body = await call();
    expect(body.count).toBe(1);
    expect(body.items[0]!.matterTitle).toBe("Soon");
  });

  it("respects ?days= override and clamps to [1, 365]", async () => {
    await store.create({
      title: "180-day matter",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(180),
      nextDeadlineLabel: "Cert hearing",
    });
    const within = await call("?days=200");
    expect(within.windowDays).toBe(200);
    expect(within.count).toBe(1);
    const huge = await call("?days=99999");
    expect(huge.windowDays).toBe(365);
    const tiny = await call("?days=0");
    expect(tiny.windowDays).toBe(1);
  });

  it("excludes overdue matters by default but includes them with ?include=overdue", async () => {
    await store.create({
      title: "Missed limit",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      limitationDate: isoDaysFromNow(-3),
    });
    const without = await call();
    expect(without.count).toBe(0);
    const withOverdue = await call("?include=overdue");
    expect(withOverdue.count).toBe(1);
    expect(withOverdue.items[0]!.urgency).toBe("overdue");
    expect(withOverdue.items[0]!.daysRemaining).toBe(-3);
  });

  it("sorts most-urgent first (overdue, then ascending days remaining)", async () => {
    await store.create({
      title: "B",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(15),
      nextDeadlineLabel: "x",
    });
    await store.create({
      title: "A",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(3),
      nextDeadlineLabel: "x",
    });
    await store.create({
      title: "C",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      limitationDate: isoDaysFromNow(-1),
    });
    const body = await call("?include=overdue");
    expect(body.items.map((i) => i.matterTitle)).toEqual(["C", "A", "B"]);
  });

  it("excludes archived matters even when they have a soon deadline", async () => {
    const m = await store.create({
      title: "Archived",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: isoDaysFromNow(2),
      nextDeadlineLabel: "x",
    });
    await store.updateStatus(m.id, "archived");
    const body = await call();
    expect(body.count).toBe(0);
  });
});
