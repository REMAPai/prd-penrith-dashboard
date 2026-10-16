import { access } from "@/lib/ctx";
import { Denied, Kpi, Notice, PageHeader } from "@/components/ui";

export default async function Meta() {
  const ctx = await access("meta");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  return (
    <>
      <PageHeader title="Meta Lead Funnel" status="waiting" sub="Facebook and Instagram project leads, from ad to Vault." />
      <Notice>Weekly figures need read access to the Meta leads sheet from Thomas. The two numbers below come from Darren (1 Oct). Today, campaign leads reach Vault only after a manual step (Thomas calls, then Thea adds them).</Notice>
      <div className="grid-kpi">
        <Kpi label="Leads in the last 10 days" value="45" status="prototype" />
        <Kpi label="Weekly target" value="100" status="prototype" />
      </div>
    </>
  );
}
