import { describe, expect, it } from "vitest";
import { conversationDays, conversationsOnDay, dayLabel, sydneyDay, timeLabel, turnsOnDay } from "@/lib/buyer-days";
import { convo, turn } from "@tests/helpers/conversation";

describe("sydneyDay", () => {
  it("uses the Sydney calendar day (daylight time in October), not UTC", () => {
    expect(sydneyDay("2026-10-15T13:30:00.000Z")).toBe("2026-10-16");
    expect(sydneyDay("2026-10-16T12:59:00.000Z")).toBe("2026-10-16");
    expect(sydneyDay("2026-10-16T13:00:00.000Z")).toBe("2026-10-17");
  });
  it("labels days and times for the page", () => {
    expect(dayLabel("2026-10-16")).toBe("16 Oct");
    expect(timeLabel("2026-10-16T04:41:00.000Z")).toMatch(/3:41\s?pm/i);
  });
});

describe("day tabs", () => {
  const a = convo({ conversationId: "a" }, [turn("Hi", "Hello", "2026-10-15T13:30:00.000Z"), turn("Later", "Ok", "2026-10-16T05:00:00.000Z")]);
  const b = convo({ conversationId: "b" }, [turn("Hi", "Hello", "2026-10-14T01:00:00.000Z")]);

  it("lists every day with a buyer message, newest first, once each", () => {
    expect(conversationDays([a, b])).toEqual(["2026-10-16", "2026-10-14"]);
  });

  it("a day tab holds only the buyers who wrote that day", () => {
    expect(conversationsOnDay([a, b], "2026-10-16").map((x) => x.c.conversationId)).toEqual(["a"]);
    expect(conversationsOnDay([a, b], "2026-10-14").map((x) => x.c.conversationId)).toEqual(["b"]);
    expect(conversationsOnDay([a, b], "2026-10-13")).toEqual([]);
  });

  it("a buyer who writes on two days appears on both, with that day's messages", () => {
    const c = convo({ conversationId: "c" }, [turn("Day one", "R1", "2026-10-14T01:00:00.000Z"), turn("Day two", "R2", "2026-10-15T01:00:00.000Z")]);
    expect(conversationsOnDay([c], "2026-10-14")).toHaveLength(1);
    expect(conversationsOnDay([c], "2026-10-15")).toHaveLength(1);
    expect(turnsOnDay(c, "2026-10-15").map((t) => t.buyer)).toEqual(["Day two"]);
  });

  it("orders buyers within a day oldest first", () => {
    const early = convo({ conversationId: "early" }, [turn("x", "y", "2026-10-16T00:10:00.000Z")]);
    const late = convo({ conversationId: "late" }, [turn("x", "y", "2026-10-16T03:10:00.000Z")]);
    expect(conversationsOnDay([late, early], "2026-10-16").map((x) => x.c.conversationId)).toEqual(["early", "late"]);
  });
});
