# Evaluation Report

**Generated**: 2026-06-19T16:01:33.770Z
**Claims evaluated**: 20 / 20
**Overall weighted score**: 68.2%

## Field-Level Accuracy

| Field | Accuracy | Correct | Total |
|---|---|---|---|
| ⚠️ claim_status | 75.0% | 15 | 20 |
| ❌ issue_type | 50.0% | 10 | 20 |
| ✅ object_part | 90.0% | 18 | 20 |
| ❌ severity | 50.0% | 10 | 20 |
| ⚠️ evidence_standard_met | 70.0% | 14 | 20 |
| ⚠️ valid_image | 80.0% | 16 | 20 |
| ❌ risk_flags | 65.0% | 13 | 20 |

## Claim Status Confusion Matrix

| Expected | Predicted | Count |
|---|---|---|
| contradicted | ✅ contradicted | 2 |
| contradicted | ❌ not_enough_information | 2 |
| contradicted | ❌ supported | 1 |
| not_enough_information | ✅ not_enough_information | 2 |
| supported | ✅ supported | 11 |
| supported | ❌ not_enough_information | 2 |

## Claim Status Mismatches

| User ID | Expected | Predicted |
|---|---|---|
| user_002 | supported | not_enough_information |
| user_008 | contradicted | not_enough_information |
| user_020 | contradicted | supported |
| user_031 | supported | not_enough_information |
| user_034 | contradicted | not_enough_information |

## All Field Mismatches

### claim_status (75.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_002 | supported | not_enough_information |
| user_008 | contradicted | not_enough_information |
| user_020 | contradicted | supported |
| user_031 | supported | not_enough_information |
| user_034 | contradicted | not_enough_information |

### issue_type (50.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_002 | scratch | unknown |
| user_007 | broken_part | crack |
| user_005 | scratch | none |
| user_008 | broken_part | unknown |
| user_018 | crack | glass_shatter |
| user_020 | none | scratch |
| user_031 | water_damage | stain |
| user_032 | unknown | missing_part |
| user_033 | unknown | none |
| user_034 | none | torn_packaging |

### object_part (90.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_006 | headlight | unknown |
| user_008 | front_bumper | unknown |

### severity (50.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_001 | medium | high |
| user_002 | low | unknown |
| user_005 | low | none |
| user_008 | high | unknown |
| user_009 | medium | high |
| user_011 | medium | low |
| user_018 | medium | high |
| user_020 | none | low |
| user_033 | low | none |
| user_034 | none | unknown |

### evidence_standard_met (70.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_002 | true | false |
| user_005 | true | false |
| user_008 | true | false |
| user_031 | true | false |
| user_033 | true | false |
| user_034 | true | false |

### valid_image (80.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_008 | false | true |
| user_032 | false | true |
| user_033 | true | false |
| user_034 | true | false |

### risk_flags (65.0%)

| User ID | Expected | Predicted |
|---|---|---|
| user_002 | none | manual_review_required;wrong_object_part |
| user_005 | claim_mismatch;user_history_risk;manual_review_req | damage_not_visible;manual_review_required;user_his |
| user_008 | claim_mismatch;non_original_image;user_history_ris | manual_review_required;user_history_risk;wrong_obj |
| user_020 | damage_not_visible;user_history_risk;manual_review | manual_review_required;user_history_risk |
| user_032 | cropped_or_obstructed;damage_not_visible;manual_re | manual_review_required;user_history_risk |
| user_033 | wrong_object;claim_mismatch;user_history_risk;manu | manual_review_required;user_history_risk;wrong_obj |
| user_034 | damage_not_visible;text_instruction_present;user_h | manual_review_required;text_instruction_present;us |
