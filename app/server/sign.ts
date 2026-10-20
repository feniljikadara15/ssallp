import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { config, isDemo, secret } from "./config.js";

const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function signToken(payload: object, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyToken<T = any>(token: string | undefined): T | null {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  return data.exp > Date.now() / 1000 ? data : null;
}

// Public links (WhatsApp media for invoices and loading slips) carry a signature
// instead of a session, since AiSensy fetches them without logging in.
export const signPath = (path: string) => `${path}${path.includes("?") ? "&" : "?"}sig=${hmac(path).slice(0, 32)}`;
export const verifyPath = (path: string, sig: string | null) => !!sig && hmac(path).slice(0, 32) === sig;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("base64url")}`;
}

function checkPassword(stored: string, given: string) {
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const got = scryptSync(given, salt, 32);
    const want = Buffer.from(hash, "base64url");
    return got.length === want.length && timingSafeEqual(got, want);
  }
  const a = Buffer.from(stored), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface User { email: string; name: string }

function users() {
  return config.appUsers.split(",").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const i = entry.indexOf(":");
    return { email: entry.slice(0, i).toLowerCase(), password: entry.slice(i + 1) };
  });
}

export function login(email: string, password: string): User | null {
  const u = users().find((x) => x.email === email.trim().toLowerCase());
  if (!u || !checkPassword(u.password, password)) return null;
  return { email: u.email, name: u.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export const authRequired = () => !isDemo() || users().length > 0;
