// Start produksi lintas-platform untuk Railway / VPS / lokal.
// Port: env PORT (default 8080) — Railway selalu inject PORT.
// Host: env HOSTNAME (default 0.0.0.0) supaya container bisa diakses.
import { spawn } from "node:child_process";
import path from "node:path";

const port = process.env.PORT || "8080";
const host = process.env.HOSTNAME || "0.0.0.0";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const child = spawn(
  process.execPath,
  [nextBin, "start", "-p", String(port), "-H", host],
  { stdio: "inherit", env: process.env }
);

const stop = (sig) => () => { child.kill(sig); };
process.on("SIGTERM", stop("SIGTERM"));
process.on("SIGINT", stop("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
