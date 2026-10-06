import Link from "next/link";
import { getCtx } from "@/lib/ctx";
import { STATUS_LABEL, type Status } from "@/lib/roles";

export function StatusBadge({ status, label }: { status: Status | "done" | "red" | "grey"; label?: string }) {
  const text = label ?? (status in STATUS_LABEL ? STATUS_LABEL[status as Status] : status);
  return (
    <span className={`badge b-${status}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {status === "live" && <span className="pulse-dot live" />}
      {text}
    </span>
  );
}

export function Badge({ tone = "grey", children }: { tone?: "live" | "waiting" | "prototype" | "planned" | "sample" | "red" | "grey" | "done"; children: React.ReactNode }) {
  return <span className={`badge b-${tone}`}>{children}</span>;
}

export function PageHeader({ title, status, sub, actions }: { title: string; status: Status; sub?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h1>
          <StatusBadge status={status} />
        </div>
        {sub && <div className="soft" style={{ fontSize: 13, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

/** A widget card. Hidden when "Live only" is on and the widget is not live. Sample widgets get the ribbon. */
export async function Card({ title, sub, status = "live", basis = "100%", children, source, note, className }: {
  title?: string;
  sub?: string;
  status?: Status;
  basis?: string;
  children: React.ReactNode;
  source?: string;
  note?: string;
  className?: string;
}) {
  const ctx = await getCtx();
  if (ctx?.liveOnly && status !== "live") return null;
  return (
    <div className={`card ${className ?? ""}`} style={{ flex: `1 1 ${basis}` }}>
      {status === "sample" && <div className="ribbon">SAMPLE DATA</div>}
      {title && (
        <div style={{ paddingRight: status === "sample" ? 28 : 0, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          {status !== "sample" && status !== "live" && <StatusBadge status={status} />}
        </div>
      )}
      {note && <div className="notice">{note}</div>}
      {children}
      {status === "sample" && <div className="sample-note">Sample data: not PRD figures</div>}
      {status === "live" && source && <div className="soft" style={{ fontSize: 11 }}>Source: {source}</div>}
    </div>
  );
}

export async function Kpi({ label, value, status = "live" }: { label: string; value: React.ReactNode; status?: Status }) {
  const ctx = await getCtx();
  if (ctx?.liveOnly && status !== "live") return null;
  const color = { live: "var(--live)", waiting: "var(--warn)", prototype: "var(--warn)", planned: "var(--planned)", sample: "var(--sample)" }[status];
  const ink = { live: "var(--live-ink)", waiting: "var(--warn-ink)", prototype: "var(--warn-ink)", planned: "var(--planned-ink)", sample: "var(--sample)" }[status];
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className="s" style={{ color: ink }}>{STATUS_LABEL[status]}</div>
      <span className="d" style={{ background: color }} />
    </div>
  );
}

export function Bars({ items, max }: { items: { label: string; value: number; color?: string }[]; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar-row" key={i.label}>
          <span className="n">{i.label}</span>
          <div className="track"><div className="fill" style={{ width: `${Math.round((i.value / m) * 100)}%`, background: i.color }} /></div>
          <span className="v">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Cols({ items }: { items: { label: string; value: number }[] }) {
  const m = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="cols">
      {items.map((i) => (
        <div className="c" key={i.label} title={String(i.value)}>
          <i style={{ height: `${Math.max(4, (i.value / m) * 130)}px` }} />
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ base, tabs, current, param = "tab" }: { base: string; tabs: [string, string][]; current: string; param?: string }) {
  return (
    <div className="tabs">
      {tabs.map(([k, label]) => (
        <Link key={k} href={`${base}?${param}=${k}`} className={current === k ? "on" : ""}>{label}</Link>
      ))}
    </div>
  );
}

export function Denied() {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>No access</div>
      <div className="soft">Your role does not include this page.</div>
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="notice">{children}</div>;
}

export function Drawer({ title, sub, closeHref, badges, children }: { title: string; sub?: string; closeHref: string; badges?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="drawer-bg">
      <Link href={closeHref} style={{ flex: 1 }} aria-label="Close" />
      <div className="drawer">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
            {sub && <div className="soft" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <Link href={closeHref} className="btn sm" style={{ height: "fit-content" }}>Close</Link>
        </div>
        {badges && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{badges}</div>}
        {children}
      </div>
    </div>
  );
}

export const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
