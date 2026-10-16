import { describe, expect, it } from "vitest";
import { CLAIM_WINDOW_MINUTES, claimSchema, msgHash, turnSchema } from "@/lib/data/ingest";

const validTurn = { conversationId: "c-1", turn: 1, buyerAt: "2026-10-01T01:00:00+10:00" };

describe("msgHash", () => {
  it("is stable and ignores case, surrounding space and repeated whitespace", () => {
    expect(msgHash("Is this still available?")).toBe(msgHash("  is   THIS still\navailable? "));
  });

  it("differs for different messages and handles the empty string", () => {
    expect(msgHash("a")).not.toBe(msgHash("b"));
    expect(msgHash("")).toBe((5381).toString(36));
  });

  it("returns a short base-36 string", () => {
    expect(msgHash("Postcode: 2148")).toMatch(/^[0-9a-z]+$/);
  });
});

describe("claimSchema", () => {
  it("requires a conversation id and defaults the message to empty", () => {
    expect(claimSchema.parse({ conversationId: "c" })).toEqual({ conversationId: "c", message: "" });
    expect(claimSchema.safeParse({}).success).toBe(false);
    expect(claimSchema.safeParse({ conversationId: "" }).success).toBe(false);
  });

  it("bounds the sizes", () => {
    expect(claimSchema.safeParse({ conversationId: "x".repeat(201) }).success).toBe(false);
    expect(claimSchema.safeParse({ conversationId: "c", message: "m".repeat(4001) }).success).toBe(false);
  });
});

describe("turnSchema", () => {
  it("accepts a minimal turn and fills safe defaults", () => {
    const t = turnSchema.parse(validTurn);
    expect(t).toMatchObject({ temperature: "New", inspection: "not_discussed", wantsContract: false, readyForAgent: false, handoffStatus: "none", slaDueAt: null, replyAt: null, buyer: "", phone: "" });
  });

  it("rejects missing or malformed identifiers, turn numbers and timestamps", () => {
    for (const bad of [{ ...validTurn, conversationId: "" }, { ...validTurn, turn: 0 }, { ...validTurn, turn: 501 }, { ...validTurn, turn: 1.5 }, { ...validTurn, buyerAt: "yesterday" }, { ...validTurn, buyerAt: "2026-10-01T01:00:00" }, { conversationId: "c" }]) {
      expect(turnSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("only accepts known temperatures and handoff states", () => {
    expect(turnSchema.safeParse({ ...validTurn, temperature: "Boiling" }).success).toBe(false);
    expect(turnSchema.safeParse({ ...validTurn, handoffStatus: "maybe" }).success).toBe(false);
    for (const t of ["Hot", "Warm", "New"]) expect(turnSchema.safeParse({ ...validTurn, temperature: t }).success).toBe(true);
    for (const h of ["none", "pending", "done"]) expect(turnSchema.safeParse({ ...validTurn, handoffStatus: h }).success).toBe(true);
  });

  it("limits free-text fields to 4000 characters", () => {
    expect(turnSchema.safeParse({ ...validTurn, buyerMessage: "x".repeat(4001) }).success).toBe(false);
    expect(turnSchema.safeParse({ ...validTurn, buyerMessage: "x".repeat(4000) }).success).toBe(true);
  });

  it("accepts an SLA due time with an offset and a reply time", () => {
    const t = turnSchema.parse({ ...validTurn, slaDueAt: "2026-10-01T02:00:00Z", replyAt: "2026-10-01T01:01:00+10:00" });
    expect(t.slaDueAt).toBe("2026-10-01T02:00:00Z");
  });

  it("uses a ten minute duplicate window", () => {
    expect(CLAIM_WINDOW_MINUTES).toBe(10);
  });
});
