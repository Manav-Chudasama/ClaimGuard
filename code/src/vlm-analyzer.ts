import OpenAI from "openai";
import type {
  ClaimInput,
  UserHistory,
  ProcessedImage,
  VLMResponse,
} from "./types.js";
import {
  VLMResponseSchema,
  getObjectPartsForType,
  isValidObjectPart,
} from "./types.js";
import type { ParsedClaim } from "./claim-parser.js";
import { config, getApiKey } from "./config.js";
import { SYSTEM_PROMPT, buildClaimPrompt, buildImageMessages } from "./prompts.js";
import { withRetry } from "./retry.js";
import { getEvidenceContext } from "./evidence-checker.js";

// ─── OpenAI Client ──────────────────────────────────────────────

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: getApiKey(),
      timeout: config.timeout.apiCallMs,
    });
  }
  return client;
}

// ─── VLM Analyzer ───────────────────────────────────────────────

/**
 * Analyze a single claim using GPT-4o Vision.
 *
 * Sends the processed images + claim context to the VLM and returns
 * a Zod-validated structured response.
 */
export async function analyzeClaim(
  claim: ClaimInput,
  parsedClaim: ParsedClaim,
  userHistory: UserHistory | undefined,
  images: ProcessedImage[],
  evidenceRequirements: import("./types.js").EvidenceRequirement[]
): Promise<VLMResponse> {
  const openai = getClient();

  // Build evidence context string
  const evidenceContext = getEvidenceContext(
    claim,
    parsedClaim,
    evidenceRequirements
  );

  // Build the image IDs list
  const imageIds = images.filter((i) => i.valid).map((i) => i.id);

  // Build the user prompt
  const userPrompt = buildClaimPrompt(
    claim,
    parsedClaim,
    evidenceContext,
    userHistory,
    imageIds
  );

  // Build the image message parts
  const imageMessages = buildImageMessages(images);

  // Construct the full messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        ...imageMessages,
      ],
    },
  ];

  // Call the API with retry
  const response = await withRetry(
    async () => {
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages,
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from VLM");
      }

      // Parse the JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error(
          `Failed to parse VLM JSON response: ${content.slice(0, 200)}`
        );
      }

      // Validate with Zod
      const validated = VLMResponseSchema.safeParse(parsed);
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`VLM response validation failed: ${issues}`);
      }

      return validated.data;
    },
    {
      maxRetries: config.retry.maxRetries,
      initialDelayMs: config.retry.initialDelayMs,
      maxDelayMs: config.retry.maxDelayMs,
      backoffMultiplier: config.retry.backoffMultiplier,
      jitterMs: config.retry.jitterMs,
      onRetry: (attempt, error, delayMs) => {
        console.warn(
          `  ⚠ Retry ${attempt}/${config.retry.maxRetries} for ${claim.user_id}: ${error.message.slice(0, 100)}... (waiting ${Math.round(delayMs)}ms)`
        );
      },
    }
  );

  // Post-validate: ensure object_part is valid for the claim_object
  return postValidate(response, claim);
}

// ─── Post-Validation ────────────────────────────────────────────

/**
 * Correct any schema-valid but semantically wrong values.
 * For example, a laptop part appearing in a car claim.
 */
function postValidate(response: VLMResponse, claim: ClaimInput): VLMResponse {
  const result = { ...response };

  // Fix object_part if it's not valid for this claim_object
  if (!isValidObjectPart(claim.claim_object, result.object_part)) {
    const allowedParts = getObjectPartsForType(claim.claim_object);
    // Try to find a close match
    const lower = result.object_part.toLowerCase().replace(/\s+/g, "_");
    const match = allowedParts.find((p) => p === lower);
    result.object_part = match ?? "unknown";
  }

  // Ensure risk_flags consistency
  if (result.risk_flags.length === 0) {
    result.risk_flags = ["none"];
  }

  // If risk_flags has "none" AND other flags, remove "none"
  if (
    result.risk_flags.length > 1 &&
    result.risk_flags.includes("none")
  ) {
    result.risk_flags = result.risk_flags.filter((f) => f !== "none");
  }

  // If claim_mismatch or user_history_risk, ensure manual_review_required is present
  if (
    (result.risk_flags.includes("claim_mismatch") ||
      result.risk_flags.includes("user_history_risk")) &&
    !result.risk_flags.includes("manual_review_required")
  ) {
    result.risk_flags.push("manual_review_required");
  }

  // Ensure supporting_image_ids is empty if claim is contradicted with no support
  if (
    result.claim_status === "contradicted" &&
    result.supporting_image_ids.length > 0
  ) {
    // This is acceptable — supporting images can show what contradicts the claim
    // Keep as-is per the problem statement examples
  }

  return result;
}

// ─── Self-Test ──────────────────────────────────────────────────

if (import.meta.main) {
  const { loadClaims, loadUserHistory, loadEvidenceRequirements } =
    await import("./data-loader.js");
  const { parseClaim } = await import("./claim-parser.js");
  const { processImages } = await import("./image-processor.js");
  const { parseImagePaths } = await import("./types.js");

  console.log("\n🤖 VLM Analyzer — Self Test\n");

  // Load data
  const sampleClaims = loadClaims(config.paths.sampleClaims);
  const userHistory = loadUserHistory(config.paths.userHistory);
  const evidenceReqs = loadEvidenceRequirements(
    config.paths.evidenceRequirements
  );

  // Test with the first sample claim
  const claim = sampleClaims[0];
  console.log(`Testing with: ${claim.user_id}`);
  console.log(`  Object: ${claim.claim_object}`);
  console.log(`  Images: ${claim.image_paths}`);
  console.log(
    `  Claim: ${claim.user_claim.slice(0, 100)}...`
  );

  // Parse the claim
  const parsed = parseClaim(claim);
  console.log(`  Parsed damage: "${parsed.claimedDamage}"`);
  console.log(`  Parsed parts: [${parsed.claimedParts.join(", ")}]`);

  // Process images
  const imageInfos = parseImagePaths(
    claim.image_paths,
    config.paths.datasetRoot
  );
  const images = await processImages(imageInfos);
  console.log(
    `  Images processed: ${images.filter((i) => i.valid).length}/${images.length} valid`
  );

  // Get user history
  const history = userHistory.get(claim.user_id);

  // Analyze!
  console.log("\n  📡 Sending to GPT-4o...\n");
  const startTime = Date.now();

  try {
    const result = await analyzeClaim(
      claim,
      parsed,
      history,
      images,
      evidenceReqs
    );
    const elapsed = Date.now() - startTime;

    console.log("  ✅ VLM Response (validated):");
    console.log(`    evidence_standard_met: ${result.evidence_standard_met}`);
    console.log(`    evidence_standard_met_reason: "${result.evidence_standard_met_reason}"`);
    console.log(`    risk_flags: [${result.risk_flags.join(", ")}]`);
    console.log(`    issue_type: ${result.issue_type}`);
    console.log(`    object_part: ${result.object_part}`);
    console.log(`    claim_status: ${result.claim_status}`);
    console.log(`    claim_status_justification: "${result.claim_status_justification}"`);
    console.log(`    supporting_image_ids: [${result.supporting_image_ids.join(", ")}]`);
    console.log(`    valid_image: ${result.valid_image}`);
    console.log(`    severity: ${result.severity}`);
    console.log(`\n  ⏱  Completed in ${elapsed}ms`);
  } catch (error) {
    console.error(
      `  ❌ Error: ${error instanceof Error ? error.message : error}`
    );
  }

  console.log("\n✅ VLM analyzer self-test complete!\n");
}
