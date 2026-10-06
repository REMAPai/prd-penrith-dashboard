// @vitest-environment jsdom
import "@tests/helpers/dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ usePathname: vi.fn(() => "/") }));
const actions = vi.hoisted(() => ({ setLiveOnly: vi.fn(), setScope: vi.fn(), passwordLogin: vi.fn() }));
vi.mock("next/navigation", () => nav);
vi.mock("@/app/(app)/actions", () => ({ setLiveOnly: actions.setLiveOnly, setScope: actions.setScope }));
vi.mock("@/app/login/actions", () => ({ passwordLogin: actions.passwordLogin }));

import { NavLink } from "@/components/NavLink";
import { Planned } from "@/components/Planned";
import { LiveToggle, ScopeSelect } from "@/components/TopControls";
import LoginForm from "@/app/login/LoginForm";

describe("NavLink", () => {
  it("links to the page and highlights it when it is the current path", () => {
    nav.usePathname.mockReturnValue("/buyer");
    render(<NavLink href="/buyer" label="Buyer Sequencing" status="live" />);
    const link = screen.getByRole("link", { name: /Buyer Sequencing/ });
    expect(link).toHaveAttribute("href", "/buyer");
    expect(link).toHaveClass("item", "on");
    expect(link.querySelector(".dot")).toHaveClass("d-live");
    expect(link.querySelector(".dot")).toHaveAttribute("title", "live");
  });

  it("is not highlighted on another path", () => {
    nav.usePathname.mockReturnValue("/progress");
    render(<NavLink href="/buyer" label="Buyer" status="sample" />);
    expect(screen.getByRole("link")).not.toHaveClass("on");
    expect(screen.getByRole("link").querySelector(".dot")).toHaveClass("d-sample");
  });
});

describe("Planned", () => {
  it("lists what the user will get, the timing and a feedback link", () => {
    render(<Planned title="Commercial" lead="Coming next" gets={["One", "Two"]} when="Later" />);
    expect(screen.getByRole("heading", { name: "Commercial" })).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Coming next")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(["One", "Two"]);
    expect(screen.getByText("Timing: Later.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tell us this is a priority" })).toHaveAttribute("href", "/feedback");
  });
});

describe("LiveToggle", () => {
  it("marks the active mode", () => {
    const { rerender } = render(<LiveToggle liveOnly={false} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Live only" })).not.toHaveClass("on");
    rerender(<LiveToggle liveOnly />);
    expect(screen.getByRole("button", { name: "Live only" })).toHaveClass("on");
  });

  it("calls the server action with the chosen mode", async () => {
    render(<LiveToggle liveOnly={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Live only" })));
    expect(actions.setLiveOnly).toHaveBeenCalledWith(true);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "All" })));
    expect(actions.setLiveOnly).toHaveBeenLastCalledWith(false);
  });
});

describe("ScopeSelect", () => {
  it("shows a plain label when there is only one branch", () => {
    render(<ScopeSelect branches={[{ id: "pen", name: "Penrith" }]} current="pen" />);
    expect(screen.getByText("Penrith")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows a selector for several branches and calls setScope on change", async () => {
    render(<ScopeSelect branches={[{ id: "pen", name: "Penrith" }, { id: "bm", name: "Blue Mountains" }]} current="pen" />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("pen");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Penrith", "Blue Mountains"]);
    await act(async () => fireEvent.change(select, { target: { value: "bm" } }));
    expect(actions.setScope).toHaveBeenCalledWith("bm");
  });

  it("renders an empty label with no branches", () => {
    const { container } = render(<ScopeSelect branches={[]} current="" />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});

describe("LoginForm", () => {
  it("renders email and password fields with the right autocomplete hints", () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByPlaceholderText("Email")).toBeRequired();
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("submits the form data to the password action and shows its error", async () => {
    actions.passwordLogin.mockResolvedValue({ error: "Wrong email or password." });
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "pw" } });
    await act(async () => fireEvent.submit(container.querySelector("form")!));
    await waitFor(() => expect(screen.getByText("Wrong email or password.")).toHaveClass("err"));
    const [, fd] = actions.passwordLogin.mock.calls[0];
    expect(fd.get("email")).toBe("a@b.test");
    expect(fd.get("password")).toBe("pw");
  });

  it("shows no error before any attempt", () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector(".err")).toBeNull();
  });
});
