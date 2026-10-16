import { describe, expect, it } from "vitest";
import { renderPage } from "@tests/helpers/render";
import Loading from "@/app/(app)/buyer/loading";
import DetailLoading from "@/app/(app)/buyer/[id]/loading";

describe("buyer loading states", () => {
  it("the list shows an accessible placeholder while it loads", async () => {
    const html = await renderPage(Loading as never);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading buyers");
    expect(html).toContain("skel");
  });
  it("the buyer page shows an accessible placeholder while it loads", async () => {
    const html = await renderPage(DetailLoading as never);
    expect(html).toContain("Loading buyer");
  });
});
