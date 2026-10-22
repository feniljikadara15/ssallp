import type { IncomingMessage, ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import { handle } from "./router.js";

// Adapter from a Node request (Vercel function or Vite dev server) to handle().
export async function nodeHandler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  const url = new URL(req.url || "/", `${proto}://${host}`);
  // Vercel rewrites /api/* to /api/main?route=*; recover the original path.
  const path = url.searchParams.get("__route") !== null ? `/api/${url.searchParams.get("__route")}` : url.pathname;
  url.searchParams.delete("__route");

  let body: unknown;
  try {
    body = req.body; // Vercel parses JSON bodies itself (and throws on bad JSON)
    if (body === undefined && req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString();
      body = raw ? JSON.parse(raw) : {};
    } else if (typeof body === "string") body = body ? JSON.parse(body) : {};
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Request body is not valid JSON" }));
    return;
  }

  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)]),
  );

  const out = await handle({ method: req.method || "GET", path, query: url.searchParams, body, cookies, headers: req.headers, origin: `${proto}://${host}`, ip: String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "" });
  for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
  res.statusCode = out.status ?? 200;
  if (out.binary) {
    res.setHeader("Content-Type", out.binary.contentType);
    if (out.binary.filename) res.setHeader("Content-Disposition", `inline; filename="${out.binary.filename}"`);
    res.end(out.binary.data);
  } else {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    // Lists of thousands of orders run to megabytes of JSON; gzip keeps them
    // well under Vercel's 4.5 MB response limit and loads them faster.
    const text = JSON.stringify(out.json ?? null);
    if (text.length > 2048 && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.end(gzipSync(text));
    } else res.end(text);
  }
}
