// All runtime configuration comes from environment variables (set them in
// Vercel → Project → Settings → Environment Variables). See app/README.md.
export const config = {
  databaseUrl: process.env.DATABASE_URL || "",
  // "email:password" pairs separated by commas, or "email:scrypt$salt$hash"
  // entries produced by `npm run hash-password`.
  appUsers: process.env.APP_USERS || "",
  authSecret: process.env.AUTH_SECRET || "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  // Shared key the WordPress external form sends to POST /api/webhooks/enquiry.
  enquiryWebhookKey: process.env.ENQUIRY_WEBHOOK_KEY || "",
  // Pasted keys often pick up spaces, line breaks or quotes, which AiSensy rejects.
  aisensyApiKey: (process.env.AISENSY_API_KEY || "").replace(/\s+/g, "").replace(/^["']|["']$/g, ""),
  aisensyUrl: process.env.AISENSY_URL || "https://backend.aisensy.com/campaign/t1/api/v2",
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || "",
    clientSecret: process.env.ZOHO_CLIENT_SECRET || "",
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || "",
    orgId: process.env.ZOHO_ORG_ID || "60031284196",
    accountsUrl: process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in",
    apiUrl: process.env.ZOHO_API_URL || "https://www.zohoapis.in/books/v3",
  },
  companyName: process.env.COMPANY_NAME || "Sambhavnath Agencies LLP",
};

export const isDemo = () => !config.databaseUrl;
export const zohoConfigured = () => Boolean(config.zoho.clientId && config.zoho.clientSecret && config.zoho.refreshToken);
export const whatsappConfigured = () => Boolean(config.aisensyApiKey);

// In demo mode a fixed secret is fine: there is no real data to protect.
export const secret = () => config.authSecret || (isDemo() ? "demo-secret" : "");
