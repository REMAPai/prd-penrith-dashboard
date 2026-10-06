import { access } from "@/lib/ctx";
import { Denied, Notice, PageHeader } from "@/components/ui";

export default async function Finance() {
  const ctx = await access("finance");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  return (
    <>
      <PageHeader title="Finance" status="waiting" sub="Revenue in, expenses out and the forecast." />
      <Notice>No financial data has been shared with us yet, so nothing is shown. A finance feed (Vault sales, PropertyMe or the accounting system) is needed first.</Notice>
    </>
  );
}
