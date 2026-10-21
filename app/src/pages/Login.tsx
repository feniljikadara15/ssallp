import { useEffect, useState } from "react";
import { post, queryClient } from "../api";
import { LogoMark } from "../components/Logo";
import { Notice } from "../components/ui";

// Sign-in: navy brand panel on the left (hidden on phones, where a slim navy
// bar carries the logo instead), the form on the light working side.
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = "Sign in · Sambhavnath OMS"; }, []);
  // The most common reason a correct password fails.
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError("");
    try {
      await post("login", { email: email.trim(), password });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[38rem] w-[38rem] text-white/[0.05]" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.6">
          <rect x="40" y="40" width="120" height="120" /><rect x="40" y="40" width="120" height="120" transform="rotate(45 100 100)" />
          <rect x="60" y="60" width="80" height="80" /><rect x="60" y="60" width="80" height="80" transform="rotate(45 100 100)" />
        </svg>
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-14" />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-wide">SAMBHAVNATH</div>
            <div className="text-[12px] text-brand-light">Agencies LLP</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-[40px] font-semibold leading-[1.08] tracking-tight">Order Management</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">Enquiries, orders, loading slips, invoices, cash bills and deliveries for Sambhavnath, in one place.</p>
        </div>
        <div className="relative text-[12px] text-white/60">Private system for Sambhavnath staff. Activity is recorded.</div>
      </aside>

      <section className="flex min-h-dvh flex-col">
        <div className="flex items-center gap-2.5 bg-navy px-5 py-3.5 text-white lg:hidden">
          <LogoMark className="h-8 w-11" />
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-wide">SAMBHAVNATH</div>
            <div className="text-[11px] text-brand-light">Order Management</div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">Sign in</h1>
            <p className="mt-1.5 text-[14px] text-muted">Use your work email.</p>
            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              {error && <Notice tone="danger">{error}</Notice>}
              <div>
                <label className="label" htmlFor="login-email">Email</label>
                <input id="login-email" type="email" required autoComplete="username" autoFocus inputMode="email" autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} className="input h-11 text-[15px]" />
              </div>
              <div>
                <label className="label" htmlFor="login-password">Password</label>
                <div className="relative">
                  <input id="login-password" type={show ? "text" : "password"} required autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyUp={checkCaps} onKeyDown={checkCaps}
                    className="input h-11 pr-16 text-[15px]" aria-describedby={caps ? "login-caps" : undefined} />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="login-password"
                    className="absolute inset-y-0 right-1.5 my-1.5 rounded-md px-2.5 text-[12px] font-medium text-muted hover:bg-hover hover:text-ink">{show ? "Hide" : "Show"}</button>
                </div>
                {caps && <p id="login-caps" className="mt-1.5 text-[12px] text-warning">Caps Lock is on.</p>}
              </div>
              <button type="submit" disabled={busy} className="btn-primary h-11 w-full text-[15px]">{busy ? "Signing in..." : "Sign in"}</button>
              <p className="text-center text-[13px] text-faint">Forgot your password or need an account? Ask your administrator.</p>
            </form>
          </div>
        </div>
        <p className="px-5 pb-6 text-center text-[12px] text-faint">© {new Date().getFullYear()} Sri Sambhavnath Agencies LLP</p>
      </section>
    </main>
  );
}
