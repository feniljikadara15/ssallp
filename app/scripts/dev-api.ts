// Standalone API server for local testing: `npx tsx scripts/dev-api.ts`
import http from "node:http";
import { nodeHandler } from "../server/node.js";

const port = Number(process.env.PORT || 3001);
http.createServer((req, res) => nodeHandler(req as any, res)).listen(port, () => console.log(`API on http://localhost:${port}`));
