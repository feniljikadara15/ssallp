import { config, isDemo, whatsappConfigured, zohoConfigured, secret } from "./config.js";
import { HttpError, type Req, type Res } from "./http.js";
import { authRequired, login, signToken, verifyToken, verifyPath, type User } from "./sign.js";

export type Handler = (req: Req & { params: Record<string, string>; user: User | null }) => Promise<Res | unknown>;

interface Route { method: string; parts: string[]; handler: Handler; isPublic: boolean }
const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler, opts: { isPublic?: boolean } = {}) {
  routes.push({ method, parts: path.split("/").filter(Boolean), handler, isPublic: !!opts.isPublic });
}

function match(r: Route, method: string, parts: string[]) {
  if (r.method !== method || r.parts.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (r.parts[i].startsWith(":")) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (r.parts[i] !== parts[i]) return null;
  }
  return params;
}

const SESSION = "oms_session";
const cookie = (value: string, maxAge: number) => `${SESSION}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isDemo() ? "" : "; Secure"}`;

route("GET", "/api/health", async () => ({
  mode: isDemo() ? "demo" : "live",
  zoho: zohoConfigured(),
  whatsapp: whatsappConfigured(),
  authRequired: authRequired(),
  zohoOrgId: config.zoho.orgId,
}), { isPublic: true });

route("GET", "/api/session", async (req) => ({ user: req.user, authRequired: authRequired(), mode: isDemo() ? "demo" : "live" }), { isPublic: true });

route("POST", "/api/login", async (req) => {
  if (!secret()) throw new HttpError(500, "AUTH_SECRET is not set on the server");
  const user = login(String(req.body?.email ?? ""), String(req.body?.password ?? ""));
  if (!user) throw new HttpError(401, "Wrong email or password");
  return { json: { user }, headers: { "Set-Cookie": cookie(signToken(user, 60 * 60 * 24 * 30), 60 * 60 * 24 * 30) } };
}, { isPublic: true });

route("POST", "/api/logout", async () => ({ json: { ok: true }, headers: { "Set-Cookie": cookie("", 0) } }), { isPublic: true });

export async function handle(req: Req): Promise<Res> {
  await import("./routes/index.js");
  const parts = req.path.split("/").filter(Boolean);
  try {
    for (const r of routes) {
      const params = match(r, req.method, parts);
      if (!params) continue;
      let user: User | null = verifyToken<User>(req.cookies[SESSION]);
      if (!r.isPublic && !user) {
        if (req.query.has("sig") && verifyPath(req.path, req.query.get("sig"))) user = { email: "public-link", name: "Public link" };
        else if (!authRequired()) user = { email: "demo@example.com", name: "Demo User" };
        else throw new HttpError(401, "Please sign in");
      }
      const out = await r.handler({ ...req, params, user });
      if (out && typeof out === "object" && ("json" in out || "binary" in out || "status" in out)) return out as Res;
      return { json: out ?? { ok: true } };
    }
    throw new HttpError(404, `No route for ${req.method} ${req.path}`);
  } catch (e: any) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.message } };
    console.error(e);
    return { status: 500, json: { error: e?.message ?? "Server error" } };
  }
}

export const publicBase = (req: Req) => config.publicBaseUrl || req.origin;
