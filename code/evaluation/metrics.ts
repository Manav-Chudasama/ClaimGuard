import chalk from "chalk";

// ─── Types ──────────────────────────────────────────────────────

export interface FieldAccuracy {
  field: string;
  total: number;
  correct: number;
  accuracy: number;
  mismatches: { userId: string; expected: string; predicted: string }[];
}

export interface ConfusionEntry {
  expected: string;
  predicted: string;
  count: number;
}

export interface EvaluationResult {
  totalClaims: number;
  matchedClaims: number;
  fieldAccuracies: FieldAccuracy[];
  confusionMatrix: ConfusionEntry[];
  overallScore: number;
}

// ─── Fields to evaluate ─────────────────────────────────────────

/**
 * Fields evaluated with exact string match.
 * We skip free-text fields (justification, reason) since those are subjective.
 */
export const EVALUATED_FIELDS = [
  "claim_status",
  "issue_type",
  "object_part",
  "severity",
  "evidence_standard_met",
  "valid_image",
  "risk_flags",
] as const;

/**
 * Weights for computing overall score.
 * claim_status is the most important field.
 */
const FIELD_WEIGHTS: Record<string, number> = {
  claim_status: 3.0,
  issue_type: 2.0,
  object_part: 1.5,
  severity: 1.5,
  evidence_standard_met: 1.0,
  valid_image: 1.0,
  risk_flags: 1.0,
};

// ─── Comparison Helpers ─────────────────────────────────────────

/**
 * Normalize a field value for comparison.
 * - Lowercase
 * - Trim whitespace
 * - Sort semicolon-separated values (for risk_flags, supporting_image_ids)
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .sort()
    .join(";");
}

/**
 * Compare two field values with normalization.
 */
export function fieldsMatch(expected: string, predicted: string): boolean {
  return normalize(expected) === normalize(predicted);
}

// ─── Metrics Computation ────────────────────────────────────────

/**
 * Compute per-field accuracy by comparing ground truth and predictions.
 */
export function computeFieldAccuracies(
  groundTruth: Record<string, string>[],
  predictions: Map<string, Record<string, string>>
): FieldAccuracy[] {
  const results: FieldAccuracy[] = [];

  for (const field of EVALUATED_FIELDS) {
    const accuracy: FieldAccuracy = {
      field,
      total: 0,
      correct: 0,
      accuracy: 0,
      mismatches: [],
    };

    for (const gt of groundTruth) {
      const userId = gt.user_id;
      const pred = predictions.get(userId);
      if (!pred) continue;

      const expectedVal = gt[field] ?? "";
      const predictedVal = pred[field] ?? "";

      accuracy.total++;

      if (fieldsMatch(expectedVal, predictedVal)) {
        accuracy.correct++;
      } else {
        accuracy.mismatches.push({
          userId,
          expected: expectedVal,
          predicted: predictedVal,
        });
      }
    }

    accuracy.accuracy =
      accuracy.total > 0 ? accuracy.correct / accuracy.total : 0;
    results.push(accuracy);
  }

  return results;
}

/**
 * Build a confusion matrix for the claim_status field.
 */
export function buildConfusionMatrix(
  groundTruth: Record<string, string>[],
  predictions: Map<string, Record<string, string>>
): ConfusionEntry[] {
  const counts = new Map<string, number>();

  for (const gt of groundTruth) {
    const userId = gt.user_id;
    const pred = predictions.get(userId);
    if (!pred) continue;

    const expected = normalize(gt.claim_status ?? "");
    const predicted = normalize(pred.claim_status ?? "");
    const key = `${expected}|${predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const entries: ConfusionEntry[] = [];
  for (const [key, count] of counts) {
    const [expected, predicted] = key.split("|");
    entries.push({ expected, predicted, count });
  }

  return entries.sort((a, b) => a.expected.localeCompare(b.expected));
}

/**
 * Compute weighted overall score.
 */
export function computeOverallScore(
  fieldAccuracies: FieldAccuracy[]
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const fa of fieldAccuracies) {
    const weight = FIELD_WEIGHTS[fa.field] ?? 1.0;
    totalWeight += weight;
    weightedSum += fa.accuracy * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ─── Console Output ─────────────────────────────────────────────

/**
 * Print evaluation results to the console with colors.
 */
export function printEvaluationResults(result: EvaluationResult): void {
  console.log("");
  console.log(chalk.bold.cyan("━".repeat(70)));
  console.log(chalk.bold.cyan("📊 Evaluation Results"));
  console.log(chalk.bold.cyan("━".repeat(70)));

  console.log(
    chalk.white(
      `\n   Matched: ${result.matchedClaims} / ${result.totalClaims} claims\n`
    )
  );

  // Field accuracy table
  console.log(
    chalk.bold.white(
      "   " +
        "Field".padEnd(28) +
        "Accuracy".padEnd(12) +
        "Correct".padEnd(10) +
        "Total"
    )
  );
  console.log(chalk.dim("   " + "─".repeat(60)));

  for (const fa of result.fieldAccuracies) {
    const pct = (fa.accuracy * 100).toFixed(1) + "%";
    const color =
      fa.accuracy >= 0.85
        ? chalk.green
        : fa.accuracy >= 0.7
          ? chalk.yellow
          : chalk.red;

    console.log(
      `   ${chalk.white(fa.field.padEnd(28))}${color(pct.padEnd(12))}${chalk.white(String(fa.correct).padEnd(10))}${chalk.white(String(fa.total))}`
    );
  }

  // Overall
  const overallPct = (result.overallScore * 100).toFixed(1) + "%";
  const overallColor =
    result.overallScore >= 0.85
      ? chalk.green.bold
      : result.overallScore >= 0.7
        ? chalk.yellow.bold
        : chalk.red.bold;

  console.log(chalk.dim("   " + "─".repeat(60)));
  console.log(
    `   ${chalk.bold.white("WEIGHTED OVERALL".padEnd(28))}${overallColor(overallPct)}`
  );

  // Confusion matrix
  console.log(chalk.bold.cyan("\n\n   📋 Claim Status Confusion Matrix\n"));
  console.log(
    chalk.bold.white(
      "   " +
        "Expected".padEnd(28) +
        "Predicted".padEnd(28) +
        "Count"
    )
  );
  console.log(chalk.dim("   " + "─".repeat(65)));

  for (const entry of result.confusionMatrix) {
    const isCorrect = entry.expected === entry.predicted;
    const color = isCorrect ? chalk.green : chalk.red;
    console.log(
      `   ${chalk.white(entry.expected.padEnd(28))}${color(entry.predicted.padEnd(28))}${chalk.white(String(entry.count))}`
    );
  }

  // Mismatches detail
  const criticalField = result.fieldAccuracies.find(
    (f) => f.field === "claim_status"
  );
  if (criticalField && criticalField.mismatches.length > 0) {
    console.log(
      chalk.bold.yellow("\n\n   ⚠ Claim Status Mismatches:\n")
    );
    for (const mm of criticalField.mismatches) {
      console.log(
        chalk.yellow(
          `   ${mm.userId}: expected "${mm.expected}" → got "${mm.predicted}"`
        )
      );
    }
  }

  console.log(chalk.bold.cyan("\n" + "━".repeat(70) + "\n"));
}

// ─── Markdown Report ────────────────────────────────────────────

/**
 * Generate a markdown report string from evaluation results.
 */
export function generateMarkdownReport(result: EvaluationResult): string {
  const lines: string[] = [];

  lines.push("# Evaluation Report");
  lines.push("");
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(
    `**Claims evaluated**: ${result.matchedClaims} / ${result.totalClaims}`
  );
  lines.push(
    `**Overall weighted score**: ${(result.overallScore * 100).toFixed(1)}%`
  );
  lines.push("");

  // Field accuracy table
  lines.push("## Field-Level Accuracy");
  lines.push("");
  lines.push("| Field | Accuracy | Correct | Total |");
  lines.push("|---|---|---|---|");

  for (const fa of result.fieldAccuracies) {
    const pct = (fa.accuracy * 100).toFixed(1) + "%";
    const emoji = fa.accuracy >= 0.85 ? "✅" : fa.accuracy >= 0.7 ? "⚠️" : "❌";
    lines.push(
      `| ${emoji} ${fa.field} | ${pct} | ${fa.correct} | ${fa.total} |`
    );
  }

  lines.push("");

  // Confusion matrix
  lines.push("## Claim Status Confusion Matrix");
  lines.push("");
  lines.push("| Expected | Predicted | Count |");
  lines.push("|---|---|---|");

  for (const entry of result.confusionMatrix) {
    const emoji = entry.expected === entry.predicted ? "✅" : "❌";
    lines.push(
      `| ${entry.expected} | ${emoji} ${entry.predicted} | ${entry.count} |`
    );
  }

  lines.push("");

  // Mismatches
  const claimStatusField = result.fieldAccuracies.find(
    (f) => f.field === "claim_status"
  );
  if (claimStatusField && claimStatusField.mismatches.length > 0) {
    lines.push("## Claim Status Mismatches");
    lines.push("");
    lines.push("| User ID | Expected | Predicted |");
    lines.push("|---|---|---|");

    for (const mm of claimStatusField.mismatches) {
      lines.push(`| ${mm.userId} | ${mm.expected} | ${mm.predicted} |`);
    }

    lines.push("");
  }

  // All field mismatches
  lines.push("## All Field Mismatches");
  lines.push("");

  for (const fa of result.fieldAccuracies) {
    if (fa.mismatches.length === 0) continue;

    lines.push(`### ${fa.field} (${(fa.accuracy * 100).toFixed(1)}%)`);
    lines.push("");
    lines.push("| User ID | Expected | Predicted |");
    lines.push("|---|---|---|");

    for (const mm of fa.mismatches) {
      lines.push(
        `| ${mm.userId} | ${mm.expected.slice(0, 50)} | ${mm.predicted.slice(0, 50)} |`
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}
