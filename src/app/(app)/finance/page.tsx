import { access } from "@/lib/ctx";
import { sampleFinance } from "@/lib/data/sample";
import { Card, Cols, Denied, Notice, PageHeader } from "@/components/ui";

export default async function Finance() {
  const ctx = await access("finance");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const fin = sampleFinance(ctx.branch.id);
  return (
    <>
      <PageHeader title="Finance" status="sample" sub="Revenue in, expenses out and the forecast. Not PRD figures." />
      <Notice>No financial data has been shared with us, so every number here is invented to show the layout. A finance feed (Vault sales, PropertyMe or the accounting system) is needed before this shows anything real.</Notice>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card status="sample" title="Revenue and expenses" sub="$ thousands" basis="420px"><Cols items={fin.map((f) => ({ label: f.month, value: f.revenue }))} /></Card>
        <Card status="sample" title="Monthly net" basis="420px">
          <table className="t"><thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Net</th></tr></thead>
            <tbody>{fin.map((f) => <tr key={f.month}><td>{f.month}</td><td>{f.revenue}</td><td>{f.expenses}</td><td style={{ fontWeight: 600 }}>{f.revenue - f.expenses}</td></tr>)}</tbody></table>
        </Card>
      </div>
    </>
  );
}
