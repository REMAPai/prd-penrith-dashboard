// @vitest-environment jsdom
import "@tests/helpers/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => {
  const maps: { opts: Record<string, unknown>; removed: boolean }[] = [];
  const markers: { element: HTMLElement; lngLat?: [number, number] }[] = [];
  return { maps, markers, setWorkerUrl: vi.fn() };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: gl.setWorkerUrl,
  Map: class {
    state = { removed: false };
    constructor(public opts: Record<string, unknown>) {
      gl.maps.push(this as unknown as (typeof gl.maps)[number]);
    }
    addControl() {}
    remove() {
      (this as unknown as { removed: boolean }).removed = true;
    }
  },
  NavigationControl: class {},
  Marker: class {
    rec: { element: HTMLElement; lngLat?: [number, number] };
    constructor(o: { element: HTMLElement }) {
      this.rec = { element: o.element };
      gl.markers.push(this.rec);
    }
    setLngLat(p: [number, number]) {
      this.rec.lngLat = p;
      return this;
    }
    addTo() {
      return this;
    }
    getElement() {
      return this.rec.element;
    }
  },
}));

import MapView from "@/components/MapView";

const props = {
  center: [-33.75, 150.7] as [number, number],
  sites: [
    { id: 1, address: "84 Cox Avenue", suburb: "Penrith", stage: 0, stageName: "Detected", color: "#8a8f9c", lat: -33.75, lng: 150.69, sample: false },
    { id: 2, address: "9 Sample St", suburb: "St Marys", stage: 4, stageName: "Negotiation", color: "#e41e26", lat: -33.76, lng: 150.77, sample: true },
  ],
  demand: [{ suburb: "Penrith", lat: -33.75, lng: 150.69, count: 4 }],
  listings: [{ id: "l1", address: "1 Real St", lat: -33.74, lng: 150.7 }],
};

describe("MapView", () => {
  it("creates one map centred on the given point (lng, lat order) and registers the worker", () => {
    gl.maps.length = 0;
    render(<MapView {...props} />);
    expect(gl.maps).toHaveLength(1);
    expect(gl.maps[0].opts.center).toEqual([150.7, -33.75]);
  });

  it("draws a marker per site, demand suburb and listing, in lng/lat order", () => {
    gl.markers.length = 0;
    render(<MapView {...props} />);
    expect(gl.markers).toHaveLength(4);
    const site = gl.markers.find((m) => m.element.title.startsWith("84 Cox"))!;
    expect(site.lngLat).toEqual([150.69, -33.75]);
    expect((site.element as HTMLAnchorElement).getAttribute("href")).toBe("/pipeline?tab=board&site=1");
    expect(gl.markers.find((m) => m.element.title.includes("Sample St"))!.element.title).toContain("sample");
    expect(gl.markers.find((m) => m.element.title === "Penrith: 4 enquiries")!.element.textContent).toBe("4");
    expect(gl.markers.find((m) => m.element.title === "Listing: 1 Real St")).toBeDefined();
  });

  it("layer buttons hide and show their markers", async () => {
    gl.markers.length = 0;
    render(<MapView {...props} />);
    const site = gl.markers.find((m) => m.element.title.startsWith("84 Cox"))!.element;
    const btn = screen.getByRole("button", { name: "Sites" });
    expect(btn).toHaveClass("on");
    await act(async () => fireEvent.click(btn));
    expect(site.style.display).toBe("none");
    expect(btn).not.toHaveClass("on");
    await act(async () => fireEvent.click(btn));
    expect(site.style.display).toBe("");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Listings" })));
    expect(gl.markers.find((m) => m.element.title.startsWith("Listing"))!.element.style.display).toBe("none");
  });

  it("handles an empty data set and removes the map on unmount", () => {
    gl.maps.length = 0;
    const { unmount } = render(<MapView {...props} sites={[]} demand={[]} listings={[]} />);
    unmount();
    expect(gl.maps[0].removed).toBe(true);
  });
});

describe("MapLoader", () => {
  it("loads the map lazily with server rendering disabled", async () => {
    vi.resetModules();
    const dynamic = vi.fn<(loader: unknown, opts: unknown) => () => null>(() => () => null);
    vi.doMock("next/dynamic", () => ({ default: dynamic }));
    await import("@/components/MapLoader");
    expect(dynamic).toHaveBeenCalledTimes(1);
    expect(dynamic.mock.calls[0][1]).toMatchObject({ ssr: false });
  });
});
