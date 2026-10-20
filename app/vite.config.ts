import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Serves /api/* from server/ during `npm run dev`, the same handler Vercel runs.
function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const { nodeHandler } = await server.ssrLoadModule("/server/node.ts");
          await nodeHandler(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
});
