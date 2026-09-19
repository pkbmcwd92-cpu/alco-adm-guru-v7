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

    if (code.includes('RUBRIC') || code.toLowerCase().includes('rubric') || (finding.instrumentId && code.toLowerCase().includes('rubric'))) {
      return 'RUBRIC';
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

  /**
   * Resolves exact action, target, and exact targetId for a finding.
   * Fails closed if exact identity is missing, ambiguous, or structural.
   */
  public resolveActionForFinding(finding: AssessmentValidationFinding): {
    eligible: boolean;
    target?: AssessmentRegenerationTarget;
    targetId?: string;
    label?: string;
    reason?: string;
  } {
    if (this.isStructuralFinding(finding)) {
      return { eligible: false, reason: 'STRUCTURAL_FINDING' };
    }

    const target = this.resolveTargetForFinding(finding);
    if (!target) {
      return { eligible: false, reason: 'INELIGIBLE_OR_AMBIGUOUS' };
    }

    let targetId: string | undefined;

    switch (target) {
      case 'INDICATOR':
      case 'MATERIAL_CONTEXT':
        targetId = finding.blueprintItemId;
        break;
      case 'ITEM_PROMPT':
      case 'OPTIONS':
      case 'STIMULUS':
        targetId = finding.instrumentItemId;
        break;
      case 'PROPOSED_ANSWER':
        targetId = finding.instrumentItemId || finding.id;
        break;
      case 'RUBRIC':
        targetId = finding.instrumentItemId || finding.id;
        break;
      case 'TASK':
      case 'EVIDENCE_REQUIREMENT':
      case 'OBSERVATION_CONTENT':
        targetId = finding.instrumentId;
        break;
      case 'SCORING_GUIDE':
        targetId = finding.instrumentItemId || finding.id;
        break;
      default:
        targetId = finding.instrumentItemId;
        break;
    }

    if (!targetId || targetId.trim() === '') {
      return { eligible: false, reason: 'MISSING_EXACT_IDENTITY' };
    }

    const labelMap: Record<AssessmentRegenerationTarget, string> = {
      OPTIONS: 'Buat Ulang Pilihan Jawaban',
      ITEM_PROMPT: 'Buat Ulang Pertanyaan',
      STIMULUS: 'Buat Ulang Stimulus',
      RUBRIC: 'Buat Ulang Rubrik',
      TASK: 'Buat Ulang Tugas',
      EVIDENCE_REQUIREMENT: 'Buat Ulang Bukti yang Dikumpulkan',
      OBSERVATION_CONTENT: 'Buat Ulang Aspek Pengamatan',
      INDICATOR: 'Buat Ulang Indikator',
      MATERIAL_CONTEXT: 'Buat Ulang Materi/Konteks',
      PROPOSED_ANSWER: 'Buat Ulang Jawaban',
      SCORING_GUIDE: 'Buat Ulang Pedoman Penskoran',
      COVERAGE_UNIT: 'Buat Ulang Unit Cakupan',
    };

    return {
      eligible: true,
      target,
      targetId,
      label: labelMap[target] || `Buat Ulang (${target})`,
    };
  }
}

export const assessmentRegenerationEligibilityService = new AssessmentRegenerationEligibilityService();
