/**
 * ClaimGuard — Pipeline Orchestrator
 *
 * Wires together all pipeline stages:
 * 1. Data loading (CSV parsing)
 * 2. Claim parsing (conversation → structured claim)
 * 3. Image processing (load, resize, base64)
 * 4. Evidence checking (requirement matching)
 * 5. VLM analysis (GPT-4o Vision)
 * 6. Risk flagging (merge VLM + history + adversarial)
 * 7. Output assembly (14-column CSV)
 */

import pLimit from "p-limit";
import { config, validateConfig } from "./config.js";
import {
  loadClaims,
  loadSampleClaims,
  loadUserHistory,
  loadEvidenceRequirements,
} from "./data-loader.js";
import { parseImagePaths } from "./types.js";
import type { ClaimInput, ClaimOutput, EvidenceRequirement, UserHistory } from "./types.js";
import { parseClaim } from "./claim-parser.js";
import { processImages } from "./image-processor.js";
import { checkEvidenceStandard } from "./evidence-checker.js";
import { analyzeClaim } from "./vlm-analyzer.js";
import { mergeRiskFlags } from "./risk-flagger.js";
import { assembleOutputRow, writeOutputCsv } from "./output-writer.js";
import {
  resetStats,
  setTotalClaims,
  recordClaimProcessed,
  recordClaimFailed,
  logHeader,
  logStep,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logProgress,
  logClaimResult,
  logSummary,
} from "./logger.js";

// ─── Single Claim Processor ────────────────────────────────────

/**
 * Process a single claim through the full pipeline.
 * Returns the assembled output row or null if processing failed.
 */
async function processSingleClaim(
  claim: ClaimInput,
  index: number,
  userHistoryMap: Map<string, UserHistory>,
  evidenceReqs: EvidenceRequirement[]
): Promise<ClaimOutput | null> {
  const startTime = Date.now();

  try {
    // 1. Parse the claim conversation
    const parsed = parseClaim(claim);

    // 2. Process images
    const imageInfos = parseImagePaths(
      claim.image_paths,
      config.paths.datasetRoot
    );
    const images = await processImages(imageInfos);
    const validImages = images.filter((i) => i.valid);

    // 3. Get user history
    const userHistory = userHistoryMap.get(claim.user_id);

    // 4. Check evidence standard (preliminary)
    const evidenceCheck = checkEvidenceStandard(
      claim,
      parsed,
      images,
      evidenceReqs
    );

    // 5. Analyze with VLM
    const vlmResult = await analyzeClaim(
      claim,
      parsed,
      userHistory,
      images,
      evidenceReqs
    );

    // 6. Merge risk flags
    const { flagString } = mergeRiskFlags(
      vlmResult,
      userHistory,
      parsed
    );

    // 7. Assemble output row
    const outputRow = assembleOutputRow(claim, vlmResult, flagString);

    // Record stats
    const elapsed = Date.now() - startTime;
    recordClaimProcessed(claim.user_id, images.length, validImages.length);
    logProgress(claim.user_id, index);
    logClaimResult(
      claim.user_id,
      vlmResult.claim_status,
      vlmResult.severity,
      elapsed
    );

    return outputRow;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    recordClaimFailed(claim.user_id, errorMsg);
    logError(`${claim.user_id}: ${errorMsg.slice(0, 150)}`);
    return null;
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────

/**
 * Run the full pipeline on the test claims (claims.csv).
 * Produces output.csv in the dataset directory.
 */
export async function run(): Promise<void> {
  logHeader("ClaimGuard — Multi-Modal Evidence Review");

  // Phase 1: Validate configuration
  validateConfig();

  // Phase 1: Load all data
  logStep("Loading datasets...");
  const claims = loadClaims(config.paths.testClaims);
  const userHistory = loadUserHistory(config.paths.userHistory);
  const evidenceReqs = loadEvidenceRequirements(
    config.paths.evidenceRequirements
  );

  logInfo(`Claims: ${claims.length}`);
  logInfo(`User histories: ${userHistory.size}`);
  logInfo(`Evidence requirements: ${evidenceReqs.length}`);

  // Initialize stats
  resetStats();
  setTotalClaims(claims.length);

  // Phase 5: Process all claims with concurrency control
  logStep(
    `Processing ${claims.length} claims (concurrency: ${config.concurrency.maxParallel})...`
  );

  const limit = pLimit(config.concurrency.maxParallel);
  const tasks = claims.map((claim, index) =>
    limit(() =>
      processSingleClaim(claim, index, userHistory, evidenceReqs)
    )
  );

  const results = await Promise.all(tasks);

  // Filter out failed claims (nulls)
  const successfulRows = results.filter(
    (r): r is ClaimOutput => r !== null
  );

  // Write output
  logStep("Writing output...");
  writeOutputCsv(successfulRows, config.paths.outputCsv);
  logSuccess(`Output written to: ${config.paths.outputCsv}`);
  logInfo(`Rows: ${successfulRows.length} / ${claims.length}`);

  if (successfulRows.length < claims.length) {
    logWarning(
      `${claims.length - successfulRows.length} claim(s) failed — see errors below`
    );
  }

  // Print summary
  logSummary();
}

/**
 * Run the pipeline on sample claims (for development/testing).
 * Produces output to stdout for comparison.
 */
export async function runSample(): Promise<ClaimOutput[]> {
  logHeader("ClaimGuard — Sample Run (Development)");

  validateConfig();

  logStep("Loading datasets...");
  const claims = loadClaims(config.paths.sampleClaims);
  const userHistory = loadUserHistory(config.paths.userHistory);
  const evidenceReqs = loadEvidenceRequirements(
    config.paths.evidenceRequirements
  );

  logInfo(`Sample claims: ${claims.length}`);
  logInfo(`User histories: ${userHistory.size}`);
  logInfo(`Evidence requirements: ${evidenceReqs.length}`);

  resetStats();
  setTotalClaims(claims.length);

  logStep(
    `Processing ${claims.length} sample claims (concurrency: ${config.concurrency.maxParallel})...`
  );

  const limit = pLimit(config.concurrency.maxParallel);
  const tasks = claims.map((claim, index) =>
    limit(() =>
      processSingleClaim(claim, index, userHistory, evidenceReqs)
    )
  );

  const results = await Promise.all(tasks);
  const successfulRows = results.filter(
    (r): r is ClaimOutput => r !== null
  );

  // Write sample output for comparison
  const sampleOutputPath = config.paths.outputCsv.replace(
    "output.csv",
    "sample_output.csv"
  );
  writeOutputCsv(successfulRows, sampleOutputPath);
  logSuccess(`Sample output written to: ${sampleOutputPath}`);

  logSummary();

  return successfulRows;
}
