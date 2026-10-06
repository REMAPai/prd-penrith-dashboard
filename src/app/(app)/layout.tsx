import Link from "next/link";
import { redirect } from "next/navigation";
import { getCtx } from "@/lib/ctx";
import { PAGES, ROLE_LABEL, canSee } from "@/lib/roles";
import { signOut } from "../login/actions";
import { LiveToggle, ScopeSelect } from "@/components/TopControls";
import { NavLink } from "@/components/NavLink";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  const { session, branch } = ctx;
  const pages = PAGES.filter((p) => canSee(session.role, p));
  const groups = [...new Set(pages.map((p) => p.group))];
  const initials = session.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="side">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 12px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>PRD</div>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{ctx.companyName}</div>
            <div className="soft" style={{ fontSize: 11 }}>{branch?.name}</div>
          </div>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="grp">{g}</div>
            {pages.filter((p) => p.group === g).map((p) => (
              <NavLink key={p.key} href={p.href} label={p.title} status={p.status} />
            ))}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="topbar">
          <ScopeSelect branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))} current={branch?.id ?? ""} />
          <div style={{ flex: 1 }} />
          <LiveToggle liveOnly={ctx.liveOnly} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right", lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{session.name}</div>
              <div className="soft" style={{ fontSize: 11 }}>{ROLE_LABEL[session.role]}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand-tint)", color: "var(--brand-ink)", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials}</div>
            <form action={signOut}><button className="btn sm">Sign out</button></form>
          </div>
        </header>
        <div style={{ padding: "24px 28px 96px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 1360, width: "100%" }}>{children}</div>
        <Link href="/feedback" className="fab">Feedback</Link>
      </main>
    </div>
  );
}
