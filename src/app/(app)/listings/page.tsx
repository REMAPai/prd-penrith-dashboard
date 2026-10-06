import { access } from "@/lib/ctx";
import { getConversations } from "@/lib/data/conversations";
import { getListings } from "@/lib/data/vault";
import { Badge, Card, Denied, Kpi, Notice, PageHeader } from "@/components/ui";

export default async function Listings() {
  const ctx = await access("listings");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const convos = await getConversations(ctx.branch.id);
  const res = await getListings(ctx.branch.id, convos.data);
  const rows = res.data.slice().sort((a, b) => b.enquiries30 - a.enquiries30);
  const st = res.status;
  const demandNote = convos.status === "live" ? "Enquiry counts come from the conversation log." : "Enquiry counts need the conversation log to be connected.";

  return (
    <>
      <PageHeader title="Listings and Demand" status={st === "live" ? "live" : st} sub="Current listings with buyer enquiries per listing." />
      {res.note && <Notice>{res.note}</Notice>}
      <div className="grid-kpi">
        <Kpi label="Current listings" value={rows.length} status={st} />
        <Kpi label="Listings with enquiries" value={rows.filter((l) => l.enquiries30 > 0).length} status={st} />
        <Kpi label="Hot buyers across listings" value={rows.reduce((a, l) => a + l.hot, 0)} status={st} />
      </div>
      <Card status={st} title="Listings" sub={`Most recently updated 100 sale records, current listings only. ${demandNote}`} source={res.source}>
        <div style={{ overflow: "auto" }}>
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th>Address</th><th>Suburb</th><th>Type</th><th>Beds / baths / cars</th><th>Price guide</th><th>Enquiries</th><th>Hot</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.address}</td><td>{l.suburb}</td><td className="soft">{l.type}</td>
                  <td>{[l.bed, l.bath, l.cars].map((n) => n ?? "-").join(" / ")}</td>
                  <td>{l.price}</td>
                  <td>{l.enquiries30 > 0 ? <Badge tone="red">{l.enquiries30}</Badge> : <span className="soft">0</span>}</td>
                  <td>{l.hot || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
