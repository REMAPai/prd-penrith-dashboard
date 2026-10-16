import { revalidatePath } from "next/cache";
import { z } from "zod";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { audit } from "@/lib/session";
import { Badge, Card, Denied, PageHeader, fmtDate } from "@/components/ui";
import { PAGES } from "@/lib/roles";

const STATUSES = ["New", "Planned", "In progress", "Done", "Won't do"];

async function submit(formData: FormData) {
  "use server";
  const ctx = await access("feedback");
  if (!ctx || ctx === "denied") return;
  const p = z.object({ body: z.string().min(3).max(1000), page: z.string().max(60), rating: z.enum(["useful", "confusing", "wrong"]) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  await query("insert into feedback (branch_id, page, rating, body, author_email) values ($1,$2,$3,$4,$5)", [ctx.branch.id, p.data.page, p.data.rating, p.data.body, ctx.session.email]);
  revalidatePath("/feedback");
}

async function vote(formData: FormData) {
  "use server";
  const ctx = await access("feedback");
  if (!ctx || ctx === "denied") return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await query("with ins as (insert into feedback_votes (feedback_id, voter_email) values ($1, $2) on conflict do nothing returning 1) update feedback set votes = votes + 1 where id = $1 and exists (select 1 from ins)", [id, ctx.session.email]);
  revalidatePath("/feedback");
}

async function setStatus(formData: FormData) {
  "use server";
  const ctx = await access("feedback");
  if (!ctx || ctx === "denied" || ctx.session.role !== "platform_admin") return; // REMAP triages
  const status = String(formData.get("status"));
  if (!STATUSES.includes(status)) return;
  await query("update feedback set status = $1 where id = $2", [status, Number(formData.get("id"))]);
  await audit(ctx.session.email, "Feedback status", `Feedback ${formData.get("id")} set to ${status}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/feedback");
}

export default async function Feedback() {
  const ctx = await access("feedback");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const rows = await query<{ id: number; page: string | null; rating: string | null; body: string; status: string; votes: number; voted: boolean; author_email: string | null; created_at: string }>(
    "select id, page, rating, body, status, votes, exists (select 1 from feedback_votes v where v.feedback_id = feedback.id and v.voter_email = $1) as voted, author_email, created_at from feedback order by (status = 'Done'), votes desc, id desc limit 100",
    [ctx.session.email],
  );
  const done = rows.filter((r) => r.status === "Done");
  const isAdmin = ctx.session.role === "platform_admin";
  return (
    <>
      <PageHeader title="Feedback" status="live" sub="Tell us what is confusing, wrong or missing. We review it every week and show what changed." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card title="Send feedback" basis="360px">
          <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <select name="page" defaultValue="General">
              <option>General</option>
              {PAGES.map((p) => <option key={p.key}>{p.title}</option>)}
            </select>
            <select name="rating" defaultValue="useful">
              <option value="useful">This is useful, but...</option>
              <option value="confusing">This is confusing</option>
              <option value="wrong">This looks wrong</option>
            </select>
            <textarea name="body" rows={4} placeholder="What would you change?" required />
            <button className="btn primary" style={{ justifyContent: "center" }}>Send</button>
          </form>
        </Card>
        <Card title="Everything we have heard" basis="520px">
          <table className="t"><tbody>
            {rows.length === 0 && <tr><td className="soft">Nothing yet. Be the first.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div>{r.body}</div>
                  <div className="soft" style={{ fontSize: 11 }}>{r.page} · {r.author_email?.split("@")[0]} · {fmtDate(r.created_at)}</div>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isAdmin ? (
                    <form action={setStatus} style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} style={{ width: "auto" }}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                      <button className="btn sm">Save</button>
                    </form>
                  ) : <Badge tone={r.status === "Done" ? "done" : r.status === "New" ? "grey" : "prototype"}>{r.status}</Badge>}
                </td>
                <td><form action={vote}><input type="hidden" name="id" value={r.id} /><button className="btn sm" disabled={r.voted}>{r.voted ? "Voted" : "+1"} · {r.votes}</button></form></td>
              </tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="You said, we did" basis="100%">
          {done.length === 0 ? <div className="soft">Finished items will appear here.</div> : <ul style={{ margin: 0, paddingLeft: 18 }}>{done.map((d) => <li key={d.id}>{d.body}</li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
