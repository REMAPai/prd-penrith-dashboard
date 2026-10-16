// @vitest-environment jsdom
import "@tests/helpers/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Ctx } from "@/lib/ctx";
import { makeCtx } from "@tests/helpers/fixtures";
import { resolveTree } from "@tests/helpers/render";

const ctxMock = vi.hoisted(() => ({ getCtx: vi.fn<() => Promise<Ctx | null>>() }));
vi.mock("@/lib/ctx", () => ctxMock);

import { Badge, Bars, Card, Cols, Denied, Drawer, Kpi, Notice, PageHeader, StatusBadge, Tabs, fmtDate } from "@/components/ui";

const draw = async (node: React.ReactNode) => render((await resolveTree(node)) as React.ReactElement);
const liveOnly = (on: boolean) => ctxMock.getCtx.mockResolvedValue(makeCtx("platform_admin", { liveOnly: on }));

describe("StatusBadge", () => {
  it("labels each status from the shared label table", () => {
    const { rerender } = render(<StatusBadge status="waiting" />);
    expect(screen.getByText("Waiting on access")).toHaveClass("badge", "b-waiting");
    rerender(<StatusBadge status="sample" />);
    expect(screen.getByText("Sample data")).toHaveClass("b-sample");
    rerender(<StatusBadge status="prototype" />);
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    rerender(<StatusBadge status="planned" />);
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("shows a pulsing dot only for live", () => {
    const { container, rerender } = render(<StatusBadge status="live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(container.querySelector(".pulse-dot.live")).not.toBeNull();
    rerender(<StatusBadge status="sample" />);
    expect(container.querySelector(".pulse-dot")).toBeNull();
  });

  it("accepts a custom label and the extra tones", () => {
    render(<StatusBadge status="red" label="Hot" />);
    expect(screen.getByText("Hot")).toHaveClass("b-red");
    render(<StatusBadge status="done" />);
    expect(screen.getByText("done")).toHaveClass("b-done");
  });
});

describe("Badge and PageHeader", () => {
  it("Badge applies its tone class (grey by default)", () => {
    render(<><Badge>One</Badge><Badge tone="red">Two</Badge></>);
    expect(screen.getByText("One")).toHaveClass("b-grey");
    expect(screen.getByText("Two")).toHaveClass("b-red");
  });

  it("PageHeader shows title, status, subtitle and actions", () => {
    render(<PageHeader title="Buyers" status="live" sub="Sub line" actions={<button>Act</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Buyers" })).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Sub line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("shows the SAMPLE DATA ribbon and footnote for sample widgets, with no source line", async () => {
    liveOnly(false);
    await draw(<Card status="sample" title="Fin" source="Invented">body</Card>);
    expect(screen.getByText("SAMPLE DATA")).toHaveClass("ribbon");
    expect(screen.getByText("Sample data: not PRD figures")).toBeInTheDocument();
    expect(screen.queryByText(/Source:/)).toBeNull();
  });

  it("live widgets get no ribbon, no status badge, and show their source", async () => {
    liveOnly(false);
    await draw(<Card title="Real" source="Postgres">body</Card>);
    expect(screen.queryByText("SAMPLE DATA")).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.getByText("Source: Postgres")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Real" })).toBeInTheDocument();
  });

  it("prototype and waiting widgets show their badge and no source line", async () => {
    liveOnly(false);
    await draw(<Card status="prototype" title="Proto" source="X">body</Card>);
    expect(screen.getByText("Prototype")).toHaveClass("badge");
    expect(screen.queryByText(/Source:/)).toBeNull();
    expect(screen.queryByText("SAMPLE DATA")).toBeNull();
  });

  it("renders the subtitle, note, class and flex basis", async () => {
    liveOnly(false);
    const { container } = await draw(<Card title="T" sub="Sub" note="Heads up" basis="380px" className="extra">x</Card>);
    expect(screen.getByText("Sub")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toHaveClass("notice");
    const card = container.querySelector(".card")!;
    expect(card).toHaveClass("extra");
    expect(card).toHaveStyle({ flex: "1 1 380px" });
  });

  it("is hidden in Live only mode unless it is live", async () => {
    liveOnly(true);
    for (const status of ["sample", "prototype", "waiting", "planned"] as const) {
      const { container, unmount } = await draw(<Card status={status} title="Hidden">x</Card>);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    await draw(<Card status="live" title="Shown">x</Card>);
    expect(screen.getByText("Shown")).toBeInTheDocument();
  });

  it("is shown when signed out of context (null ctx), treating it as not live-only", async () => {
    ctxMock.getCtx.mockResolvedValue(null);
    await draw(<Card status="sample" title="Anon">x</Card>);
    expect(screen.getByText("SAMPLE DATA")).toBeInTheDocument();
  });
});

describe("Kpi", () => {
  it("shows label, value and a status caption", async () => {
    liveOnly(false);
    await draw(<Kpi label="Hot buyers" value={7} />);
    expect(screen.getByText("Hot buyers")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it.each([
    ["sample", "Sample data"],
    ["waiting", "Waiting on access"],
    ["prototype", "Prototype"],
    ["planned", "Planned"],
  ] as const)("captions %s as %s", async (status, text) => {
    liveOnly(false);
    await draw(<Kpi label="L" value="1" status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("hides non-live KPIs in Live only mode", async () => {
    liveOnly(true);
    const { container } = await draw(<Kpi label="L" value="1" status="sample" />);
    expect(container).toBeEmptyDOMElement();
    await draw(<Kpi label="Real" value="2" />);
    expect(screen.getByText("Real")).toBeInTheDocument();
  });
});

describe("Bars and Cols", () => {
  it("Bars scale to the largest value or to an explicit max", () => {
    const { container, rerender } = render(<Bars items={[{ label: "A", value: 10 }, { label: "B", value: 5 }, { label: "C", value: 0 }]} />);
    const widths = () => [...container.querySelectorAll<HTMLElement>(".fill")].map((f) => f.style.width);
    expect(widths()).toEqual(["100%", "50%", "0%"]);
    rerender(<Bars max={20} items={[{ label: "A", value: 10 }]} />);
    expect(widths()).toEqual(["50%"]);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("Bars tolerates an empty list", () => {
    const { container } = render(<Bars items={[]} />);
    expect(container.querySelectorAll(".bar-row")).toHaveLength(0);
  });

  it("Cols draws a minimum bar of 4px and a 130px tallest bar, with the value as tooltip", () => {
    const { container } = render(<Cols items={[{ label: "W1", value: 10 }, { label: "W2", value: 0 }]} />);
    const bars = [...container.querySelectorAll<HTMLElement>("i")].map((i) => i.style.height);
    expect(bars).toEqual(["130px", "4px"]);
    expect(container.querySelector('[title="10"]')).not.toBeNull();
    expect(screen.getByText("W2")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("links each tab with the query parameter and marks the current one", () => {
    render(<Tabs base="/buyer" current="funnel" tabs={[["conversations", "Conversations"], ["funnel", "Funnel"]]} />);
    expect(screen.getByRole("link", { name: "Conversations" })).toHaveAttribute("href", "/buyer?tab=conversations");
    expect(screen.getByRole("link", { name: "Funnel" })).toHaveClass("on");
    expect(screen.getByRole("link", { name: "Conversations" })).not.toHaveClass("on");
  });

  it("supports a custom parameter name", () => {
    render(<Tabs base="/x" param="view" current="a" tabs={[["a", "A"]]} />);
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("href", "/x?view=a");
  });
});

describe("Denied, Notice and Drawer", () => {
  it("Denied explains there is no access", () => {
    render(<Denied />);
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.getByText("Your role does not include this page.")).toBeInTheDocument();
  });

  it("Notice wraps its content", () => {
    render(<Notice>Careful</Notice>);
    expect(screen.getByText("Careful")).toHaveClass("notice");
  });

  it("Drawer shows title, subtitle, badges, content and two ways to close", () => {
    render(<Drawer title="84 Cox Avenue" sub="Penrith" closeHref="/pipeline?tab=board" badges={<Badge>Tag</Badge>}><p>Inside</p></Drawer>);
    expect(screen.getByText("84 Cox Avenue")).toBeInTheDocument();
    expect(screen.getByText("Penrith")).toBeInTheDocument();
    expect(screen.getByText("Tag")).toBeInTheDocument();
    expect(screen.getByText("Inside")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toHaveAttribute("href", "/pipeline?tab=board");
    expect(screen.getAllByRole("link", { name: "Close" })).toHaveLength(2);
  });
});

describe("fmtDate", () => {
  it("formats in Sydney time", () => {
    expect(fmtDate("2026-10-01T00:30:00Z")).toMatch(/1 Oct,? 10:30\s?am/i);
  });
  it("returns an empty string for missing values", () => {
    expect(fmtDate(null)).toBe("");
    expect(fmtDate(undefined)).toBe("");
    expect(fmtDate("")).toBe("");
  });
  it("accepts Date objects", () => {
    expect(fmtDate(new Date("2026-01-15T03:00:00Z"))).toMatch(/15 Jan/);
  });
});
