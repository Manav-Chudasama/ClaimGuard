/**
 * Evaluation Orchestrator
 *
 * Loads ground truth (sample_claims.csv) and predictions (sample_output.csv),
 * computes field-level accuracy metrics, and generates a report.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";
import chalk from "chalk";
import {
  computeFieldAccuracies,
  buildConfusionMatrix,
  computeOverallScore,
  printEvaluationResults,
  generateMarkdownReport,
  type EvaluationResult,
} from "./metrics.js";

// ─── CSV Loader ─────────────────────────────────────────────────

function loadCsvAsRecords(filePath: string): Record<string, string>[] {
  const raw = readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

// ─── Main Evaluation ────────────────────────────────────────────

export function evaluate(
  groundTruthPath: string,
  predictionsPath: string,
  reportOutputPath: string
): EvaluationResult {
  console.log("");
  console.log(chalk.bold.cyan("🛡️  ClaimGuard — Evaluation"));
  console.log(chalk.bold.cyan("━".repeat(70)));

  // Load data
  console.log(chalk.blue("\n📂 Loading data..."));
  const groundTruth = loadCsvAsRecords(groundTruthPath);
  const predictionsArr = loadCsvAsRecords(predictionsPath);

  console.log(chalk.gray(`   Ground truth: ${groundTruth.length} rows from ${groundTruthPath}`));
  console.log(chalk.gray(`   Predictions:  ${predictionsArr.length} rows from ${predictionsPath}`));

  // Build predictions map by user_id
  const predictions = new Map<string, Record<string, string>>();
  for (const row of predictionsArr) {
    predictions.set(row.user_id, row);
  }

  // Check for missing predictions
  const missingUsers: string[] = [];
  for (const gt of groundTruth) {
    if (!predictions.has(gt.user_id)) {
      missingUsers.push(gt.user_id);
    }
  }

  if (missingUsers.length > 0) {
    console.log(
      chalk.yellow(
        `   ⚠ ${missingUsers.length} ground truth claims have no prediction: ${missingUsers.join(", ")}`
      )
    );
  }

  // Compute metrics
  console.log(chalk.blue("\n📊 Computing metrics..."));
  const fieldAccuracies = computeFieldAccuracies(groundTruth, predictions);
  const confusionMatrix = buildConfusionMatrix(groundTruth, predictions);
  const overallScore = computeOverallScore(fieldAccuracies);

  const result: EvaluationResult = {
    totalClaims: groundTruth.length,
    matchedClaims: groundTruth.length - missingUsers.length,
    fieldAccuracies,
    confusionMatrix,
    overallScore,
  };

  // Print results
  printEvaluationResults(result);

  // Generate markdown report
  const report = generateMarkdownReport(result);
  writeFileSync(reportOutputPath, report, "utf-8");
  console.log(chalk.green(`   ✓ Report saved to: ${reportOutputPath}\n`));

  return result;
}

// ─── Self-Test (when run directly) ──────────────────────────────

if (import.meta.main) {
  const datasetRoot = resolve(import.meta.dir, "../../dataset");
  const evaluationDir = resolve(import.meta.dir);

  const groundTruthPath = resolve(datasetRoot, "sample_claims.csv");
  const predictionsPath = resolve(datasetRoot, "sample_output.csv");
  const reportPath = resolve(evaluationDir, "evaluation_report.md");

  evaluate(groundTruthPath, predictionsPath, reportPath);
}
