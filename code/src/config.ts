import { resolve } from "path";

// ─── Environment Variables ──────────────────────────────────────
// Bun auto-loads .env files from the project root

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    console.error(`   Copy .env.example to .env and fill in your API key.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalEnvInt(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ─── API Configuration ──────────────────────────────────────────

export const config = {
  // OpenAI
  openai: {
    apiKey: "", // lazy-loaded via getApiKey()
    model: optionalEnv("OPENAI_MODEL", "gpt-4o"),
    maxTokens: 1500,
    temperature: 0.1, // low temperature for deterministic outputs
  },

  // Retry & Rate Limiting
  retry: {
    maxRetries: optionalEnvInt("OPENAI_MAX_RETRIES", 3),
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterMs: 500,
  },

  // Concurrency
  concurrency: {
    maxParallel: optionalEnvInt("OPENAI_CONCURRENCY", 3),
  },

  // Timeouts
  timeout: {
    apiCallMs: optionalEnvInt("OPENAI_TIMEOUT_MS", 60000),
  },

  // Image processing
  image: {
    maxDimensionPx: 1024,
    maxSizeBytes: 200 * 1024, // 200KB after compression
    quality: 85,
    supportedFormats: ["jpg", "jpeg", "png", "webp"] as const,
  },

  // Dataset paths (relative to repo root)
  paths: {
    repoRoot: resolve(import.meta.dir, "../.."),
    datasetRoot: resolve(import.meta.dir, "../../dataset"),
    sampleClaims: resolve(import.meta.dir, "../../dataset/sample_claims.csv"),
    testClaims: resolve(import.meta.dir, "../../dataset/claims.csv"),
    userHistory: resolve(import.meta.dir, "../../dataset/user_history.csv"),
    evidenceRequirements: resolve(
      import.meta.dir,
      "../../dataset/evidence_requirements.csv"
    ),
    outputCsv: resolve(import.meta.dir, "../../dataset/output.csv"),
  },
} as const;

/** Lazy-load the API key (only when actually needed for API calls) */
export function getApiKey(): string {
  if (!config.openai.apiKey) {
    (config.openai as { apiKey: string }).apiKey = requireEnv("OPENAI_API_KEY");
  }
  return config.openai.apiKey;
}

/** Validate that the configuration is sane */
export function validateConfig(): void {
  // Check dataset files exist
  const { Bun } = globalThis as any;
  const fs = require("fs");

  const requiredFiles = [
    config.paths.sampleClaims,
    config.paths.testClaims,
    config.paths.userHistory,
    config.paths.evidenceRequirements,
  ];

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required dataset file not found: ${filePath}`);
      process.exit(1);
    }
  }

  console.log("✓ Configuration validated");
  console.log(`  Model: ${config.openai.model}`);
  console.log(`  Concurrency: ${config.concurrency.maxParallel}`);
  console.log(`  Max retries: ${config.retry.maxRetries}`);
  console.log(`  Dataset root: ${config.paths.datasetRoot}`);
}
