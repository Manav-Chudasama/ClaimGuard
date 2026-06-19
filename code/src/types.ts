import { z } from "zod";

// ─── Input Schemas ───────────────────────────────────────────────

/** Raw row from claims.csv or sample_claims.csv (input columns only) */
export interface ClaimInput {
  user_id: string;
  image_paths: string; // semicolon-separated
  user_claim: string; // chat transcript
  claim_object: "car" | "laptop" | "package";
}

/** Parsed image paths from a claim */
export interface ImageInfo {
  id: string; // filename without extension, e.g. "img_1"
  path: string; // relative path, e.g. "images/test/case_001/img_1.jpg"
  absolutePath: string; // resolved absolute path on disk
}

/** Row from user_history.csv */
export interface UserHistory {
  user_id: string;
  past_claim_count: number;
  accept_claim: number;
  manual_review_claim: number;
  rejected_claim: number;
  last_90_days_claim_count: number;
  history_flags: string; // semicolon-separated or "none"
  history_summary: string;
}

/** Row from evidence_requirements.csv */
export interface EvidenceRequirement {
  requirement_id: string;
  claim_object: "car" | "laptop" | "package" | "all";
  applies_to: string;
  minimum_image_evidence: string;
}

/** Processed image data ready for API submission */
export interface ProcessedImage {
  id: string;
  path: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  originalSizeBytes: number;
  processedSizeBytes: number;
  valid: boolean;
  error?: string;
}

// ─── Output Schemas ──────────────────────────────────────────────

/** All allowed values from the problem statement */

export const CLAIM_STATUS_VALUES = [
  "supported",
  "contradicted",
  "not_enough_information",
] as const;

export const ISSUE_TYPE_VALUES = [
  "dent",
  "scratch",
  "crack",
  "glass_shatter",
  "broken_part",
  "missing_part",
  "torn_packaging",
  "crushed_packaging",
  "water_damage",
  "stain",
  "none",
  "unknown",
] as const;

export const CAR_OBJECT_PARTS = [
  "front_bumper",
  "rear_bumper",
  "door",
  "hood",
  "windshield",
  "side_mirror",
  "headlight",
  "taillight",
  "fender",
  "quarter_panel",
  "body",
  "unknown",
] as const;

export const LAPTOP_OBJECT_PARTS = [
  "screen",
  "keyboard",
  "trackpad",
  "hinge",
  "lid",
  "corner",
  "port",
  "base",
  "body",
  "unknown",
] as const;

export const PACKAGE_OBJECT_PARTS = [
  "box",
  "package_corner",
  "package_side",
  "seal",
  "label",
  "contents",
  "item",
  "unknown",
] as const;

export const ALL_OBJECT_PARTS = [
  ...CAR_OBJECT_PARTS,
  ...LAPTOP_OBJECT_PARTS,
  ...PACKAGE_OBJECT_PARTS,
] as const;

export const RISK_FLAG_VALUES = [
  "none",
  "blurry_image",
  "cropped_or_obstructed",
  "low_light_or_glare",
  "wrong_angle",
  "wrong_object",
  "wrong_object_part",
  "damage_not_visible",
  "claim_mismatch",
  "possible_manipulation",
  "non_original_image",
  "text_instruction_present",
  "user_history_risk",
  "manual_review_required",
] as const;

export const SEVERITY_VALUES = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;

// ─── Zod Schemas ─────────────────────────────────────────────────

/** Schema for what the VLM should return per claim */
export const VLMResponseSchema = z.object({
  evidence_standard_met: z.boolean(),
  evidence_standard_met_reason: z.string().min(1),
  risk_flags: z.array(z.enum(RISK_FLAG_VALUES)),
  issue_type: z.enum(ISSUE_TYPE_VALUES),
  object_part: z.string(), // validated per-object-type separately
  claim_status: z.enum(CLAIM_STATUS_VALUES),
  claim_status_justification: z.string().min(1),
  supporting_image_ids: z.array(z.string()),
  valid_image: z.boolean(),
  severity: z.enum(SEVERITY_VALUES),
});

export type VLMResponse = z.infer<typeof VLMResponseSchema>;

/** Schema for a complete output row */
export const ClaimOutputSchema = z.object({
  user_id: z.string(),
  image_paths: z.string(),
  user_claim: z.string(),
  claim_object: z.enum(["car", "laptop", "package"]),
  evidence_standard_met: z.string(), // "true" or "false" as string for CSV
  evidence_standard_met_reason: z.string(),
  risk_flags: z.string(), // semicolon-separated or "none"
  issue_type: z.string(),
  object_part: z.string(),
  claim_status: z.string(),
  claim_status_justification: z.string(),
  supporting_image_ids: z.string(), // semicolon-separated or "none"
  valid_image: z.string(), // "true" or "false" as string for CSV
  severity: z.string(),
});

export type ClaimOutput = z.infer<typeof ClaimOutputSchema>;

/** The ordered column names for output.csv */
export const OUTPUT_COLUMNS: (keyof ClaimOutput)[] = [
  "user_id",
  "image_paths",
  "user_claim",
  "claim_object",
  "evidence_standard_met",
  "evidence_standard_met_reason",
  "risk_flags",
  "issue_type",
  "object_part",
  "claim_status",
  "claim_status_justification",
  "supporting_image_ids",
  "valid_image",
  "severity",
];

// ─── Helpers ─────────────────────────────────────────────────────

/** Get allowed object parts for a specific claim object type */
export function getObjectPartsForType(
  claimObject: "car" | "laptop" | "package"
): readonly string[] {
  switch (claimObject) {
    case "car":
      return CAR_OBJECT_PARTS;
    case "laptop":
      return LAPTOP_OBJECT_PARTS;
    case "package":
      return PACKAGE_OBJECT_PARTS;
  }
}

/** Validate that an object_part is valid for the given claim_object */
export function isValidObjectPart(
  claimObject: "car" | "laptop" | "package",
  part: string
): boolean {
  return (getObjectPartsForType(claimObject) as readonly string[]).includes(
    part
  );
}

/** Parse semicolon-separated image paths into ImageInfo[] */
export function parseImagePaths(
  imagePaths: string,
  datasetRoot: string
): ImageInfo[] {
  return imagePaths.split(";").map((p) => {
    const trimmed = p.trim();
    const filename = trimmed.split("/").pop() ?? "";
    const id = filename.replace(/\.[^.]+$/, ""); // remove extension
    return {
      id,
      path: trimmed,
      absolutePath: `${datasetRoot}/${trimmed}`,
    };
  });
}

/** Sample claims CSV row (includes expected output columns) */
export interface SampleClaimRow extends ClaimInput {
  evidence_standard_met: string;
  evidence_standard_met_reason: string;
  risk_flags: string;
  issue_type: string;
  object_part: string;
  claim_status: string;
  claim_status_justification: string;
  supporting_image_ids: string;
  valid_image: string;
  severity: string;
}
