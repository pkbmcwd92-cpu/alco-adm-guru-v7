import {
  AssessmentPackage,
  AssessmentRegenerationRequest,
  AssessmentRegenerationResult,
  AssessmentRegenerationContract,
  AssessmentRegenerationDraft,
  AssessmentRegenerationProvider,
  AssessmentRegenerationTarget,
} from '../types';
import { assessmentRegenerationDependencyService } from './assessmentRegenerationDependencyService';
import { assessmentRegenerationEligibilityService } from './assessmentRegenerationEligibilityService';

export class AssessmentRegenerationService {
  /**
   * Performs the transactional granular regeneration.
   * If any step fails or is blocked, the source package is completely unmodified.
   */
  public async regenerate(
    pkg: AssessmentPackage,
    request: AssessmentRegenerationRequest,
    provider: AssessmentRegenerationProvider,
    extra?: {
      gradeCalibration?: any;
      subjectProfile?: any;
      validationFindings?: any[];
    }
  ): Promise<AssessmentRegenerationResult> {
    const issues: string[] = [];

    // 1. Concurrency Guard / Revision Check
    const pkgRevision = pkg.revision ?? 1;
    if (request.expectedPackageRevision !== pkgRevision) {
      return {
        status: 'STALE_REGENERATION_REQUEST',
        issues: [`Request expected revision ${request.expectedPackageRevision} but package is at revision ${pkgRevision}.`],
      };
    }

    // 2. Locate Target and Verify Existence
    const targetLocator = this.locateTarget(pkg, request.target, request.targetId);
    if (!targetLocator.found) {
      return {
        status: 'FAILED',
        issues: [`Target '${request.target}' with ID '${request.targetId}' not found in the assessment package.`],
      };
    }

    const {
      coverageUnitId,
      objectiveRefId,
      criterionId,
      instrumentType,
      allocationUnit,
      cognitiveDemand,
      preservedContent,
      editableContent,
    } = targetLocator;

    // 3. Teacher Edit Protection
    const isTeacherEdited = this.checkTeacherEdited(request.target, targetLocator.targetElement);
    if (isTeacherEdited && request.explicitTeacherOverride !== true) {
      return {
        status: 'TEACHER_EDIT_PROTECTED',
        issues: [`Target field of '${request.target}' with ID '${request.targetId}' has been edited by a teacher. Explicit override required.`],
      };
    }

    // 4. Build Scoped Contract
    const contract: AssessmentRegenerationContract = {
      packageId: pkg.id,
      packageRevision: pkgRevision,
      target: request.target,
      targetId: request.targetId,
      immutableContext: {
        coverageUnitId,
        objectiveRefId,
        criterionId,
        instrumentType,
        allocationUnit,
        cognitiveDemand,
      },
      preservedContent,
      editableContent,
      gradeCalibration: extra?.gradeCalibration,
      subjectProfile: extra?.subjectProfile,
      validationFindings: extra?.validationFindings?.filter(
        (f) =>
          f.blueprintItemId === request.targetId ||
          f.instrumentItemId === request.targetId ||
          f.instrumentId === request.targetId ||
          f.coverageUnitId === request.targetId
      ),
    };

    // 5. Call Provider and Wrap in Try-Catch for Atomicity
    let providerOutput: any;
    try {
      providerOutput = await provider.regenerate(contract);
    } catch (e: any) {
      return {
        status: 'FAILED',
        issues: [`AI Provider threw an exception during regeneration: ${e.message || e}`],
      };
    }

    // 6. Runtime Validation of Untrusted Provider Output
    const validation = this.validateProviderOutput(request.target, request.targetId, providerOutput, contract);
    if (!validation.valid) {
      return {
        status: 'FAILED',
        issues: [`Validation of AI provider output failed: ${validation.reason}`],
      };
    }

    const draft = validation.draft!;

    // 7. Safe Allowlist Merge & Immutable Canonical Field Protection
    const clonedPkg: AssessmentPackage = JSON.parse(JSON.stringify(pkg));
    const applyResult = this.applyDraftChanges(clonedPkg, draft);
    if (!applyResult.success) {
      return {
        status: 'FAILED',
        issues: [`Applying draft changes failed: ${applyResult.reason}`],
      };
    }

    // 8. Dependency Invalidation Engine
    const invalidatedPkg = assessmentRegenerationDependencyService.invalidateDependencies(
      clonedPkg,
      request.target,
      request.targetId
    );

    // 9. Increment Revision & Enforce Workflow Draft / Needs Review State
    invalidatedPkg.revision = pkgRevision + 1;
    invalidatedPkg.workflowStatus = 'DRAFT';
    invalidatedPkg.needsReview = true;
    invalidatedPkg.updatedAt = new Date().toISOString();

    // Preserve metadata about this regeneration in a lightweight audit trail
    if (request.validationFindingIds && request.validationFindingIds.length > 0) {
      (invalidatedPkg as any).regenerationProvenance = {
        target: request.target,
        targetId: request.targetId,
        fromRevision: pkgRevision,
        toRevision: invalidatedPkg.revision,
        validationFindingIds: request.validationFindingIds,
        createdAt: invalidatedPkg.updatedAt,
      };
    }

    return {
      status: 'REGENERATED',
      regeneratedPackage: invalidatedPkg,
      draft,
    };
  }

  /**
   * Helper to inspect provenance of a target element to see if it was modified by a teacher.
   */
  private checkTeacherEdited(target: AssessmentRegenerationTarget, element: any): boolean {
    if (!element) return false;

    // Check direct provenance
    if (element.provenance === 'TEACHER_EDITED') return true;

    // Check nested provenance
    if (element.provenance?.fields) {
      if (target === 'ITEM_PROMPT' && element.provenance.fields.prompt === 'TEACHER_EDITED') return true;
      if (target === 'OPTIONS' && element.provenance.fields.options === 'TEACHER_EDITED') return true;
      if (target === 'STIMULUS' && element.provenance.fields.stimulus === 'TEACHER_EDITED') return true;
      if (target === 'RUBRIC' && element.provenance.fields.criteria === 'TEACHER_EDITED') return true;
      if (target === 'INDICATOR' && element.provenance.fields.assessmentIndicator === 'TEACHER_EDITED') return true;
      if (target === 'MATERIAL_CONTEXT' && element.provenance.fields.materialOrContext === 'TEACHER_EDITED') return true;
    }

    if (element.provenance) {
      if (target === 'ITEM_PROMPT' && element.provenance.prompt === 'TEACHER_EDITED') return true;
      if (target === 'OPTIONS' && element.provenance.options === 'TEACHER_EDITED') return true;
      if (target === 'STIMULUS' && element.provenance.stimulus === 'TEACHER_EDITED') return true;
      if (target === 'RUBRIC' && element.provenance.criteria === 'TEACHER_EDITED') return true;
      if (target === 'INDICATOR' && element.provenance.assessmentIndicator === 'TEACHER_EDITED') return true;
      if (target === 'MATERIAL_CONTEXT' && element.provenance.materialOrContext === 'TEACHER_EDITED') return true;
    }

    return false;
  }

  /**
   * Locates the target element and its context in the package.
   */
  private locateTarget(
    pkg: AssessmentPackage,
    target: AssessmentRegenerationTarget,
    targetId: string
  ): {
    found: boolean;
    targetElement?: any;
    coverageUnitId?: string;
    objectiveRefId?: string;
    criterionId?: string;
    instrumentType?: string;
    allocationUnit?: string;
    cognitiveDemand?: string;
    preservedContent?: any;
    editableContent?: any;
  } {
    switch (target) {
      case 'INDICATOR':
      case 'MATERIAL_CONTEXT': {
        const bp = (pkg.blueprintItems || []).find((b) => b.id === targetId);
        if (!bp) return { found: false };
        return {
          found: true,
          targetElement: bp,
          coverageUnitId: bp.coverageUnitId,
          objectiveRefId: bp.objectiveRefId,
          criterionId: bp.criterionId,
          instrumentType: bp.instrumentType,
          cognitiveDemand: bp.cognitiveDemand,
          preservedContent: { id: bp.id, coverageUnitId: bp.coverageUnitId, objectiveRefId: bp.objectiveRefId },
          editableContent: target === 'INDICATOR' ? bp.assessmentIndicator : bp.materialOrContext,
        };
      }

      case 'ITEM_PROMPT':
      case 'STIMULUS':
      case 'OPTIONS': {
        // Search instruments
        for (const inst of pkg.instruments || []) {
          if ('items' in inst && Array.isArray(inst.items)) {
            const item: any = inst.items.find((i: any) => i.id === targetId);
            if (item) {
              const bp = (pkg.blueprintItems || []).find(
                (b) => b.instrumentItemIds && b.instrumentItemIds.includes(targetId)
              );
              return {
                found: true,
                targetElement: item,
                coverageUnitId: item.coverageUnitId || bp?.coverageUnitId,
                objectiveRefId: bp?.objectiveRefId,
                criterionId: bp?.criterionId,
                instrumentType: inst.type,
                allocationUnit: 'ITEM',
                preservedContent: { id: item.id, itemType: item.itemType },
                editableContent:
                  target === 'ITEM_PROMPT'
                    ? item.prompt
                    : target === 'STIMULUS'
                    ? item.stimulus
                    : item.options,
              };
            }
          }
        }
        return { found: false };
      }

      case 'PROPOSED_ANSWER': {
        const ak = (pkg.answerKeys || []).find((a) => a.id === targetId || a.instrumentItemId === targetId);
        if (!ak) return { found: false };
        const inst = pkg.instruments.find((i) => i.id === ak.instrumentId);
        return {
          found: true,
          targetElement: ak,
          instrumentType: inst?.type,
          preservedContent: { id: ak.id, instrumentId: ak.instrumentId, instrumentItemId: ak.instrumentItemId, answerType: ak.answerType },
          editableContent: { value: ak.value, optionIds: ak.optionIds, matchingPairs: ak.matchingPairs, categoryAnswers: ak.categoryAnswers },
        };
      }

      case 'SCORING_GUIDE': {
        const sg = (pkg.scoringGuides || []).find((s) => s.id === targetId || s.instrumentItemId === targetId);
        if (!sg) return { found: false };
        return {
          found: true,
          targetElement: sg,
          preservedContent: { id: sg.id, instrumentId: sg.instrumentId, instrumentItemId: sg.instrumentItemId },
          editableContent: { title: sg.title, guideType: sg.guideType, instructions: sg.instructions, maxScore: sg.maxScore },
        };
      }

      case 'RUBRIC': {
        const rb = (pkg.rubrics || []).find((r) => r.id === targetId || r.instrumentItemId === targetId);
        if (!rb) return { found: false };
        return {
          found: true,
          targetElement: rb,
          preservedContent: { id: rb.id, instrumentId: rb.instrumentId, instrumentItemId: rb.instrumentItemId },
          editableContent: { title: rb.title, criteria: rb.criteria, scale: rb.scale },
        };
      }

      case 'TASK': {
        const inst = (pkg.instruments || []).find(
          (i) => i.id === targetId && ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT'].includes(i.type)
        );
        if (!inst) return { found: false };
        return {
          found: true,
          targetElement: inst,
          instrumentType: inst.type,
          allocationUnit: 'TASK',
          preservedContent: { id: inst.id, type: inst.type },
          editableContent: inst,
        };
      }

      case 'EVIDENCE_REQUIREMENT': {
        const inst = (pkg.instruments || []).find((i) => i.id === targetId && i.type === 'PORTFOLIO');
        if (!inst) return { found: false };
        return {
          found: true,
          targetElement: inst,
          instrumentType: 'PORTFOLIO',
          allocationUnit: 'EVIDENCE',
          preservedContent: { id: inst.id, type: 'PORTFOLIO' },
          editableContent: (inst as any).evidenceRequirements,
        };
      }

      case 'OBSERVATION_CONTENT': {
        const inst = (pkg.instruments || []).find((i) => i.id === targetId && i.type === 'OBSERVATION');
        if (!inst) return { found: false };
        return {
          found: true,
          targetElement: inst,
          instrumentType: 'OBSERVATION',
          allocationUnit: 'OBSERVATION',
          preservedContent: { id: inst.id, type: 'OBSERVATION' },
          editableContent: inst,
        };
      }

      case 'COVERAGE_UNIT': {
        // COVERAGE_UNIT maps to one existing coverageUnitId
        const bp = (pkg.blueprintItems || []).find((b) => b.coverageUnitId === targetId);
        if (!bp) return { found: false };
        return {
          found: true,
          targetElement: bp,
          coverageUnitId: bp.coverageUnitId,
          objectiveRefId: bp.objectiveRefId,
          criterionId: bp.criterionId,
          instrumentType: bp.instrumentType,
          preservedContent: { coverageUnitId: bp.coverageUnitId, objectiveRefId: bp.objectiveRefId, criterionId: bp.criterionId },
          editableContent: bp,
        };
      }

      default:
        return { found: false };
    }
  }

  /**
   * Validates untrusted AI provider output.
   */
  private validateProviderOutput(
    target: AssessmentRegenerationTarget,
    targetId: string,
    output: any,
    contract: AssessmentRegenerationContract
  ): { valid: boolean; reason?: string; draft?: AssessmentRegenerationDraft } {
    if (!output || typeof output !== 'object') {
      return { valid: false, reason: 'AI Output must be a non-null object' };
    }

    // Whole package replacement is strictly rejected
    if (output.package || output.assessmentPackage || ('blueprintItems' in output && 'instruments' in output)) {
      return { valid: false, reason: 'AI proposed a whole-package replacement, which is forbidden' };
    }

    if (output.target !== target) {
      return { valid: false, reason: `AI returned target '${output.target}' instead of requested target '${target}'` };
    }

    if (output.targetId !== targetId) {
      return { valid: false, reason: `AI returned targetId '${output.targetId}' instead of requested targetId '${targetId}'` };
    }

    const proposed = output.proposedChanges;
    if (!proposed || typeof proposed !== 'object') {
      return { valid: false, reason: 'AI output must specify a valid proposedChanges object' };
    }

    // Protect immutable canonical fields inside proposed changes
    const canonicalFields = ['coverageUnitId', 'objectiveRefId', 'criterionId', 'instrumentType', 'allocationUnit'];
    for (const f of canonicalFields) {
      if (f in proposed && proposed[f] !== contract.immutableContext[f as keyof typeof contract.immutableContext]) {
        return { valid: false, reason: `AI output attempted to modify forbidden canonical field: ${f}` };
      }
    }

    // Target-specific runtime validations
    switch (target) {
      case 'INDICATOR': {
        if (typeof proposed.assessmentIndicator !== 'string' || proposed.assessmentIndicator.trim() === '') {
          return { valid: false, reason: "INDICATOR target requires non-empty string 'assessmentIndicator'" };
        }
        break;
      }

      case 'MATERIAL_CONTEXT': {
        if (typeof proposed.materialOrContext !== 'string' || proposed.materialOrContext.trim() === '') {
          return { valid: false, reason: "MATERIAL_CONTEXT target requires non-empty string 'materialOrContext'" };
        }
        break;
      }

      case 'ITEM_PROMPT': {
        if (typeof proposed.prompt !== 'string' || proposed.prompt.trim() === '') {
          return { valid: false, reason: "ITEM_PROMPT target requires non-empty string 'prompt'" };
        }
        break;
      }

      case 'STIMULUS': {
        if (typeof proposed.stimulus !== 'string') {
          return { valid: false, reason: "STIMULUS target requires string 'stimulus'" };
        }
        break;
      }

      case 'OPTIONS': {
        if (!Array.isArray(proposed.options) || proposed.options.length < 2) {
          return { valid: false, reason: 'OPTIONS target requires options array with at least 2 choices' };
        }
        for (const opt of proposed.options) {
          if (!opt.id || typeof opt.text !== 'string' || opt.text.trim() === '') {
            return { valid: false, reason: 'Each option in OPTIONS must contain a valid id and non-empty string text' };
          }
        }
        break;
      }

      case 'RUBRIC': {
        if (!Array.isArray(proposed.criteria) || !Array.isArray(proposed.scale)) {
          return { valid: false, reason: 'RUBRIC target requires both criteria and scale arrays' };
        }
        break;
      }

      case 'EVIDENCE_REQUIREMENT': {
        if (!Array.isArray(proposed.evidenceRequirements)) {
          return { valid: false, reason: 'EVIDENCE_REQUIREMENT target requires an evidenceRequirements array' };
        }
        break;
      }

      case 'OBSERVATION_CONTENT': {
        if (!Array.isArray(proposed.aspects)) {
          return { valid: false, reason: 'OBSERVATION_CONTENT target requires aspects array' };
        }
        break;
      }

      default:
        break;
    }

    return {
      valid: true,
      draft: {
        target,
        targetId,
        proposedChanges: proposed,
      },
    };
  }

  /**
   * Applies the validated draft changes to the cloned package.
   */
  private applyDraftChanges(pkg: AssessmentPackage, draft: AssessmentRegenerationDraft): { success: boolean; reason?: string } {
    const proposed = draft.proposedChanges;

    switch (draft.target) {
      case 'INDICATOR': {
        const bp: any = (pkg.blueprintItems || []).find((b) => b.id === draft.targetId);
        if (bp) {
          bp.assessmentIndicator = proposed.assessmentIndicator;
          bp.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'MATERIAL_CONTEXT': {
        const bp: any = (pkg.blueprintItems || []).find((b) => b.id === draft.targetId);
        if (bp) {
          bp.materialOrContext = proposed.materialOrContext;
          bp.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'ITEM_PROMPT':
      case 'STIMULUS':
      case 'OPTIONS': {
        for (const inst of pkg.instruments || []) {
          if ('items' in inst && Array.isArray(inst.items)) {
            const item: any = inst.items.find((i: any) => i.id === draft.targetId);
            if (item) {
              if (draft.target === 'ITEM_PROMPT') {
                item.prompt = proposed.prompt;
              } else if (draft.target === 'STIMULUS') {
                item.stimulus = proposed.stimulus;
                if (proposed.stimulusOrigin) item.stimulusOrigin = proposed.stimulusOrigin;
                if (proposed.stimulusSource) item.stimulusSource = proposed.stimulusSource;
              } else if (draft.target === 'OPTIONS') {
                item.options = proposed.options;
              }

              // Update item provenance field-level metadata
              item.provenance = item.provenance || {};
              if (typeof item.provenance === 'string') {
                item.provenance = { originalOwner: item.provenance };
              }
              item.provenance.fields = item.provenance.fields || {};

              if (draft.target === 'ITEM_PROMPT') {
                item.provenance.fields.prompt = 'AI_REGENERATED';
              } else if (draft.target === 'STIMULUS') {
                item.provenance.fields.stimulus = 'AI_REGENERATED';
              } else if (draft.target === 'OPTIONS') {
                item.provenance.fields.options = 'AI_REGENERATED';
              }
              return { success: true };
            }
          }
        }
        break;
      }

      case 'PROPOSED_ANSWER': {
        const ak: any = (pkg.answerKeys || []).find((a) => a.id === draft.targetId || a.instrumentItemId === draft.targetId);
        if (ak) {
          if ('value' in proposed) ak.value = proposed.value;
          if ('optionIds' in proposed) ak.optionIds = proposed.optionIds;
          if ('matchingPairs' in proposed) ak.matchingPairs = proposed.matchingPairs;
          if ('categoryAnswers' in proposed) ak.categoryAnswers = proposed.categoryAnswers;
          ak.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'SCORING_GUIDE': {
        const sg: any = (pkg.scoringGuides || []).find((s) => s.id === draft.targetId || s.instrumentItemId === draft.targetId);
        if (sg) {
          if ('title' in proposed) sg.title = proposed.title;
          if ('guideType' in proposed) sg.guideType = proposed.guideType;
          if ('instructions' in proposed) sg.instructions = proposed.instructions;
          if ('maxScore' in proposed) sg.maxScore = proposed.maxScore;
          sg.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'RUBRIC': {
        const rb: any = (pkg.rubrics || []).find((r) => r.id === draft.targetId || r.instrumentItemId === draft.targetId);
        if (rb) {
          rb.title = proposed.title || rb.title;
          rb.criteria = proposed.criteria;
          rb.scale = proposed.scale;
          rb.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'TASK': {
        const inst = (pkg.instruments || []).find((i) => i.id === draft.targetId);
        if (inst) {
          if (inst.type === 'PERFORMANCE') {
            inst.task = proposed.task || inst.task;
            inst.instructions = proposed.instructions || inst.instructions;
          } else if (inst.type === 'ASSIGNMENT') {
            inst.instructions = proposed.instructions || inst.instructions;
            inst.expectedOutput = proposed.expectedOutput || inst.expectedOutput;
          } else if (inst.type === 'PROJECT') {
            inst.projectBrief = proposed.projectBrief || inst.projectBrief;
            inst.expectedDeliverable = proposed.expectedDeliverable || inst.expectedDeliverable;
          } else if (inst.type === 'PRODUCT') {
            inst.productBrief = proposed.productBrief || inst.productBrief;
            inst.expectedProduct = proposed.expectedProduct || inst.expectedProduct;
          }
          (inst as any).provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'EVIDENCE_REQUIREMENT': {
        const inst = (pkg.instruments || []).find((i) => i.id === draft.targetId && i.type === 'PORTFOLIO');
        if (inst) {
          (inst as any).evidenceRequirements = proposed.evidenceRequirements;
          (inst as any).provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'OBSERVATION_CONTENT': {
        const inst = (pkg.instruments || []).find((i) => i.id === draft.targetId && i.type === 'OBSERVATION');
        if (inst) {
          (inst as any).aspects = proposed.aspects;
          if ('recordingScheme' in proposed) (inst as any).recordingScheme = proposed.recordingScheme;
          (inst as any).provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      case 'COVERAGE_UNIT': {
        const bp: any = (pkg.blueprintItems || []).find((b) => b.coverageUnitId === draft.targetId);
        if (bp) {
          if ('assessmentIndicator' in proposed) bp.assessmentIndicator = proposed.assessmentIndicator;
          if ('materialOrContext' in proposed) bp.materialOrContext = proposed.materialOrContext;
          bp.provenance = 'AI_REGENERATED';
          return { success: true };
        }
        break;
      }

      default:
        break;
    }

    return { success: false, reason: `Failed to apply changes for target ${draft.target}` };
  }
}

export const assessmentRegenerationService = new AssessmentRegenerationService();
