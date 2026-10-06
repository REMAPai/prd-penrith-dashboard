import { redirect } from "next/navigation";
import { entraEnabled } from "@/lib/entra";
import { getSession } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/progress");
  const { error } = await searchParams;
  const sso = entraEnabled();
  const fallback = process.env.AUTH_FALLBACK_ENABLED !== "false";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 380px", background: "var(--brand-tint)", padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>PRD</div>
          <div style={{ fontWeight: 600 }}>Operations Dashboard</div>
        </div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.25, maxWidth: 420 }}>One place to see progress, buyers and development sites.</div>
          <div className="soft" style={{ marginTop: 12, maxWidth: 420, lineHeight: 1.6 }}>
            Every number shows where it comes from: live from your systems, waiting on access, or sample data.
          </div>
        </div>
        <div className="soft" style={{ fontSize: 12 }}>Built by REMAP.ai for PRD Penrith</div>
      </div>
      <div style={{ flex: "1 1 420px", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Sign in</div>
          {sso && (
            <a href="/api/auth/entra/login" className="btn" style={{ justifyContent: "center", padding: 11, color: "var(--text)" }}>
              Sign in with Microsoft
            </a>
          )}
          {sso && fallback && <div className="soft" style={{ textAlign: "center", fontSize: 12 }}>or use the fallback sign-in</div>}
          {fallback && <LoginForm />}
          {error && <div className="err">{error}</div>}
        </div>
      </div>
    </div>
  );
}
