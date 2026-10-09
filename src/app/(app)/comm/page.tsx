import { access } from "@/lib/ctx";
import { Denied } from "@/components/ui";
import { Planned } from "@/components/Planned";

export default async function Commercial() {
  const ctx = await access("comm");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  return (
    <Planned
      title="Commercial"
      lead="Coming next: commercial sales and leasing in the same pipeline."
      gets={["Commercial listings and enquiries alongside residential", "Tenant and owner database for commercial and mixed-use targets", "Link to the Development Playbook for employment-zone sites"]}
      when="To be scheduled with Darren once material is shared"
    />
  );
}
