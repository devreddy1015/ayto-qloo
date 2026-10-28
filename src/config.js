// Runtime configuration. Secrets come only from the environment (or a local,
// git-ignored .env file in development). Nothing here is ever sent to the browser.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = join(ROOT, ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const HACKATHON_BASE_URL = "https://hackathon.api.qloo.com";

// The hackathon key only works against the hackathon host, and the harness
// only sends a key to a base URL it has been told to trust.
process.env.QLOO_BASE_URL ||= HACKATHON_BASE_URL;
process.env.QLOO_TRUSTED_BASE_URL ||= process.env.QLOO_BASE_URL;

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
};

export const config = {
  port: int("PORT", 8080),
  // "live" calls Qloo; "samples" replays recorded real Qloo responses so the
  // app still works when the key is missing or the quota is exhausted.
  mode: process.env.CULTURE_GAP_MODE || (process.env.QLOO_API_KEY ? "live" : "samples"),
  hasQlooKey: Boolean(process.env.QLOO_API_KEY),
  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    // Tried in order; the first one the account can use wins.
    models: (process.env.GROQ_MODELS || "openai/gpt-oss-120b,llama-3.3-70b-versatile,openai/gpt-oss-20b")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  },
  qloo: {
    command: process.env.QLOO_COMMAND || join(ROOT, "node_modules", ".bin", "qloo"),
    timeoutMs: int("QLOO_TIMEOUT_MS", 45000),
    concurrency: int("QLOO_CONCURRENCY", 4),
  },
  cacheDir: process.env.CACHE_DIR || join(ROOT, ".cache"),
  samplesDir: join(ROOT, "samples"),
  // Abuse and quota protection for the public demo.
  scansPerIpPerHour: int("SCANS_PER_IP_PER_HOUR", 6),
  maxRunsPerDay: int("MAX_RUNS_PER_DAY", 150),
  // Runs that spend the server's own LLM key (bring-your-own-key runs are not counted).
  maxLlmRunsPerDay: int("MAX_LLM_RUNS_PER_DAY", 100),
};
