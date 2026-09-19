import {
  AssessmentRegenerationTarget,
  AssessmentValidationFinding,
} from '../types';

export class AssessmentRegenerationEligibilityService {
  /**
   * Deterministically maps a validation finding to an AssessmentRegenerationTarget if safe.
   * Returns null if ambiguous or ineligible.
   */
  public resolveTargetForFinding(
    finding: AssessmentValidationFinding
  ): AssessmentRegenerationTarget | null {
    const code = finding.code || '';
    const dimension = finding.dimension;

    // Structural findings are strictly ineligible for AI regeneration
    if (this.isStructuralFinding(finding)) {
      return null;
    }

    if (dimension === 'DISTRACTOR_QUALITY') {
      return 'OPTIONS';
    }

    if (dimension === 'STIMULUS_QUALITY') {
      return 'STIMULUS';
    }

    if (dimension === 'ITEM_CONSTRUCTION') {
      return 'ITEM_PROMPT';
    }

    if (dimension === 'GRADE_LANGUAGE') {
      const targetField = (finding as any).targetField || (finding as any).metadata?.targetField;
      if (targetField === 'ITEM_PROMPT') {
        return 'ITEM_PROMPT';
      }
      if (targetField === 'STIMULUS') {
        return 'STIMULUS';
      }
      return null;
    }

    if (code.includes('RUBRIC') || (finding.instrumentId && code.toLowerCase().includes('rubric'))) {
      return 'RUBRIC';
    }

    // Ambiguous findings such as ANSWER_VERIFICATION = REJECTED must NOT guess the target
    if (dimension === 'ANSWER_VERIFICATION' || code.includes('ANSWER_VERIFICATION')) {
      return null;
    }

    return null;
  }

  /**
   * Checks if a validation finding is a structural constraint that must block regeneration.
   */
  public isStructuralFinding(finding: AssessmentValidationFinding): boolean {
    const blockedCodes = [
      'DANGLING_BLUEPRINT_INSTRUMENT',
      'MISSING_INSTRUMENT_LINKAGE',
      'AMBIGUOUS_INSTRUMENT_LINKAGE',
      'COVERAGE_UNIT_MISMATCH',
      'OBJECTIVE_REF_MISMATCH',
      'CRITERION_REF_MISMATCH',
      'INSTRUMENT_TYPE_MISMATCH',
      'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH',
      'BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH',
      'DANGLING_ANSWER_KEY_INSTRUMENT',
      'DANGLING_ANSWER_KEY_ITEM',
    ];

    const code = finding.code || '';
    return blockedCodes.includes(code) || code.includes('MISMATCH') || code.includes('DANGLING');
  }

  /**
   * Verifies if the finding can be addressed via AI regeneration.
   */
  public isEligible(finding: AssessmentValidationFinding): boolean {
    if (this.isStructuralFinding(finding)) {
      return false;
    }
    return this.resolveTargetForFinding(finding) !== null;
  }
}

export const assessmentRegenerationEligibilityService = new AssessmentRegenerationEligibilityService();
