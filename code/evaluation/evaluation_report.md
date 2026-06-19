# Evaluation Report

**Generated**: 2026-06-19T16:37:19.038Z
**Claims evaluated**: 20 / 20
**Overall weighted score**: 78.9%

## Field-Level Accuracy

| Field | Accuracy | Correct | Total |
|---|---|---|---|
| ✅ claim_status | 85.0% | 17 | 20 |
| ❌ issue_type | 65.0% | 13 | 20 |
| ✅ object_part | 90.0% | 18 | 20 |
| ❌ severity | 65.0% | 13 | 20 |
| ✅ evidence_standard_met | 85.0% | 17 | 20 |
| ✅ valid_image | 95.0% | 19 | 20 |
| ⚠️ risk_flags | 70.0% | 14 | 20 |

## Claim Status Confusion Matrix

| Expected | Predicted | Count |
|---|---|---|
| contradicted | ❌ supported | 3 |
| contradicted | ✅ contradicted | 2 |
| not_enough_information | ✅ not_enough_information | 2 |
| supported | ✅ supported | 13 |

## Claim Status Mismatches

| User ID | Expected | Predicted |
|---|---|---|
| user_005 | contradicted | supported |
| user_020 | contradicted | supported |
| user_034 | contradicted | supported |

## All Field Mismatches

### claim_status (85.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_005 | contradicted | supported |
| user_020 | contradicted | supported |
| user_034 | contradicted | supported |

### issue_type (65.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_005 | scratch | dent |
| user_008 | broken_part | unknown |
| user_011 | stain | water_damage |
| user_018 | crack | glass_shatter |
| user_020 | none | scratch |
| user_032 | unknown | missing_part |
| user_034 | none | torn_packaging |

### object_part (90.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_006 | headlight | unknown |
| user_008 | front_bumper | hood |

### severity (65.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_005 | low | medium |
| user_008 | high | unknown |
| user_009 | medium | high |
| user_018 | medium | high |
| user_020 | none | low |
| user_033 | low | unknown |
| user_034 | none | medium |

### evidence_standard_met (85.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | true | false |
| user_032 | false | true |
| user_033 | true | false |

### valid_image (95.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_032 | false | true |

### risk_flags (70.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_005 | claim_mismatch;user_history_risk;manual_review_req | manual_review_required;user_history_risk |
| user_008 | claim_mismatch;non_original_image;user_history_ris | manual_review_required;non_original_image;user_his |
| user_020 | damage_not_visible;user_history_risk;manual_review | manual_review_required;user_history_risk |
| user_032 | cropped_or_obstructed;damage_not_visible;manual_re | manual_review_required;user_history_risk |
| user_033 | wrong_object;claim_mismatch;user_history_risk;manu | manual_review_required;user_history_risk;wrong_obj |
| user_034 | damage_not_visible;text_instruction_present;user_h | manual_review_required;non_original_image;text_ins |
