import {
  AssessmentDifficultyTarget,
  AssessmentEvidenceType,
  AssessmentInstrumentType,
  AssessmentStimulusType,
  CognitiveDemand,
} from './index';

// ==========================================
// AUDIT 9C.2: GENERATION RULE PROVENANCE
// ==========================================

export type AssessmentGenerationRuleSource =
  | 'OFFICIAL'
  | 'OFFICIAL_REFERENCE'
  | 'OFFICIAL_ASSESSMENT_REFERENCE'
  | 'PEDAGOGICAL_RULE'
  | 'APP_DEFAULT'
  | 'AI_RECOMMENDATION';

export interface AssessmentGenerationRule {
  id: string;
  sourceType: AssessmentGenerationRuleSource;
  description: string;

  sourceRef?: string;
  sourceTitle?: string;
  sourceAgency?: string;
  sourceVersion?: string;
}

// ==========================================
// AUDIT 9C.2: ASSESSMENT GENERATION PROFILE & CALIBRATION
// ==========================================

export interface AssessmentReferenceProgression {
  framework: 'AKM';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  sourceType: 'OFFICIAL_REFERENCE';
}

export type AssessmentReadingLoad =
  | 'VERY_LOW'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH';

export type AssessmentInstructionLoad =
  | 'SINGLE_STEP_PREFERRED'
  | 'LIMITED_MULTI_STEP'
  | 'MULTI_STEP_ALLOWED';

export type AssessmentAbstractionLevel =
  | 'CONCRETE'
  | 'CONCRETE_TO_ABSTRACT'
  | 'ABSTRACT_ALLOWED';

export type AssessmentVisualSupport =
  | 'STRONGLY_CONSIDER'
  | 'CONSIDER'
  | 'AS_NEEDED';

export interface AssessmentGradeCalibrationProfile {
  grade: number;
  readingLoad: AssessmentReadingLoad;
  instructionLoad: AssessmentInstructionLoad;
  abstractionLevel: AssessmentAbstractionLevel;
  visualSupport: AssessmentVisualSupport;
  rules: AssessmentGenerationRule[];
}

export interface AssessmentGenerationProfile {
  grade: number;
  phase?: string;
  referenceProgression?: AssessmentReferenceProgression;
  gradeCalibration: AssessmentGradeCalibrationProfile;
  provenance: AssessmentGenerationRule[];
}

// ==========================================
// AUDIT 9C.2: SUBJECT ASSESSMENT PROFILE
// ==========================================

export interface SubjectCompetencyDomain {
  id: string;
  name: string;
  description?: string;
}

export interface AssessmentEvidenceRecommendationRule {
  id: string;
  ruleDescription: string;
  triggerKeywords?: string[];
  recommendedEvidenceTypes: AssessmentEvidenceType[];
  recommendedInstrumentTypes: AssessmentInstrumentType[];
  rationaleCode: string;
  provenance: AssessmentGenerationRule;
}

export type SubjectAssessmentProfileStatus =
  | 'SPECIFIC'
  | 'GENERIC'
  | 'UNRESOLVED';

export interface SubjectAssessmentProfile {
  subjectKey: string;
  subjectLabel?: string;
  competencyDomains: SubjectCompetencyDomain[];
  supportedEvidenceTypes: AssessmentEvidenceType[];
  supportedInstrumentTypes: AssessmentInstrumentType[];
  recommendationRules: AssessmentEvidenceRecommendationRule[];
  provenance: AssessmentGenerationRule[];
  profileStatus: SubjectAssessmentProfileStatus;
}

// ==========================================
// AUDIT 9C.2: EVIDENCE RECOMMENDATION
// ==========================================

export type AssessmentEvidenceConfidence =
  | 'DETERMINISTIC'
  | 'RULE_BASED'
  | 'NEEDS_TEACHER_REVIEW';

export interface AssessmentEvidenceRecommendation {
  objectiveRefId: string;
  criterionId?: string;
  evidenceTypes: AssessmentEvidenceType[];
  recommendedInstrumentTypes: AssessmentInstrumentType[];
  rationaleCode: string;
  provenance: AssessmentGenerationRule[];
  confidence: AssessmentEvidenceConfidence;
}

// ==========================================
// AUDIT 9C.2: GENERATION SPEC & RESOLUTION
// ==========================================

export type AssessmentGenerationResolutionStatus =
  | 'RESOLVED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export type AssessmentGenerationIssueSeverity = 'REVIEW' | 'BLOCKING';

export interface AssessmentGenerationIssue {
  code: string;
  severity: AssessmentGenerationIssueSeverity;
  message: string;
  objectiveRefId?: string;
  criterionId?: string;
}

export interface ResolvedAssessmentObjective {
  id: string;
  sourceType: 'TP' | 'KD';
  text: string;
  criterionIds: string[];
}

export interface ResolvedAssessmentCriterion {
  id: string;
  objectiveRefId: string;
  name: string;
  description?: string;
}

export interface ResolvedAssessmentCurriculumContext {
  curriculumType?: 'KURIKULUM_MERDEKA' | 'K13';
  rawCurriculumName?: string;
  grade?: number;
  schoolLevel?: 'SD' | 'SMP' | 'SMA';
  phase?: string;
}

export interface AssessmentSourceContext {
  id: string;
  sourceType:
    | 'CANONICAL_CURRICULUM'
    | 'OFFICIAL_GUIDANCE'
    | 'TEACHER_SOURCE';
  title?: string;
  sourceRef?: string;
  revision?: string;
}

export interface AssessmentGenerationSpec {
  assessmentPlanId: string;
  assessmentPackageId: string;

  curriculumContext: ResolvedAssessmentCurriculumContext;
  objectives: ResolvedAssessmentObjective[];
  criteria: ResolvedAssessmentCriterion[];
  generationProfile?: AssessmentGenerationProfile;
  subjectProfile: SubjectAssessmentProfile;
  evidenceRecommendations: AssessmentEvidenceRecommendation[];
  plannedInstrumentTypes: AssessmentInstrumentType[];
  sourceContext: AssessmentSourceContext[];

  resolution: {
    status: AssessmentGenerationResolutionStatus;
    issues: AssessmentGenerationIssue[];
  };
}

// ==========================================
// AUDIT 9C.3: COVERAGE & ASSEMBLY PLAN
// ==========================================

export type AssessmentAssemblyMode =
  | 'AUTO_RECOMMENDED'
  | 'TEACHER_DEFINED';

export type AssessmentAllocationUnit =
  | 'ITEM'
  | 'TASK'
  | 'EVIDENCE'
  | 'OBSERVATION';

export interface AssessmentGenerationConstraints {
  assemblyMode: AssessmentAssemblyMode;
  durationMinutes?: number;
  requestedTotalItems?: number;
}

export interface AssessmentCoverageUnit {
  id: string;

  objectiveRefId: string;
  criterionId?: string;

  evidenceType?: AssessmentEvidenceType;
  instrumentType?: AssessmentInstrumentType;

  allocationUnit: AssessmentAllocationUnit;
  recommendedCount?: number;

  cognitiveDemand?: CognitiveDemand;
  stimulusType?: AssessmentStimulusType;
  difficultyTarget?: AssessmentDifficultyTarget;

  assessmentIndicator?: string;
  materialOrContext?: string;

  provenance: AssessmentGenerationRule[];

  status:
    | 'RESOLVED'
    | 'NEEDS_REVIEW'
    | 'BLOCKED';

  issues: AssessmentGenerationIssue[];
}

export interface AssessmentGenerationPlan {
  generationSpec: AssessmentGenerationSpec;

  constraints: AssessmentGenerationConstraints;

  coverageUnits: AssessmentCoverageUnit[];

  summary: {
    objectiveCount: number;
    criterionCount: number;
    coverageUnitCount: number;
    allocatedCount?: number;
  };

  resolution: {
    status:
      | 'RESOLVED'
      | 'NEEDS_REVIEW'
      | 'BLOCKED';

    issues: AssessmentGenerationIssue[];
  };
}
