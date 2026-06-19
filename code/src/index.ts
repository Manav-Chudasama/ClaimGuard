/**
 * ClaimGuard — Pipeline Orchestrator (stub)
 *
 * This module wires together all pipeline stages:
 * 1. Data loading
 * 2. Claim parsing
 * 3. Image processing
 * 4. Evidence checking
 * 5. VLM analysis
 * 6. Risk flagging
 * 7. Output writing
 *
 * Will be fully implemented in Phase 5.
 */

import { config, validateConfig } from "./config.js";
import {
  loadClaims,
  loadUserHistory,
  loadEvidenceRequirements,
} from "./data-loader.js";

export async function run(): Promise<void> {
  console.log("\n🛡️  ClaimGuard — Multi-Modal Evidence Review\n");
  console.log("━".repeat(50));

  // Phase 1: Validate configuration
  validateConfig();

  // Phase 1: Load all data
  console.log("\n📂 Loading datasets...");
  const claims = loadClaims(config.paths.testClaims);
  const userHistory = loadUserHistory(config.paths.userHistory);
  const evidenceReqs = loadEvidenceRequirements(
    config.paths.evidenceRequirements
  );

  console.log(`  Claims: ${claims.length}`);
  console.log(`  User histories: ${userHistory.size}`);
  console.log(`  Evidence requirements: ${evidenceReqs.length}`);

  // TODO: Phase 2 — Image processing & claim parsing
  // TODO: Phase 3 — VLM analysis
  // TODO: Phase 4 — Risk flagging & output assembly
  // TODO: Phase 5 — Full pipeline wiring

  console.log("\n⚠️  Pipeline stub — remaining phases not yet implemented");
  console.log("━".repeat(50));
  console.log("");
}
