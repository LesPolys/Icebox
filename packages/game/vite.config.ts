import { defineConfig } from "vite";
import path from "path";
import fs from "fs";

/** Vite plugin: exposes POST /__save-defaults to write shipViewerDefaults.json during dev */
function saveDefaultsPlugin() {
  const filePath = path.resolve(__dirname, "src/ship/shipViewerDefaults.json");
  return {
    name: "save-ship-defaults",
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use("/__save-defaults", (req: any, res: any) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk: string) => { body += chunk; });
        req.on("end", () => {
          try {
            // Validate it's proper JSON before writing
            const parsed = JSON.parse(body);
            fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + "\n");
            res.statusCode = 200;
            res.end("ok");
          } catch (e) {
            res.statusCode = 400;
            res.end("Invalid JSON");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [saveDefaultsPlugin()],
  resolve: {
    alias: {
      "@icebox/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ["**/shipViewerDefaults.json"],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
