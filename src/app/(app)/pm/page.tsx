import { access } from "@/lib/ctx";
import { Denied } from "@/components/ui";
import { Planned } from "@/components/Planned";

export default async function PM() {
  const ctx = await access("pm");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  return (
    <Planned
      title="Property Management"
      lead="Coming next: every rental deadline in one place."
      gets={["Arrears tracker with next action and due date", "Inspections and lease renewals calendar", "Landlord health-check pipeline for new managements", "Lost-management survey follow-up"]}
      when="After Buyer Sequencing and the Development Playbook are stable"
    />
  );
}
