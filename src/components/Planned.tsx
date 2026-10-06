import Link from "next/link";
import { PageHeader } from "./ui";

export function Planned({ title, lead, gets, when }: { title: string; lead: string; gets: string[]; when: string }) {
  return (
    <>
      <PageHeader title={title} status="planned" sub={lead} />
      <div className="card" style={{ borderTop: "3px solid var(--brand)", gap: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>What you will get</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>{gets.map((g) => <li key={g}>{g}</li>)}</ul>
        <div className="soft">Timing: {when}.</div>
        <div><Link href="/feedback" className="btn primary">Tell us this is a priority</Link></div>
      </div>
    </>
  );
}
