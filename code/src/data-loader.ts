import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import type {
  ClaimInput,
  UserHistory,
  EvidenceRequirement,
  SampleClaimRow,
} from "./types.js";

// ─── CSV Parsing Helpers ────────────────────────────────────────

function readCsv<T>(filePath: string): T[] {
  let content = readFileSync(filePath, "utf-8");
  // Normalize mixed line endings: replace all \r\n with \n, then work with \n only
  content = content.replace(/\r\n/g, "\n");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_quotes: true,
    relax_column_count: true,
  });
  return records as T[];
}

// ─── Claims Loader ──────────────────────────────────────────────

/**
 * Load claims from claims.csv (input-only: 4 columns)
 */
export function loadClaims(filePath: string): ClaimInput[] {
  const raw = readCsv<Record<string, string>>(filePath);
  return raw.map((row) => ({
    user_id: row.user_id,
    image_paths: row.image_paths,
    user_claim: row.user_claim,
    claim_object: row.claim_object as "car" | "laptop" | "package",
  }));
}

/**
 * Load sample claims with expected outputs (14 columns)
 */
export function loadSampleClaims(filePath: string): SampleClaimRow[] {
  const raw = readCsv<Record<string, string>>(filePath);
  return raw.map((row) => ({
    user_id: row.user_id,
    image_paths: row.image_paths,
    user_claim: row.user_claim,
    claim_object: row.claim_object as "car" | "laptop" | "package",
    evidence_standard_met: row.evidence_standard_met,
    evidence_standard_met_reason: row.evidence_standard_met_reason,
    risk_flags: row.risk_flags,
    issue_type: row.issue_type,
    object_part: row.object_part,
    claim_status: row.claim_status,
    claim_status_justification: row.claim_status_justification,
    supporting_image_ids: row.supporting_image_ids,
    valid_image: row.valid_image,
    severity: row.severity,
  }));
}

// ─── User History Loader ────────────────────────────────────────

/**
 * Load user history into a Map keyed by user_id
 */
export function loadUserHistory(
  filePath: string
): Map<string, UserHistory> {
  const raw = readCsv<Record<string, string>>(filePath);
  const map = new Map<string, UserHistory>();

  for (const row of raw) {
    map.set(row.user_id, {
      user_id: row.user_id,
      past_claim_count: parseInt(row.past_claim_count, 10) || 0,
      accept_claim: parseInt(row.accept_claim, 10) || 0,
      manual_review_claim: parseInt(row.manual_review_claim, 10) || 0,
      rejected_claim: parseInt(row.rejected_claim, 10) || 0,
      last_90_days_claim_count:
        parseInt(row.last_90_days_claim_count, 10) || 0,
      history_flags: row.history_flags || "none",
      history_summary: row.history_summary || "",
    });
  }

  return map;
}

// ─── Evidence Requirements Loader ───────────────────────────────

/**
 * Load evidence requirements for minimum image evidence checks
 */
export function loadEvidenceRequirements(
  filePath: string
): EvidenceRequirement[] {
  const raw = readCsv<Record<string, string>>(filePath);
  return raw.map((row) => ({
    requirement_id: row.requirement_id,
    claim_object: row.claim_object as "car" | "laptop" | "package" | "all",
    applies_to: row.applies_to,
    minimum_image_evidence: row.minimum_image_evidence,
  }));
}

// ─── Self-Test ──────────────────────────────────────────────────

/**
 * Run when executed directly: loads all datasets and prints summary
 */
if (import.meta.main) {
  const { config, validateConfig } = await import("./config.js");

  console.log("\n🔍 ClaimGuard Data Loader — Self Test\n");

  // Validate config paths
  validateConfig();
  console.log("");

  // Load sample claims
  const sampleClaims = loadSampleClaims(config.paths.sampleClaims);
  console.log(`✓ Loaded ${sampleClaims.length} sample claims`);

  // Load test claims
  const testClaims = loadClaims(config.paths.testClaims);
  console.log(`✓ Loaded ${testClaims.length} test claims`);

  // Load user history
  const userHistory = loadUserHistory(config.paths.userHistory);
  console.log(`✓ Loaded ${userHistory.size} user history records`);

  // Load evidence requirements
  const evidenceReqs = loadEvidenceRequirements(
    config.paths.evidenceRequirements
  );
  console.log(`✓ Loaded ${evidenceReqs.length} evidence requirements`);

  // Summary stats
  console.log("\n📊 Dataset Summary:");

  const objectCounts = testClaims.reduce(
    (acc, c) => {
      acc[c.claim_object] = (acc[c.claim_object] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(`  Test claims by object: ${JSON.stringify(objectCounts)}`);

  const totalImages = testClaims.reduce((sum, c) => {
    return sum + c.image_paths.split(";").length;
  }, 0);
  console.log(`  Total test images: ${totalImages}`);

  const riskyUsers = [...userHistory.values()].filter(
    (u) => u.history_flags !== "none"
  );
  console.log(`  Users with risk flags: ${riskyUsers.length}`);

  console.log("\n✅ All data loaded successfully!\n");
}
