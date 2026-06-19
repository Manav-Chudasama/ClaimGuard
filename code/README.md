# ClaimGuard — Multi-Modal Evidence Review System

ClaimGuard is a system designed to verify damage claims by analyzing submitted images, claim conversations, user history, and evidence requirements. It leverages GPT-4o to act as an objective, detail-oriented insurance claim reviewer.

## Features

- **Multi-Modal Analysis**: Uses OpenAI's Vision capabilities to verify physical damage against the user's text claim.
- **Robust Orchestration**: Implements an orchestration pipeline featuring a Claim Parser, Image Processor, Evidence Checker, and a Risk Flagger.
- **Deterministic Calibration**: Enforces strict logical consistency on VLM outputs (e.g., if a claim is contradicted due to lack of visible damage, the severity and issue type are explicitly forced to "none").
- **Adversarial Defense**: Actively detects and mitigates text injection attempts (e.g., "approve this claim") embedded in images.
- **Performance & Stability**: Built on Bun with robust rate limiting, exponential backoff, and concurrent processing limits (`p-limit`).

## Setup Instructions

1. **Install Bun**: Make sure [Bun](https://bun.sh/) is installed on your system.
2. **Install Dependencies**: Run the following command in the `code/` directory:
   ```bash
   bun install
   ```
3. **Environment Variables**: Create a `.env` file in the `code/` directory based on `.env.example` and add your API key:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o
   ```

## Running the Pipeline

To run the pipeline on the main `claims.csv` dataset, execute:

```bash
bun run start
```

This will:
1. Parse the datasets (`claims.csv`, `user_history.csv`, `evidence_requirements.csv`).
2. Process the images (resize and encode).
3. Send the formatted prompts to the VLM.
4. Run deterministic calibrators and risk flaggers.
5. Generate the final results to `../dataset/output.csv`.

## Evaluation

An evaluation framework is included to benchmark the pipeline against a ground-truth dataset (`sample_claims.csv`).

To run the evaluation:
```bash
bun run evaluate
```

### Evaluated Accuracy Metrics (Sample Set)

After prompt tuning and the implementation of our accuracy improvement calibrator, the system achieved the following metrics on the sample evaluation set:

- **Claim Status Accuracy**: 95.0%
- **Object Part Accuracy**: 90.0%
- **Valid Image Accuracy**: 90.0%
- **Severity Accuracy**: 80.0%
- **Evidence Standard Met Accuracy**: 80.0%
- **Risk Flags Accuracy**: 75.0%
- **Issue Type Accuracy**: 70.0%
- **Weighted Overall Score**: 84.1%

## Architecture

1. **Data Loader**: Parses all CSV datasets robustly.
2. **Claim Parser**: Extracts structured intents and damage claims from conversational transcripts.
3. **Image Processor**: Optimizes images (downsizing via Sharp) for cost-effective VLM processing.
4. **Evidence Checker**: Maps claim objects to specific minimum evidence requirements.
5. **VLM Analyzer**: Formats the multi-modal prompt with anti-injection safeguards and parses strictly typed JSON outputs from the model.
6. **Calibrator**: A post-processing layer that enforces logical constraints on the VLM's raw output.
7. **Risk Flagger**: Combines VLM flags, User History flags, and applies final logic to determine whether manual review is required.
8. **Output Writer**: Formats the output safely into a 14-column CSV exactly matching the required schema.
