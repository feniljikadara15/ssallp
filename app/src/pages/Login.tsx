import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { post, queryClient } from "../api";
import { LogoMark } from "../components/Logo";
import { Button, ErrorBox, inputCls } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("login", { email: email.trim(), password });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-secondary p-10 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div />
        <div className="relative">
          <LogoMark className="mb-8 h-28 w-40 text-white/90" />
          <div className="text-sm font-medium text-white/70">Sambhavnath Agencies LLP</div>
          <h1 className="mt-1 text-2xl font-semibold leading-snug">Order Management System</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">Enquiries, orders, loading slips, invoices and deliveries in one place.</p>
        </div>
        <div className="relative text-[11px] text-white/40">© {new Date().getFullYear()} Sri Sambavanath Agencies LLP</div>
      </div>

      {/* Sign-in form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate={false}>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-white"><LogoMark className="w-9" /></div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-secondary">Sambhavnath Agencies LLP</div>
              <div className="text-xs text-gray-500">Order Management System</div>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-secondary">Sign in</h2>
          <p className="mt-1 text-xs text-gray-500">Use your work email and password.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-700">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="login-email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" className={`${inputCls} py-2.5 pl-9 text-sm`} />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-700">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="login-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} py-2.5 pl-9 pr-10 text-sm`} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:bg-black/5 hover:text-secondary">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {error && <ErrorBox error={error} />}
            <Button type="submit" className="w-full py-2.5 text-sm" busy={busy} disabled={!email || !password}>
              Sign in {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-8 text-center text-[11px] text-gray-400">Trouble signing in? Ask your administrator to reset your access.</p>
        </form>
      </div>
    </div>
  );
}
