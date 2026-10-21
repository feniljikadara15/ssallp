export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Req {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
  cookies: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  origin: string;
}

export interface Res {
  status?: number;
  json?: unknown;
  binary?: { data: Buffer; contentType: string; filename?: string };
  headers?: Record<string, string>;
}

export const num = (v: unknown, name = "value") => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || Number.isNaN(n)) throw new HttpError(400, `${name} must be a number`);
  return n;
};
export const optNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
export const str = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
