/**
 * ClaimGuard — Evaluation Entry Point
 *
 * Usage: bun run evaluation/main.ts
 *        or: bun run evaluate (via package.json script)
 *
 * Runs the evaluation pipeline:
 * 1. Loads ground truth from dataset/sample_claims.csv
 * 2. Loads predictions from dataset/sample_output.csv
 * 3. Computes field-level accuracy metrics
 * 4. Generates evaluation_report.md
 */

import { resolve } from "path";
import { evaluate } from "./evaluate.js";

const datasetRoot = resolve(import.meta.dir, "../../dataset");
const evaluationDir = resolve(import.meta.dir);

const groundTruthPath = resolve(datasetRoot, "sample_claims.csv");
const predictionsPath = resolve(datasetRoot, "sample_output.csv");
const reportPath = resolve(evaluationDir, "evaluation_report.md");

evaluate(groundTruthPath, predictionsPath, reportPath);
