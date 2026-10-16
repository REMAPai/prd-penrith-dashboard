import { describe, expect, it } from "vitest";
import { initials } from "@/lib/buyer-display";

describe("initials", () => {
  it("takes the first letters of the first two words, in capitals", () => {
    expect(initials("Rachel M.")).toBe("RM");
    expect(initials("anastasia gouveia")).toBe("AG");
    expect(initials("Jean Luc Picard")).toBe("JL");
  });
  it("handles one word, extra spaces and punctuation", () => {
    expect(initials("Priya")).toBe("P");
    expect(initials("  Mei   Ling ")).toBe("ML");
    expect(initials("(Dan) K.")).toBe("DK");
  });
  it("falls back to a question mark when there is no name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
    expect(initials("123 ...")).toBe("?");
  });
});
