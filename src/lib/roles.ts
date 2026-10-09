export type Role = "platform_admin" | "company_admin" | "branch_admin" | "marketing" | "agent" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  platform_admin: "Platform admin",
  company_admin: "Company admin",
  branch_admin: "Branch admin",
  marketing: "Marketing",
  agent: "Sales agent",
  viewer: "Viewer",
};

const R: Record<Role, string> = { platform_admin: "p", company_admin: "c", branch_admin: "b", marketing: "m", agent: "a", viewer: "v" };

export type Status = "live" | "waiting" | "prototype" | "planned" | "sample";

export type PageDef = { key: string; title: string; group: string; status: Status; roles: string; href: string };

// roles: "all" or letters p c b m a v (platform, company, branch, marketing, agent, viewer)
export const PAGES: PageDef[] = [
  { key: "progress", title: "Delivery Progress", group: "Overview", status: "live", roles: "all", href: "/progress" },
  { key: "exec", title: "Executive Overview", group: "Overview", status: "prototype", roles: "all", href: "/exec" },
  { key: "buyer", title: "Buyer Sequencing", group: "Departments", status: "live", roles: "pcbma", href: "/buyer" },
  { key: "listings", title: "Listings and Demand", group: "Departments", status: "live", roles: "pcbma", href: "/listings" },
  { key: "pipeline", title: "Development Playbook", group: "Departments", status: "prototype", roles: "pcbma", href: "/pipeline" },
  { key: "map", title: "Map", group: "Departments", status: "prototype", roles: "pcbm", href: "/map" },
  { key: "projects", title: "Projects and Stock", group: "Departments", status: "prototype", roles: "pcbm", href: "/projects" },
  { key: "meta", title: "Meta Lead Funnel", group: "Departments", status: "waiting", roles: "pcbm", href: "/meta" },
  { key: "pm", title: "Property Management", group: "Departments", status: "planned", roles: "pcb", href: "/pm" },
  { key: "comm", title: "Commercial", group: "Departments", status: "planned", roles: "pcb", href: "/comm" },
  { key: "market", title: "Market Insights", group: "Insights", status: "prototype", roles: "pcbm", href: "/market" },
  { key: "finance", title: "Finance", group: "Insights", status: "waiting", roles: "pcb", href: "/finance" },
  { key: "tasks", title: "Activity and Tasks", group: "Operate", status: "live", roles: "pcbma", href: "/tasks" },
  { key: "alerts", title: "Alerts and Logs", group: "Operate", status: "prototype", roles: "pcb", href: "/alerts" },
  { key: "feedback", title: "Feedback", group: "Operate", status: "live", roles: "all", href: "/feedback" },
  { key: "sources", title: "Data Sources", group: "Operate", status: "live", roles: "pcb", href: "/sources" },
  { key: "users", title: "Users and Roles", group: "Admin", status: "live", roles: "pcb", href: "/users" },
  { key: "audit", title: "Audit Log", group: "Admin", status: "live", roles: "pcb", href: "/audit" },
  { key: "companies", title: "Companies and Branches", group: "Platform", status: "live", roles: "p", href: "/companies" },
];

export function canSee(role: Role, page: PageDef) {
  return page.roles === "all" || page.roles.includes(R[role]);
}

export const pageByKey = (k: string) => PAGES.find((p) => p.key === k)!;

export const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  waiting: "Waiting on access",
  prototype: "Prototype",
  planned: "Planned",
  sample: "Sample data",
};

export const canManageUsers = (role: Role) => role === "platform_admin" || role === "company_admin" || role === "branch_admin";
export const canEditPipeline = (role: Role) => ["platform_admin", "company_admin", "branch_admin", "marketing"].includes(role);
export const canRevealPii = (role: Role) => role !== "viewer";
