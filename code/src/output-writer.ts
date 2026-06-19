import { stringify } from "csv-stringify/sync";
import { writeFileSync } from "fs";
import type { ClaimInput, ClaimOutput, VLMResponse } from "./types.js";
import { ClaimOutputSchema, OUTPUT_COLUMNS } from "./types.js";

// ─── Output Row Assembly ────────────────────────────────────────

/**
 * Assemble a complete output row from the claim input and VLM response.
 *
 * Handles:
 * - Boolean → string conversion (evidence_standard_met, valid_image)
 * - Array → semicolon-separated string (risk_flags, supporting_image_ids)
 * - Schema validation via Zod
 */
export function assembleOutputRow(
  claim: ClaimInput,
  vlmResponse: VLMResponse,
  finalRiskFlagString: string
): ClaimOutput {
  const row: ClaimOutput = {
    user_id: claim.user_id,
    image_paths: claim.image_paths,
    user_claim: claim.user_claim,
    claim_object: claim.claim_object,
    evidence_standard_met: String(vlmResponse.evidence_standard_met),
    evidence_standard_met_reason: vlmResponse.evidence_standard_met_reason,
    risk_flags: finalRiskFlagString,
    issue_type: vlmResponse.issue_type,
    object_part: vlmResponse.object_part,
    claim_status: vlmResponse.claim_status,
    claim_status_justification: vlmResponse.claim_status_justification,
    supporting_image_ids:
      vlmResponse.supporting_image_ids.length > 0
        ? vlmResponse.supporting_image_ids.join(";")
        : "none",
    valid_image: String(vlmResponse.valid_image),
    severity: vlmResponse.severity,
  };

  // Validate against schema
  const result = ClaimOutputSchema.safeParse(row);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    console.warn(`  ⚠ Output row validation warning for ${claim.user_id}: ${issues}`);
  }

  return row;
}

// ─── CSV Writer ─────────────────────────────────────────────────

/**
 * Write output rows to a CSV file with the exact column order required.
 */
export function writeOutputCsv(rows: ClaimOutput[], outputPath: string): void {
  // Build records in the correct column order
  const records = rows.map((row) => {
    const ordered: Record<string, string> = {};
    for (const col of OUTPUT_COLUMNS) {
      ordered[col] = row[col];
    }
    return ordered;
  });

  const csv = stringify(records, {
    header: true,
    columns: OUTPUT_COLUMNS as unknown as string[],
    quoted: true,
    quoted_empty: true,
  });

  writeFileSync(outputPath, csv, "utf-8");
}

// ─── Self-Test ──────────────────────────────────────────────────

if (import.meta.main) {
  const { resolve } = await import("path");

  console.log("\n📄 Output Writer — Self Test\n");

  // Test 1: Assemble a row from mock data
  const mockClaim: ClaimInput = {
    user_id: "user_001",
    image_paths: "images/sample/case_001/img_1.jpg",
    user_claim: "Customer: The rear bumper has a dent.",
    claim_object: "car",
  };

  const mockVLM: VLMResponse = {
    evidence_standard_met: true,
    evidence_standard_met_reason: "The rear bumper is visible and the dent can be verified.",
    risk_flags: ["none"],
    issue_type: "dent",
    object_part: "rear_bumper",
    claim_status: "supported",
    claim_status_justification: "The image clearly shows a dent on the rear bumper.",
    supporting_image_ids: ["img_1"],
    valid_image: true,
    severity: "medium",
  };

  const row = assembleOutputRow(mockClaim, mockVLM, "none");
  console.log("Test 1 — Assembled row:");
  console.log(`  user_id: ${row.user_id}`);
  console.log(`  evidence_standard_met: "${row.evidence_standard_met}" (string)`);
  console.log(`  valid_image: "${row.valid_image}" (string)`);
  console.log(`  risk_flags: "${row.risk_flags}"`);
  console.log(`  supporting_image_ids: "${row.supporting_image_ids}"`);
  console.log(`  claim_status: "${row.claim_status}"`);

  // Test 2: Write a CSV with two rows
  const mockClaim2: ClaimInput = {
    user_id: "user_002",
    image_paths: "images/sample/case_002/img_1.jpg;images/sample/case_002/img_2.jpg",
    user_claim: "Customer: Front bumper par scratch hai.",
    claim_object: "car",
  };

  const mockVLM2: VLMResponse = {
    evidence_standard_met: true,
    evidence_standard_met_reason: "Close-up shows scratch on front bumper.",
    risk_flags: ["blurry_image", "low_light_or_glare"],
    issue_type: "scratch",
    object_part: "front_bumper",
    claim_status: "supported",
    claim_status_justification: "Scratch visible on front bumper.",
    supporting_image_ids: ["img_1"],
    valid_image: true,
    severity: "low",
  };

  const row2 = assembleOutputRow(mockClaim2, mockVLM2, "blurry_image;low_light_or_glare");

  // Write to a temp file
  const tempPath = resolve(import.meta.dir, "../../_test_output.csv");
  writeOutputCsv([row, row2], tempPath);
  console.log(`\nTest 2 — Wrote CSV to: ${tempPath}`);

  // Read back and verify
  const { readFileSync } = await import("fs");
  const csvContent = readFileSync(tempPath, "utf-8");
  const lines = csvContent.trim().split("\n");
  console.log(`  Lines: ${lines.length} (1 header + ${lines.length - 1} data rows)`);
  console.log(`  Header: ${lines[0].slice(0, 100)}...`);

  // Verify column count
  const headerCols = lines[0].split(",").length;
  console.log(`  Column count: ${headerCols} (expected: 14)`);
  console.log(`  Match: ${headerCols === 14 ? "✓" : "✗"}`);

  // Clean up
  const { unlinkSync } = await import("fs");
  unlinkSync(tempPath);
  console.log(`  Cleaned up temp file.`);

  console.log("\n✅ Output writer self-test complete!\n");
}
