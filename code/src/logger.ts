import chalk from "chalk";

// ─── Cost Tracking ──────────────────────────────────────────────

/**
 * Estimated costs for GPT-4o per 1M tokens (as of June 2025).
 * These are approximations for tracking purposes only.
 */
const COST_PER_1M_INPUT_TOKENS = 2.50; // $2.50 per 1M input tokens
const COST_PER_1M_OUTPUT_TOKENS = 10.0; // $10.00 per 1M output tokens
const ESTIMATED_INPUT_TOKENS_PER_IMAGE = 1000; // ~1K tokens per image (high detail)
const ESTIMATED_INPUT_TOKENS_PER_PROMPT = 2000; // ~2K tokens for system + user prompt
const ESTIMATED_OUTPUT_TOKENS_PER_RESPONSE = 300; // ~300 tokens for JSON response

export interface PipelineStats {
  totalClaims: number;
  processedClaims: number;
  failedClaims: number;
  totalImages: number;
  validImages: number;
  invalidImages: number;
  totalApiCalls: number;
  estimatedCostUsd: number;
  startTime: number;
  errors: { userId: string; error: string }[];
}

let stats: PipelineStats = createStats();

function createStats(): PipelineStats {
  return {
    totalClaims: 0,
    processedClaims: 0,
    failedClaims: 0,
    totalImages: 0,
    validImages: 0,
    invalidImages: 0,
    totalApiCalls: 0,
    estimatedCostUsd: 0,
    startTime: Date.now(),
    errors: [],
  };
}

// ─── Public API ─────────────────────────────────────────────────

export function resetStats(): void {
  stats = createStats();
}

export function getStats(): PipelineStats {
  return { ...stats };
}

export function setTotalClaims(count: number): void {
  stats.totalClaims = count;
}

export function recordClaimProcessed(
  userId: string,
  imageCount: number,
  validImageCount: number
): void {
  stats.processedClaims++;
  stats.totalImages += imageCount;
  stats.validImages += validImageCount;
  stats.invalidImages += imageCount - validImageCount;
  stats.totalApiCalls++;

  // Estimate cost
  const inputTokens =
    ESTIMATED_INPUT_TOKENS_PER_PROMPT +
    validImageCount * ESTIMATED_INPUT_TOKENS_PER_IMAGE;
  const outputTokens = ESTIMATED_OUTPUT_TOKENS_PER_RESPONSE;
  const callCost =
    (inputTokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS +
    (outputTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;
  stats.estimatedCostUsd += callCost;
}

export function recordClaimFailed(userId: string, error: string): void {
  stats.failedClaims++;
  stats.errors.push({ userId, error: error.slice(0, 200) });
}

// ─── Logging Functions ──────────────────────────────────────────

export function logHeader(title: string): void {
  console.log("");
  console.log(chalk.bold.cyan(`🛡️  ${title}`));
  console.log(chalk.dim("━".repeat(60)));
}

export function logStep(step: string): void {
  console.log(chalk.blue(`\n📂 ${step}`));
}

export function logInfo(message: string): void {
  console.log(chalk.gray(`   ${message}`));
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`   ✓ ${message}`));
}

export function logWarning(message: string): void {
  console.log(chalk.yellow(`   ⚠ ${message}`));
}

export function logError(message: string): void {
  console.log(chalk.red(`   ✗ ${message}`));
}

export function logProgress(userId: string, index: number): void {
  const pct = Math.round(
    ((stats.processedClaims + stats.failedClaims) / stats.totalClaims) * 100
  );
  const bar = progressBar(pct);
  console.log(
    chalk.white(
      `   ${bar} ${chalk.bold(`[${index + 1}/${stats.totalClaims}]`)} ${userId}`
    )
  );
}

export function logClaimResult(
  userId: string,
  status: string,
  severity: string,
  elapsed: number
): void {
  const statusColor =
    status === "supported"
      ? chalk.green
      : status === "contradicted"
        ? chalk.red
        : chalk.yellow;

  console.log(
    chalk.gray(
      `     → ${statusColor(status)} | severity: ${severity} | ${elapsed}ms`
    )
  );
}

export function logSummary(): void {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);

  console.log("");
  console.log(chalk.bold.cyan("━".repeat(60)));
  console.log(chalk.bold.cyan("📊 Pipeline Summary"));
  console.log(chalk.bold.cyan("━".repeat(60)));
  console.log(
    chalk.white(`   Claims:  ${chalk.green(`${stats.processedClaims} processed`)} / ${chalk.red(`${stats.failedClaims} failed`)} / ${stats.totalClaims} total`)
  );
  console.log(
    chalk.white(`   Images:  ${stats.validImages} valid / ${stats.invalidImages} invalid / ${stats.totalImages} total`)
  );
  console.log(
    chalk.white(`   API:     ${stats.totalApiCalls} calls`)
  );
  console.log(
    chalk.white(
      `   Cost:    ~$${stats.estimatedCostUsd.toFixed(4)} (estimated)`
    )
  );
  console.log(chalk.white(`   Time:    ${elapsed}s`));

  if (stats.errors.length > 0) {
    console.log(chalk.red(`\n   ❌ Errors:`));
    for (const err of stats.errors) {
      console.log(chalk.red(`      ${err.userId}: ${err.error}`));
    }
  }

  console.log(chalk.bold.cyan("━".repeat(60)));
  console.log("");
}

// ─── Helpers ────────────────────────────────────────────────────

function progressBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return (
    chalk.green("█".repeat(filled)) +
    chalk.gray("░".repeat(empty)) +
    chalk.white(` ${pct}%`)
  );
}
