import { nodeHandler } from "../server/node.js";

// Single serverless entry point; vercel.json rewrites every /api/* path here.
export default nodeHandler;
