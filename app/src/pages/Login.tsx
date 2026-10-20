import { useState } from "react";
import { LogIn } from "lucide-react";
import { post, queryClient } from "../api";
import { Button, ErrorBox, Field, Input } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-secondary p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-bold text-white">S</div>
          <div>
            <div className="text-sm font-bold text-secondary">Sambhavnath Agencies LLP</div>
            <div className="text-xs text-gray-500">Order Management System</div>
          </div>
        </div>
        <div className="space-y-3">
          <Field label="Email"><Input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error && <ErrorBox error={error} />}
          <Button type="submit" className="w-full" busy={busy} icon={<LogIn className="h-3.5 w-3.5" />}>Sign in</Button>
        </div>
      </form>
    </div>
  );
}
