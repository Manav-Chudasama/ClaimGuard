import type { ClaimInput, EvidenceRequirement, ProcessedImage } from "./types.js";
import type { ParsedClaim } from "./claim-parser.js";

// ─── Evidence Check Result ──────────────────────────────────────

export interface EvidenceCheckResult {
  /** Whether the image set meets the minimum evidence standard */
  evidenceStandardMet: boolean;
  /** Short reason for the evidence decision */
  reason: string;
  /** Which requirements were matched */
  matchedRequirements: string[];
}

// ─── Issue Family Mapping ───────────────────────────────────────

/**
 * Map issue descriptions from claims to the `applies_to` families
 * used in evidence_requirements.csv
 */
const ISSUE_FAMILY_MAP: Record<string, string[]> = {
  // Car body panel issues
  "dent or scratch": [
    "dent", "scratch", "mark", "scrape", "surface", "paint",
    "bumper", "door", "hood", "fender", "quarter_panel", "body",
  ],
  // Car glass/light/mirror issues
  "crack, broken, or missing part": [
    "crack", "broken", "shatter", "missing", "windshield", "glass",
    "headlight", "taillight", "mirror", "light",
  ],
  // Car identity/orientation
  "vehicle identity or orientation": [
    "blue car", "black car", "my car", "left side", "right side",
    "driver", "passenger",
  ],
  // Laptop screen/keyboard/trackpad
  "screen, keyboard, or trackpad": [
    "screen", "display", "keyboard", "keys", "trackpad", "track pad",
    "pantalla", "teclas",
  ],
  // Laptop body/hinge/port
  "hinge, lid, corner, body, or port": [
    "hinge", "lid", "corner", "body", "base", "port", "outer",
  ],
  // Package exterior
  "crushed, torn, or seal damage": [
    "crush", "torn", "tear", "seal", "open", "dab", "phati",
    "package corner", "box corner", "flap",
  ],
  // Package label/stain
  "water, stain, or label damage": [
    "water", "wet", "stain", "oil", "label", "mark",
  ],
  // Package contents
  "contents or inner item": [
    "contents", "missing", "inside", "item", "product", "andar",
  ],
  // General
  "general claim review": [],
  "multi-image rows": [],
  "reviewability": [],
};

// ─── Evidence Checker ───────────────────────────────────────────

/**
 * Check whether the submitted image set meets the minimum evidence
 * standard for the given claim, based on evidence_requirements.csv rules.
 *
 * This produces a preliminary check. The VLM will make the final
 * determination based on actual image content.
 */
export function checkEvidenceStandard(
  claim: ClaimInput,
  parsedClaim: ParsedClaim,
  images: ProcessedImage[],
  requirements: EvidenceRequirement[]
): EvidenceCheckResult {
  // 1. Filter to applicable requirements (match claim_object or "all")
  const applicable = requirements.filter(
    (r) => r.claim_object === claim.claim_object || r.claim_object === "all"
  );

  // 2. Find which specific requirements match based on the claim content
  const matched = matchRequirements(applicable, parsedClaim, claim);

  // 3. Check basic evidence availability
  const validImages = images.filter((img) => img.valid);
  const hasValidImages = validImages.length > 0;

  // 4. Multi-image check
  const isMultiImage = images.length > 1;
  const multiImageReq = applicable.find(
    (r) => r.requirement_id === "REQ_GENERAL_MULTI_IMAGE"
  );
  if (isMultiImage && multiImageReq && !matched.includes(multiImageReq.requirement_id)) {
    matched.push(multiImageReq.requirement_id);
  }

  // 5. General reviewability check
  const reviewReq = applicable.find(
    (r) => r.requirement_id === "REQ_REVIEW_TRUST"
  );
  if (reviewReq && !matched.includes(reviewReq.requirement_id)) {
    matched.push(reviewReq.requirement_id);
  }

  // 6. Determine result
  if (!hasValidImages) {
    return {
      evidenceStandardMet: false,
      reason: "No valid images were submitted or all images failed to load.",
      matchedRequirements: matched,
    };
  }

  // Build the reason based on matched requirements
  const matchedReqs = requirements.filter((r) => matched.includes(r.requirement_id));
  const evidenceDescriptions = matchedReqs
    .map((r) => r.minimum_image_evidence)
    .slice(0, 2); // Keep it concise

  // Preliminary: if we have valid images and matched requirements,
  // mark as potentially met. The VLM will make the final call.
  return {
    evidenceStandardMet: true,
    reason: `${validImages.length} valid image(s) submitted. Applicable requirements: ${matched.join(", ")}.`,
    matchedRequirements: matched,
  };
}

/**
 * Match evidence requirements based on the claim content and issue family.
 */
function matchRequirements(
  applicable: EvidenceRequirement[],
  parsedClaim: ParsedClaim,
  claim: ClaimInput
): string[] {
  const matched: string[] = [];
  const claimText = (
    parsedClaim.claimedDamage + " " + parsedClaim.claimedParts.join(" ")
  ).toLowerCase();

  for (const req of applicable) {
    const family = req.applies_to.toLowerCase();
    const familyKeywords = ISSUE_FAMILY_MAP[family];

    if (!familyKeywords) continue;

    // Special cases: general requirements always match
    if (family === "general claim review" || family === "reviewability") {
      matched.push(req.requirement_id);
      continue;
    }

    if (family === "multi-image rows") {
      // Handled separately in checkEvidenceStandard
      continue;
    }

    // Check if any keyword from this family appears in the claim
    const matches = familyKeywords.some((kw) => claimText.includes(kw));
    if (matches) {
      matched.push(req.requirement_id);
    }
  }

  return matched;
}

/**
 * Get the applicable evidence requirements as a formatted string
 * for inclusion in VLM prompts.
 */
export function getEvidenceContext(
  claim: ClaimInput,
  parsedClaim: ParsedClaim,
  requirements: EvidenceRequirement[]
): string {
  const applicable = requirements.filter(
    (r) => r.claim_object === claim.claim_object || r.claim_object === "all"
  );

  const matched = matchRequirements(applicable, parsedClaim, claim);
  const matchedReqs = requirements.filter((r) =>
    matched.includes(r.requirement_id)
  );

  if (matchedReqs.length === 0) {
    return "No specific evidence requirements matched for this claim.";
  }

  return matchedReqs
    .map(
      (r) =>
        `- [${r.requirement_id}] ${r.applies_to}: ${r.minimum_image_evidence}`
    )
    .join("\n");
}

// ─── Self-Test ──────────────────────────────────────────────────

if (import.meta.main) {
  const { loadEvidenceRequirements } = await import("./data-loader.js");
  const { parseClaim } = await import("./claim-parser.js");
  const { config } = await import("./config.js");
  const { parseImagePaths } = await import("./types.js");
  const { processImages } = await import("./image-processor.js");

  console.log("\n📋 Evidence Checker — Self Test\n");

  const requirements = loadEvidenceRequirements(config.paths.evidenceRequirements);
  console.log(`Loaded ${requirements.length} evidence requirements\n`);

  // Test 1: Car dent claim with valid image
  const carClaim: ClaimInput = {
    user_id: "user_001",
    image_paths: "images/sample/case_001/img_1.jpg",
    user_claim:
      "Customer: The back of the car has a dent now. | Support: What area? | Customer: Mostly the rear bumper area.",
    claim_object: "car",
  };

  const parsed1 = parseClaim(carClaim);
  const imgs1 = parseImagePaths(carClaim.image_paths, config.paths.datasetRoot);
  const processed1 = await processImages(imgs1);
  const result1 = checkEvidenceStandard(carClaim, parsed1, processed1, requirements);

  console.log("Test 1 — Car dent, rear bumper:");
  console.log(`  Evidence met: ${result1.evidenceStandardMet}`);
  console.log(`  Reason: ${result1.reason}`);
  console.log(`  Matched reqs: [${result1.matchedRequirements.join(", ")}]`);

  // Test 2: Package contents claim (tricky)
  const pkgClaim: ClaimInput = {
    user_id: "user_032",
    image_paths: "images/sample/case_018/img_1.jpg;images/sample/case_018/img_2.jpg",
    user_claim:
      "Customer: The item I ordered was not inside the box. | Support: Did the package look opened? | Customer: Please verify that the contents are missing from the package.",
    claim_object: "package",
  };

  const parsed2 = parseClaim(pkgClaim);
  const imgs2 = parseImagePaths(pkgClaim.image_paths, config.paths.datasetRoot);
  const processed2 = await processImages(imgs2);
  const result2 = checkEvidenceStandard(pkgClaim, parsed2, processed2, requirements);

  console.log("\nTest 2 — Package missing contents:");
  console.log(`  Evidence met: ${result2.evidenceStandardMet}`);
  console.log(`  Matched reqs: [${result2.matchedRequirements.join(", ")}]`);

  // Test 3: Evidence context for VLM prompt
  console.log("\nTest 3 — Evidence context for VLM:");
  const context = getEvidenceContext(carClaim, parsed1, requirements);
  console.log(context);

  console.log("\n✅ Evidence checker self-test complete!\n");
}
