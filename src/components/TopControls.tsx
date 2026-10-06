"use client";

import { useTransition } from "react";
import { setLiveOnly, setScope } from "@/app/(app)/actions";

export function LiveToggle({ liveOnly }: { liveOnly: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }} className="soft">
      Show
      <div className="seg" style={{ opacity: pending ? 0.6 : 1 }}>
        <button className={!liveOnly ? "on" : ""} onClick={() => start(() => setLiveOnly(false))}>All</button>
        <button className={liveOnly ? "on" : ""} onClick={() => start(() => setLiveOnly(true))}>Live only</button>
      </div>
    </div>
  );
}

export function ScopeSelect({ branches, current }: { branches: { id: string; name: string }[]; current: string }) {
  const [, start] = useTransition();
  if (branches.length < 2) return <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--surface-soft)", fontSize: 13 }}>{branches[0]?.name}</div>;
  return (
    <select value={current} onChange={(e) => start(() => setScope(e.target.value))} style={{ maxWidth: 240, width: "auto" }}>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}
