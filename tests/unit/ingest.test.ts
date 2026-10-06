import { describe, expect, it } from "vitest";
import { claimSchema, msgHash, turnSchema } from "../../src/lib/data/ingest";

describe("msgHash", () => {
  it("ignores case and spacing so duplicate triggers match", () => {
    expect(msgHash("  Hi   There ")).toBe(msgHash("hi there"));
  });
  it("differs for different text", () => {
    expect(msgHash("yes please")).not.toBe(msgHash("no thanks"));
  });
});

describe("claimSchema", () => {
  it("requires a conversation id", () => {
    expect(claimSchema.safeParse({ message: "hi" }).success).toBe(false);
    expect(claimSchema.safeParse({ conversationId: "vault_1", message: "hi" }).success).toBe(true);
  });
});

describe("turnSchema", () => {
  const base = { conversationId: "vault_1", turn: 1, buyerAt: "2026-10-06T01:00:00.000Z" };
  it("fills safe defaults", () => {
    const r = turnSchema.parse(base);
    expect(r.readyForAgent).toBe(false);
    expect(r.handoffStatus).toBe("none");
    expect(r.temperature).toBe("New");
  });
  it("rejects bad temperature and bad dates", () => {
    expect(turnSchema.safeParse({ ...base, temperature: "Boiling" }).success).toBe(false);
    expect(turnSchema.safeParse({ ...base, buyerAt: "yesterday" }).success).toBe(false);
  });
});
