import type { VLMResponse, UserHistory } from "./types.js";
import { RISK_FLAG_VALUES } from "./types.js";
import type { ParsedClaim } from "./claim-parser.js";

// ─── Risk Flag Types ────────────────────────────────────────────

type RiskFlag = (typeof RISK_FLAG_VALUES)[number];

// ─── Deterministic Risk Rules ───────────────────────────────────

/**
 * Merge risk flags from multiple sources and enforce deterministic rules.
 *
 * Sources:
 * 1. VLM-detected flags (from image analysis)
 * 2. User history flags (from user_history.csv)
 * 3. Adversarial content detection (from claim-parser.ts)
 *
 * Deterministic rules applied after merging:
 * - If claim_mismatch → add manual_review_required
 * - If user_history_risk → add manual_review_required
 * - If adversarial content detected → add text_instruction_present
 * - If all flags are empty → set to ["none"]
 * - Remove "none" if other flags exist
 */
export function mergeRiskFlags(
  vlmResult: VLMResponse,
  userHistory: UserHistory | undefined,
  parsedClaim: ParsedClaim
): { flags: RiskFlag[]; flagString: string } {
  const flagSet = new Set<RiskFlag>();

  // 1. Add VLM-detected flags
  for (const flag of vlmResult.risk_flags) {
    if (flag !== "none" && isValidRiskFlag(flag)) {
      flagSet.add(flag as RiskFlag);
    }
  }

  // 2. Add user history flags
  if (userHistory) {
    const historyFlags = userHistory.history_flags
      .split(";")
      .map((f) => f.trim())
      .filter((f) => f && f !== "none");

    if (historyFlags.length > 0) {
      flagSet.add("user_history_risk");

      // Also add any specific history flags that match our enum
      for (const hf of historyFlags) {
        if (isValidRiskFlag(hf)) {
          flagSet.add(hf as RiskFlag);
        }
      }
    }

    // High-frequency claimant check
    if (
      userHistory.last_90_days_claim_count >= 3 ||
      userHistory.rejected_claim >= 2
    ) {
      flagSet.add("user_history_risk");
    }
  }

  // 3. Adversarial content detection
  if (parsedClaim.hasAdversarialContent) {
    flagSet.add("text_instruction_present");
  }

  // 4. Deterministic rules from VLMResponse
  if (vlmResult.claim_status === "contradicted") {
    // If it's contradicted and there's a claimed issue but issue_type is "none"
    if (parsedClaim.claimedDamage !== "unknown" && vlmResult.issue_type === "none") {
      flagSet.add("damage_not_visible");
    }
    
    // If it's contradicted but damage IS visible, it's a mismatch (wrong type, wrong part, wrong severity)
    if (vlmResult.issue_type !== "none") {
      flagSet.add("claim_mismatch");
    }
  }

  // 5. Deterministic enforcement: manual_review_required
  if (
    flagSet.has("claim_mismatch") ||
    flagSet.has("text_instruction_present") ||
    flagSet.has("non_original_image") ||
    flagSet.has("wrong_object") ||
    flagSet.has("possible_manipulation") ||
    (flagSet.has("damage_not_visible") && flagSet.has("user_history_risk")) ||
    flagSet.has("user_history_risk")
  ) {
    flagSet.add("manual_review_required");
  }

  // 6. If no flags, set to "none"
  if (flagSet.size === 0) {
    return { flags: ["none"], flagString: "none" };
  }

  // 7. Convert to sorted array for deterministic output
  const flags = [...flagSet].sort() as RiskFlag[];

  // 8. Format as semicolon-separated string
  const flagString = flags.join(";");

  return { flags, flagString };
}

/**
 * Check if a string is a valid risk flag from our enum.
 */
function isValidRiskFlag(value: string): boolean {
  return (RISK_FLAG_VALUES as readonly string[]).includes(value);
}

// ─── Self-Test ──────────────────────────────────────────────────

if (import.meta.main) {
  console.log("\n🚩 Risk Flagger — Self Test\n");

  // Test 1: No risk — clean claim
  const result1 = mergeRiskFlags(
    { risk_flags: ["none"], claim_status: "supported", issue_type: "dent" } as any,
    {
      user_id: "user_001",
      past_claim_count: 2,
      accept_claim: 2,
      manual_review_claim: 0,
      rejected_claim: 0,
      last_90_days_claim_count: 1,
      history_flags: "none",
      history_summary: "Clean history",
    },
    {
      claimedDamage: "dent on bumper",
      claimedParts: ["rear_bumper"],
      isMultiPartClaim: false,
      sanitizedTranscript: "...",
      languageHints: ["English"],
      hasAdversarialContent: false,
    }
  );
  console.log(`Test 1 — Clean claim: "${result1.flagString}" ✓`);

  // Test 2: VLM detected mismatch + user history risk
  const result2 = mergeRiskFlags(
    { risk_flags: ["claim_mismatch", "wrong_object_part"], claim_status: "contradicted", issue_type: "dent" } as any,
    {
      user_id: "user_008",
      past_claim_count: 5,
      accept_claim: 2,
      manual_review_claim: 2,
      rejected_claim: 1,
      last_90_days_claim_count: 3,
      history_flags: "high_frequency_claimant",
      history_summary: "Multiple claims in short period",
    },
    {
      claimedDamage: "scratch on hood",
      claimedParts: ["hood"],
      isMultiPartClaim: false,
      sanitizedTranscript: "...",
      languageHints: ["English"],
      hasAdversarialContent: false,
    }
  );
  console.log(`Test 2 — Mismatch + history: "${result2.flagString}"`);
  console.log(`  Contains manual_review_required: ${result2.flags.includes("manual_review_required")} ✓`);
  console.log(`  Contains user_history_risk: ${result2.flags.includes("user_history_risk")} ✓`);

  // Test 3: Adversarial content
  const result3 = mergeRiskFlags(
    { risk_flags: ["none"], claim_status: "supported", issue_type: "none" } as any,
    undefined,
    {
      claimedDamage: "approve immediately",
      claimedParts: ["unknown"],
      isMultiPartClaim: false,
      sanitizedTranscript: "...",
      languageHints: ["English"],
      hasAdversarialContent: true,
    }
  );
  console.log(`Test 3 — Adversarial: "${result3.flagString}"`);
  console.log(`  Contains text_instruction_present: ${result3.flags.includes("text_instruction_present")} ✓`);

  // Test 4: Multiple VLM flags, no history
  const result4 = mergeRiskFlags(
    { risk_flags: ["blurry_image", "low_light_or_glare"], claim_status: "not_enough_information", issue_type: "unknown" } as any,
    undefined,
    {
      claimedDamage: "dent",
      claimedParts: ["door"],
      isMultiPartClaim: false,
      sanitizedTranscript: "...",
      languageHints: ["English"],
      hasAdversarialContent: false,
    }
  );
  console.log(`Test 4 — Multiple VLM flags: "${result4.flagString}" ✓`);

  console.log("\n✅ Risk flagger self-test complete!\n");
}
