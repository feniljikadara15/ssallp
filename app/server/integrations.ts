import { config, isDemo, whatsappConfigured, zohoConfigured } from "./config.js";
import { HttpError } from "./http.js";

// ---------- WhatsApp via AiSensy ----------
// Same request body the Retool REST queries sent; the API key moved to an env var.

export interface WhatsAppMessage {
  campaignName: string;
  destination: string;
  userName: string;
  templateParams: string[];
  source?: string;
  media?: { url?: string; filename?: string };
  buttons?: unknown[];
  paramsFallbackValue?: Record<string, string>;
}

// AiSensy wants the number with country code and no "+", e.g. 919812345678.
// Numbers saved as plain 10-digit mobiles get India's 91 added.
export function phoneDigits(p: unknown) {
  const digits = String(p ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<{ sent: boolean; note: string }> {
  if (!msg.destination) throw new HttpError(400, `No phone number to send "${msg.campaignName}" to`);
  if (!whatsappConfigured()) {
    if (isDemo()) return { sent: false, note: `Demo mode: WhatsApp "${msg.campaignName}" to ${msg.destination} not sent` };
    throw new HttpError(503, "WhatsApp is not configured. Set AISENSY_API_KEY.");
  }
  const body = {
    apiKey: config.aisensyApiKey,
    source: "ssallp-oms",
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
    ...msg,
    templateParams: msg.templateParams.map((p) => String(p ?? "")),
  };
  const res = await fetch(config.aisensyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  // AiSensy answers {"success":"true",...}; anything else means the message didn't go out.
  if (!res.ok || (data && String(data.success) !== "true")) {
    const reason = data?.errorMessage ?? data?.message ?? data?.error ?? text.slice(0, 300);
    throw new HttpError(502, `WhatsApp "${msg.campaignName}" to ${msg.destination} failed: ${reason}`);
  }
  return { sent: true, note: `Message sent to ${msg.destination}` };
}

// ---------- Zoho Books v3 ----------

let token: { value: string; expires: number } | null = null;

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const params = new URLSearchParams({
    refresh_token: config.zoho.refreshToken,
    client_id: config.zoho.clientId,
    client_secret: config.zoho.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${config.zoho.accountsUrl}/oauth/v2/token?${params}`, { method: "POST" });
  const data: any = await res.json();
  if (!data.access_token) throw new HttpError(502, `Zoho Books login failed: ${data.error ?? res.status}`);
  token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

export function requireZoho() {
  if (!zohoConfigured()) throw new HttpError(503, "Zoho Books is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN.");
}

export async function zoho<T = any>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  requireZoho();
  const url = `${config.zoho.apiUrl}/${path}${path.includes("?") ? "&" : "?"}organization_id=${config.zoho.orgId}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) {
    if (!res.ok) throw new HttpError(502, `Zoho Books ${method} ${path.split("?")[0]} failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer()) as T;
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || (data.code !== undefined && data.code !== 0)) throw new HttpError(502, `Zoho Books: ${data.message ?? `${method} ${path.split("?")[0]} failed (${res.status})`}`);
  return data;
}
