"use client";

import { useActionState } from "react";
import { passwordLogin } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(passwordLogin, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input name="email" type="email" placeholder="Email" autoComplete="username" required />
      <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
      {state?.error && <div className="err">{state.error}</div>}
      <button className="btn primary" style={{ justifyContent: "center", padding: 11 }} disabled={pending}>
        {pending ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
