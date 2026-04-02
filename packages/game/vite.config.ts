import { defineConfig } from "vite";
import path from "path";
import fs from "fs";

/** Vite plugin: GET + POST /__ship-defaults to read/write shipViewerDefaults.json during dev */
function shipDefaultsPlugin() {
  const filePath = path.resolve(__dirname, "src/ship/shipViewerDefaults.json");
  return {
    name: "ship-defaults",
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use("/__ship-defaults", (req: any, res: any) => {
        if (req.method === "GET") {
          try {
            const data = fs.readFileSync(filePath, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(data);
          } catch {
            res.statusCode = 404;
            res.end("{}");
          }
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: string) => { body += chunk; });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + "\n");
              res.statusCode = 200;
              res.end("ok");
            } catch {
              res.statusCode = 400;
              res.end("Invalid JSON");
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end("Method not allowed");
      });
    },
  };
}

export default defineConfig({
  plugins: [shipDefaultsPlugin()],
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
