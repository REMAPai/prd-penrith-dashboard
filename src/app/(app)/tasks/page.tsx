import { revalidatePath } from "next/cache";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Card, Denied, PageHeader, fmtDate } from "@/components/ui";
import { z } from "zod";

async function addTask(formData: FormData) {
  "use server";
  const ctx = await access("tasks");
  if (!ctx || ctx === "denied") return;
  const p = z.object({ text: z.string().min(2).max(200), assignee: z.string().max(80).optional(), due: z.string().max(40).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  await query("insert into tasks (branch_id, text, assignee, due) values ($1,$2,$3,$4)", [ctx.branch.id, p.data.text, p.data.assignee || null, p.data.due || null]);
  revalidatePath("/tasks");
}

async function toggleTask(formData: FormData) {
  "use server";
  const ctx = await access("tasks");
  if (!ctx || ctx === "denied") return;
  await query("update tasks set done = not done where id = $1 and branch_id = $2", [Number(formData.get("id")), ctx.branch.id]);
  revalidatePath("/tasks");
}

export default async function Tasks() {
  const ctx = await access("tasks");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const tasks = await query<{ id: number; text: string; assignee: string | null; due: string | null; done: boolean }>("select id, text, assignee, due, done from tasks where branch_id = $1 order by done, id desc", [ctx.branch.id]);
  const activity = await query<{ at: string; actor_email: string | null; action: string; detail: string | null }>("select at, actor_email, action, detail from audit_log where action in ('Stage move','Zoning confirmed','Progress item') and ($1::text is null or branch_id = $1) order by at desc limit 15", [ctx.branch.id]);
  return (
    <>
      <PageHeader title="Activity and Tasks" status="live" sub="Who needs to do what, and what just happened across the departments." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card title="Tasks" basis="420px" source="Postgres tasks table">
          <form action={addTask} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="text" placeholder="New task, e.g. Confirm zoning: 18 Sydney St" required style={{ flex: "2 1 220px" }} />
            <input name="assignee" placeholder="Who" style={{ flex: "1 1 100px" }} />
            <input name="due" placeholder="Due" style={{ flex: "1 1 90px" }} />
            <button className="btn primary">Add</button>
          </form>
          <table className="t"><tbody>
            {tasks.length === 0 && <tr><td className="soft">No tasks yet.</td></tr>}
            {tasks.map((t) => (
              <tr key={t.id}>
                <td style={{ opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</td>
                <td className="soft">{t.assignee} {t.due ? `· ${t.due}` : ""}</td>
                <td><form action={toggleTask}><input type="hidden" name="id" value={t.id} /><button className="btn sm">{t.done ? "Reopen" : "Done"}</button></form></td>
              </tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="Recent activity" basis="380px" source="Audit log">
          <table className="t"><tbody>
            {activity.length === 0 && <tr><td className="soft">No activity yet.</td></tr>}
            {activity.map((a, i) => <tr key={i}><td><div style={{ fontWeight: 500 }}>{a.action}</div><div className="soft">{a.detail}</div></td><td className="soft" style={{ whiteSpace: "nowrap" }}>{a.actor_email?.split("@")[0]} · {fmtDate(a.at)}</td></tr>)}
          </tbody></table>
        </Card>
      </div>
    </>
  );
}
