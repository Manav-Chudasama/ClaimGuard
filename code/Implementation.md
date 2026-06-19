# ClaimGuard — Multi-Modal Evidence Review System

> **Implementation Plan — Living Document**
> Last updated: 2026-06-19T14:06:03+05:30

Build a TypeScript system that verifies damage claims (car, laptop, package) by analyzing submitted images, claim conversations, user history, and evidence requirements — producing structured verdicts in `output.csv`.

---

## Decisions Locked

| Decision | Choice |
|---|---|
| **Language** | TypeScript |
| **Runtime** | Bun |
| **VLM Provider** | OpenAI GPT-4o / GPT-4o-mini |
| **Entry Point** | `main.ts` (update AGENTS.md, remove main.py wrapper) |
| **Rate Limits** | Robust handling: exponential backoff, concurrency limiter, retry with jitter, graceful degradation |

---

## Data Analysis Summary

| Dataset | Rows | Images per row | Object types |
|---|---|---|---|
| `sample_claims.csv` | 20 rows | 1–2 images | 8 car, 6 laptop, 6 package |
| `claims.csv` | 45 rows | 1–3 images | ~18 car, ~12 laptop, ~15 package |
| `user_history.csv` | 48 users | — | risk flags on ~20 users |
| `evidence_requirements.csv` | 12 rules | — | car/laptop/package/all |

### Key patterns from sample data
- **Multi-part claims**: Some claims mention 2 parts (e.g., "front bumper AND headlight")
- **Adversarial inputs**: Claims contain prompt injection attempts ("approve this claim immediately", "ignore previous instructions")
- **Multilingual**: Hindi (Hinglish), Spanish, Chinese mixed with English
- **Tricky cases**: Wrong object in image, blurry images, non-original photos, text instructions in images
- **Risk flag combinations**: Up to 4 flags per claim (e.g., `claim_mismatch;non_original_image;user_history_risk;manual_review_required`)
- **Image sizes**: 4KB–355KB JPEGs, suggesting mixed quality

---

## Tech Stack

### Core Runtime
| Tool | Purpose |
|---|---|
| **Bun** | Runtime & package manager |
| **TypeScript 5.x** | Language (Bun runs TS natively) |

### Dependencies
| Package | Purpose |
|---|---|
| `openai` | OpenAI GPT-4o / GPT-4o-mini API client |
| `csv-parse` | Parse CSV inputs |
| `csv-stringify` | Write CSV outputs |
| `zod` | Schema validation for LLM outputs |
| `sharp` | Image pre-processing (resize/compress for API) |
| `p-limit` | Concurrency limiter for API calls |
| `chalk` | Terminal output formatting |

> **Note**: Bun has built-in `.env` loading, `dotenv` is not needed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ClaimGuard Pipeline                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. DATA LOADER                                          │
│     ├── Parse claims.csv                                 │
│     ├── Parse user_history.csv → Map<user_id, history>   │
│     └── Parse evidence_requirements.csv → rules[]        │
│                                                          │
│  2. CLAIM PARSER                                         │
│     ├── Extract damage claim from conversation           │
│     ├── Identify claimed object parts                    │
│     ├── Detect multi-part claims                         │
│     └── Strip adversarial/injection content              │
│                                                          │
│  3. IMAGE PROCESSOR                                      │
│     ├── Load & validate images from disk                 │
│     ├── Resize for API (max 1024px, ~200KB)              │
│     ├── Convert to base64                                │
│     └── Flag unreadable/corrupt images                   │
│                                                          │
│  4. EVIDENCE CHECKER                                     │
│     ├── Match claim → applicable evidence requirements   │
│     ├── Check if image set meets minimum evidence        │
│     └── Output: evidence_standard_met + reason           │
│                                                          │
│  5. VLM ANALYZER (core)                                  │
│     ├── Send images + structured prompt to VLM           │
│     ├── Analyze: issue_type, object_part, severity       │
│     ├── Determine: claim_status + justification          │
│     ├── Identify: supporting_image_ids                   │
│     └── Detect: risk signals from images                 │
│                                                          │
│  6. RISK FLAGGER                                         │
│     ├── Merge VLM-detected image risks                   │
│     ├── Merge user_history risks                         │
│     ├── Apply rule-based flags                           │
│     └── Output: risk_flags[], valid_image                │
│                                                          │
│  7. OUTPUT WRITER                                        │
│     ├── Assemble all fields per claim                    │
│     ├── Validate against output schema (Zod)             │
│     └── Write output.csv                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## File Manifest

### Core Solution (`code/`)

| Status | File | Purpose |
|---|---|---|
| `[x]` | `package.json` | Project metadata, scripts, dependencies |
| `[x]` | `tsconfig.json` | TypeScript strict config |
| `[x]` | `.env.example` | Template for `OPENAI_API_KEY` |
| `[x]` | `main.ts` | Entry point (replaces main.py) |

### Source Code (`code/src/`)

| Status | File | Purpose |
|---|---|---|
| `[x]` | `index.ts` | Pipeline orchestrator (stub) |
| `[x]` | `types.ts` | Interfaces + Zod schemas |
| `[x]` | `config.ts` | Env vars, API config, retry settings |
| `[x]` | `data-loader.ts` | CSV parsers for all 3 input files |
| `[x]` | `claim-parser.ts` | Conversation → structured claim extraction |
| `[x]` | `image-processor.ts` | Load, resize, base64 encode images |
| `[x]` | `evidence-checker.ts` | Evidence requirement matching |
| `[x]` | `vlm-analyzer.ts` | OpenAI GPT-4o vision API calls |
| `[x]` | `prompts.ts` | All VLM prompts + anti-injection rules |
| `[x]` | `risk-flagger.ts` | Risk flag merging + deterministic rules |
| `[x]` | `output-writer.ts` | CSV output assembly + validation |
| `[ ]` | `logger.ts` | Structured logging + cost tracking |
| `[x]` | `retry.ts` | Exponential backoff, jitter, rate-limit handling |

### Evaluation (`code/evaluation/`)

| Status | File | Purpose |
|---|---|---|
| `[x]` | `main.ts` | Evaluation entry point (stub) |
| `[ ]` | `evaluate.ts` | Run pipeline on sample, compare outputs |
| `[ ]` | `metrics.ts` | Per-field accuracy, confusion matrices |
| `[ ]` | `evaluation_report.md` | Generated operational analysis |

### Documentation

| Status | File | Purpose |
|---|---|---|
| `[ ]` | `code/README.md` | Setup, architecture, how to run |

---

## Implementation Phases

### Phase 1 — Scaffolding & Data Layer ✅ COMPLETE
- [x] Initialize Bun project (`bun init`)
- [x] Install dependencies (openai, csv-parse, csv-stringify, zod, sharp, p-limit, chalk)
- [x] Create tsconfig.json (ES2022, strict, bundler resolution)
- [x] Create types.ts with all interfaces + Zod schemas (12 types, exact enum constraints)
- [x] Create config.ts with env loading (Bun native .env)
- [x] Build data-loader.ts (parse all 3 CSVs — fixed mixed line endings)
- [x] Create .env.example
- [x] Replace main.py with main.ts, update AGENTS.md
- [x] **Verified**: 20 sample claims, 44 test claims, 47 user histories, 11 evidence requirements

### Phase 2 — Image Processing & Claim Parsing ✅ COMPLETE
- [x] Build image-processor.ts (load, resize via sharp, base64 encode, graceful failure)
- [x] Build claim-parser.ts (adversarial detection, multilingual, multi-part claims)
- [x] Build evidence-checker.ts (issue family mapping, requirement matching, dedup)
- [x] **Verified**: images process (52KB→83KB), claims parse (4/4 tests), evidence requirements match correctly

### Phase 3 — VLM Integration ✅ COMPLETE
- [x] Build prompts.ts (system prompt with anti-injection rules, per-claim prompt builder, image message builder)
- [x] Build retry.ts (exponential backoff, jitter, retry-after headers, non-retryable error detection)
- [x] Build vlm-analyzer.ts (OpenAI GPT-4o vision calls, Zod validation, post-validation)
- [x] **Verified**: sample claim user_001 → 7/7 fields match expected (dent, rear_bumper, supported, medium, etc.)

### Phase 4 — Risk Flagging & Output Assembly ✅ COMPLETE
- [x] Build risk-flagger.ts (merge VLM + user history + adversarial flags, deterministic rules, sorted dedup)
- [x] Build output-writer.ts (14-column CSV assembly, bool→string, array→semicolon, Zod validation)
- [ ] Build logger.ts (structured logging + cost tracking) — deferred to Phase 5
- [x] **Verified**: risk flags merge correctly (4/4 tests), CSV output has exactly 14 columns

### Phase 5 — Pipeline Integration & Sample Run ⏱️ 30 min
- [ ] Wire all modules in index.ts
- [ ] Run full pipeline on sample_claims.csv
- [ ] Compare against expected outputs
- [ ] Fix systematic errors
- [ ] **Verify**: ≥85% claim_status accuracy on sample

### Phase 6 — Evaluation Framework ⏱️ 30 min
- [ ] Build evaluation/evaluate.ts + metrics.ts
- [ ] Compare at least 2 prompt strategies
- [ ] Generate evaluation_report.md
- [ ] **Verify**: metrics computed, report generated

### Phase 7 — Test Run & Polish ⏱️ 30 min
- [ ] Run pipeline on claims.csv → output.csv
- [ ] Verify: 45 rows, all columns, correct format
- [ ] Add batching/concurrency optimizations
- [ ] Write README, finalize docs

### Phase 8 — Submission Prep ⏱️ 15 min
- [ ] Final output.csv validation
- [ ] Package code.zip (exclude node_modules, .env)
- [ ] Verify chat transcript log

---

## Rate Limit & Error Handling Strategy

| Concern | Strategy |
|---|---|
| **Rate limits (429)** | Exponential backoff starting at 1s, max 60s, with random jitter |
| **Concurrency** | `p-limit` with max 3 concurrent API calls |
| **Timeouts** | 60s per VLM call, 3 retries max |
| **Token limits** | Image resizing to ≤1024px, compress to ≤200KB |
| **Transient errors (5xx)** | Retry up to 3 times with backoff |
| **Invalid VLM output** | Zod validation → retry with stricter prompt |
| **Corrupt images** | Graceful skip, flag as `valid_image=false` |
| **Cost control** | Track tokens per call, log cumulative cost |

---

## Verification Plan

### Key Metrics Targets (on sample_claims.csv)
| Metric | Target |
|---|---|
| `claim_status` accuracy | ≥ 85% (17/20) |
| `issue_type` accuracy | ≥ 80% (16/20) |
| `object_part` accuracy | ≥ 80% (16/20) |
| `evidence_standard_met` accuracy | ≥ 90% (18/20) |
| `severity` accuracy | ≥ 75% (15/20) |
| Output schema validity | 100% |
| Row count match | 100% |

### Cost Estimate
- ~65 total claims (20 sample + 45 test)
- ~2 images avg per claim = ~130 image API calls
- GPT-4o: ~$3–6 total
- GPT-4o-mini: ~$0.50–1.50 total
