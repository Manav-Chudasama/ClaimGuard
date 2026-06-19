# Evaluation Report

**Generated**: 2026-06-19T18:21:29.149Z
**Claims evaluated**: 20 / 20
**Overall weighted score**: 84.1%

## Field-Level Accuracy

| Field | Accuracy | Correct | Total |
|---|---|---|---|
| ✅ claim_status | 95.0% | 19 | 20 |
| ⚠️ issue_type | 70.0% | 14 | 20 |
| ✅ object_part | 90.0% | 18 | 20 |
| ⚠️ severity | 80.0% | 16 | 20 |
| ⚠️ evidence_standard_met | 80.0% | 16 | 20 |
| ✅ valid_image | 90.0% | 18 | 20 |
| ⚠️ risk_flags | 75.0% | 15 | 20 |

## Claim Status Confusion Matrix

| Expected | Predicted | Count |
|---|---|---|
| contradicted | ✅ contradicted | 4 |
| contradicted | ❌ not_enough_information | 1 |
| not_enough_information | ✅ not_enough_information | 2 |
| supported | ✅ supported | 13 |

## Claim Status Mismatches

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | contradicted | not_enough_information |

## All Field Mismatches

### claim_status (95.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | contradicted | not_enough_information |

### issue_type (70.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | broken_part | unknown |
| user_009 | crack | glass_shatter |
| user_011 | stain | water_damage |
| user_018 | crack | glass_shatter |
| user_032 | unknown | missing_part |
| user_033 | unknown | none |

### object_part (90.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_006 | headlight | unknown |
| user_008 | front_bumper | hood |

### severity (80.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | high | unknown |
| user_009 | medium | high |
| user_018 | medium | high |
| user_033 | low | none |

### evidence_standard_met (80.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | true | false |
| user_032 | false | true |
| user_033 | true | false |
| user_034 | true | false |

### valid_image (90.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_032 | false | true |
| user_034 | true | false |

### risk_flags (75.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_003 | blurry_image | none |
| user_008 | claim_mismatch;non_original_image;user_history_ris | manual_review_required;non_original_image;user_his |
| user_032 | cropped_or_obstructed;damage_not_visible;manual_re | manual_review_required;user_history_risk |
| user_033 | wrong_object;claim_mismatch;user_history_risk;manu | claim_mismatch;damage_not_visible;manual_review_re |
| user_034 | damage_not_visible;text_instruction_present;user_h | damage_not_visible;manual_review_required;non_orig |
