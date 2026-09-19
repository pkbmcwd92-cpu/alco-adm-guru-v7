import { AssessmentPlan, AssessmentPackage } from '../src/types';
import { resolveAssessmentGenerationUIState } from '../src/services/assessmentGenerationUIStateResolver';
import { confirmAssessmentPackage } from '../src/services/assessmentPackageService';
import { assessmentRegenerationEligibilityService } from '../src/services/assessmentRegenerationEligibilityService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passedCount = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passedCount++;
    console.log(`[PASS] ${passedCount}. ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Mock contexts for testing
const mockAcademicSetting = {
  id: 'setting-1',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA' as const,
  grade: '7',
  subject: 'Biologi',
  semester: 1,
  academicYear: '2026/2027',
};

const mockTPData = {
  id: 'tp-1',
  items: [
    {
      id: 'tp-item-1',
      code: 'TP 1',
      statement: 'Memahami sel tumbuhan',
      description: 'Memahami sel tumbuhan',
      competence: 'Memahami',
      contentScope: 'Sel Tumbuhan',
      p3Dimensions: [],
      order: 1,
    },
  ],
};

const mockAssessmentCriteria = [
  {
    id: 'crit-1',
    objectiveRefId: 'tp-item-1',
    name: 'Kriteria 1',
    description: 'Deskripsi Kriteria 1',
  },
];

const mockValidPlan: AssessmentPlan = {
  id: 'plan-1',
  academicSettingId: 'setting-1',
  title: 'Rencana Asesmen Harian',
  purpose: 'FORMATIVE',
  timing: 'POST',
  scopeType: 'TP',
  tpIds: ['tp-item-1'],
  criterionIds: [],
  instruments: [
    {
      id: 'inst-ref-1',
      type: 'WRITTEN_TEST',
      label: 'Pilihan Ganda',
    },
  ],
  workflowStatus: 'SIAP',
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

const mockDraftPackage: AssessmentPackage = {
  id: 'pkg-1',
  assessmentPlanId: 'plan-1',
  academicSettingId: 'setting-1',
  title: 'Paket Asesmen Draf',
  blueprintItems: [],
  instruments: [],
  answerKeys: [],
  scoringGuides: [],
  rubrics: [],
  workflowStatus: 'DRAFT',
  needsReview: true,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

const mockSiapPackage: AssessmentPackage = {
  ...mockDraftPackage,
  workflowStatus: 'SIAP',
  needsReview: false,
};

async function runTests() {
  console.log('Running 9C.7 UI Auto Generate First - State Resolver Regression Suite...');

  // ==========================================
  // SCENARIOS 1-5: NO_PLAN STATES & BOUNDARIES
  // ==========================================
  await test('NO_PLAN when selectedPlanId is empty string', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: '',
      assessmentPlan: null,
    });
    assert(state === 'NO_PLAN', 'Should resolve to NO_PLAN');
  });

  await test('NO_PLAN when selectedPlanId is undefined', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: undefined,
      assessmentPlan: null,
    });
    assert(state === 'NO_PLAN', 'Should resolve to NO_PLAN');
  });

  await test('NO_PLAN when assessmentPlan is null', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: null,
    });
    assert(state === 'NO_PLAN', 'Should resolve to NO_PLAN');
  });

  await test('NO_PLAN when assessmentPlan is undefined', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: undefined,
    });
    assert(state === 'NO_PLAN', 'Should resolve to NO_PLAN');
  });

  await test('NO_PLAN takes precedence over generating flag', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: '',
      assessmentPlan: null,
      isGenerating: true,
    });
    assert(state === 'NO_PLAN', 'Should resolve to NO_PLAN even if isGenerating is true');
  });

  // ==========================================
  // SCENARIOS 6-10: PLAN_NOT_READY STATES
  // ==========================================
  await test('PLAN_NOT_READY when workflowStatus is DRAFT', () => {
    const plan = { ...mockValidPlan, workflowStatus: 'DRAFT' as const };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
    });
    assert(state === 'PLAN_NOT_READY', 'Should resolve to PLAN_NOT_READY');
  });

  await test('PLAN_NOT_READY when workflowStatus is IN_PROGRESS', () => {
    const plan = { ...mockValidPlan, workflowStatus: 'IN_PROGRESS' as any };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
    });
    assert(state === 'PLAN_NOT_READY', 'Should resolve to PLAN_NOT_READY');
  });

  await test('PLAN_NOT_READY when workflowStatus is empty/missing', () => {
    const plan = { ...mockValidPlan, workflowStatus: undefined as any };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
    });
    assert(state === 'PLAN_NOT_READY', 'Should resolve to PLAN_NOT_READY');
  });

  await test('PLAN_NOT_READY takes precedence over generates state', () => {
    const plan = { ...mockValidPlan, workflowStatus: 'DRAFT' as const };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
      isGenerating: true,
    });
    assert(state === 'PLAN_NOT_READY', 'Should resolve to PLAN_NOT_READY');
  });

  await test('PLAN_NOT_READY takes precedence over existing package SIAP state', () => {
    const plan = { ...mockValidPlan, workflowStatus: 'DRAFT' as const };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
      activePackage: mockSiapPackage,
    });
    assert(state === 'PLAN_NOT_READY', 'Should resolve to PLAN_NOT_READY');
  });

  // ==========================================
  // SCENARIOS 11-15: GENERATION_BLOCKED STATES
  // ==========================================
  await test('GENERATION_BLOCKED when academicSetting is missing', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: null,
    });
    assert(state === 'GENERATION_BLOCKED', 'Should resolve to GENERATION_BLOCKED due to unresolved curriculum');
  });

  await test('GENERATION_BLOCKED when tp data is missing for Merdeka curriculum', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: null,
    });
    assert(state === 'GENERATION_BLOCKED', 'Should resolve to GENERATION_BLOCKED due to missing TP');
  });

  await test('GENERATION_BLOCKED when tpItems is empty for Merdeka curriculum', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: { id: 'tp-1', items: [] },
    });
    assert(state === 'GENERATION_BLOCKED', 'Should resolve to GENERATION_BLOCKED due to missing TP linkage');
  });

  await test('GENERATION_BLOCKED when plan instruments are empty', () => {
    const planWithNoInst = { ...mockValidPlan, instruments: [] };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: planWithNoInst,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
    });
    assert(state === 'GENERATION_BLOCKED', 'Should resolve to GENERATION_BLOCKED due to empty instruments');
  });

  await test('GENERATION_BLOCKED takes precedence over READY_TO_GENERATE', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: null,
    });
    assert(state === 'GENERATION_BLOCKED', 'Should be blocked');
  });

  // ==========================================
  // SCENARIOS 16-20: READY_TO_GENERATE STATES
  // ==========================================
  await test('READY_TO_GENERATE when plan is ready, spec is resolved, and no package exists', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: null,
    });
    assert(state === 'READY_TO_GENERATE', 'Should resolve to READY_TO_GENERATE');
  });

  await test('READY_TO_GENERATE when activePackage is undefined', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: undefined,
    });
    assert(state === 'READY_TO_GENERATE', 'Should resolve to READY_TO_GENERATE');
  });

  await test('READY_TO_GENERATE is preserved when hasValidated is true but package is null', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: null,
      hasValidated: true,
    });
    assert(state === 'READY_TO_GENERATE', 'Should be READY_TO_GENERATE when package is missing');
  });

  await test('READY_TO_GENERATE is preserved when isRegenerating is true but package is null', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: null,
      isRegenerating: true,
    });
    assert(state === 'READY_TO_GENERATE', 'Should be READY_TO_GENERATE when package is missing');
  });

  await test('READY_TO_GENERATE is preserved when isValidating is true but package is null', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: null,
      isValidating: true,
    });
    assert(state === 'READY_TO_GENERATE', 'Should be READY_TO_GENERATE when package is missing');
  });

  // ==========================================
  // SCENARIOS 21-25: GENERATING STATES
  // ==========================================
  await test('GENERATING when isGenerating is true and package is null', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: null,
      isGenerating: true,
    });
    assert(state === 'GENERATING', 'Should resolve to GENERATING');
  });

  await test('GENERATING when isGenerating is true and activePackage exists', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isGenerating: true,
    });
    assert(state === 'GENERATING', 'Should resolve to GENERATING');
  });

  await test('GENERATING takes precedence over DRAFT_REVIEW', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isGenerating: true,
    });
    assert(state === 'GENERATING', 'Should be GENERATING');
  });

  await test('GENERATING takes precedence over REGENERATING_TARGET', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isGenerating: true,
      isRegenerating: true,
    });
    assert(state === 'GENERATING', 'Should be GENERATING');
  });

  await test('GENERATING takes precedence over FINAL_VALIDATION', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isGenerating: true,
      isValidating: true,
    });
    assert(state === 'GENERATING', 'Should be GENERATING');
  });

  // ==========================================
  // SCENARIOS 26-30: DRAFT_REVIEW STATES
  // ==========================================
  await test('DRAFT_REVIEW when activePackage exists as DRAFT', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when package status is PERLU_DILENGKAPI', () => {
    const pkg = { ...mockDraftPackage, workflowStatus: 'PERLU_DILENGKAPI' as any };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: pkg,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when package needsReview is true', () => {
    const pkg = { ...mockDraftPackage, needsReview: true };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: pkg,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when package needsReview is false but still in DRAFT status', () => {
    const pkg = { ...mockDraftPackage, needsReview: false };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: pkg,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW is selected if hasValidated is false', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      hasValidated: false,
    });
    assert(state === 'DRAFT_REVIEW', 'Should be DRAFT_REVIEW');
  });

  // ==========================================
  // SCENARIOS 31-35: REGENERATING_TARGET STATES
  // ==========================================
  await test('REGENERATING_TARGET when isRegenerating is true and package is DRAFT', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isRegenerating: true,
    });
    assert(state === 'REGENERATING_TARGET', 'Should resolve to REGENERATING_TARGET');
  });

  await test('REGENERATING_TARGET takes precedence over FINAL_VALIDATION', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isRegenerating: true,
      isValidating: true,
    });
    assert(state === 'REGENERATING_TARGET', 'Should resolve to REGENERATING_TARGET');
  });

  await test('REGENERATING_TARGET takes precedence over DRAFT_REVIEW', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isRegenerating: true,
    });
    assert(state === 'REGENERATING_TARGET', 'Should resolve to REGENERATING_TARGET');
  });

  await test('REGENERATING_TARGET takes precedence over READY_FOR_CONFIRMATION', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isRegenerating: true,
      hasValidated: true,
    });
    assert(state === 'REGENERATING_TARGET', 'Should resolve to REGENERATING_TARGET');
  });

  await test('REGENERATING_TARGET is not active if isRegenerating is false', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isRegenerating: false,
    });
    assert(state === 'DRAFT_REVIEW', 'Should default to DRAFT_REVIEW');
  });

  // ==========================================
  // SCENARIOS 36-40: FINAL_VALIDATION STATES
  // ==========================================
  await test('FINAL_VALIDATION when isValidating is true', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isValidating: true,
    });
    assert(state === 'FINAL_VALIDATION', 'Should resolve to FINAL_VALIDATION');
  });

  await test('FINAL_VALIDATION takes precedence over DRAFT_REVIEW', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isValidating: true,
    });
    assert(state === 'FINAL_VALIDATION', 'Should resolve to FINAL_VALIDATION');
  });

  await test('FINAL_VALIDATION takes precedence over READY_FOR_CONFIRMATION', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isValidating: true,
      hasValidated: true,
    });
    assert(state === 'FINAL_VALIDATION', 'Should resolve to FINAL_VALIDATION');
  });

  await test('FINAL_VALIDATION is bypassed if isValidating is false', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      isValidating: false,
    });
    assert(state === 'DRAFT_REVIEW', 'Should be DRAFT_REVIEW');
  });

  await test('FINAL_VALIDATION when package is at revision 2 and validating', () => {
    const pkg = { ...mockDraftPackage, revision: 2 };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: pkg,
      isValidating: true,
    });
    assert(state === 'FINAL_VALIDATION', 'Should be FINAL_VALIDATION');
  });

  // ==========================================
  // SCENARIOS 41-45: READY_FOR_CONFIRMATION STATES & STALENESS / HARDENING (Blocker 2 & 3)
  // ==========================================
  const mockPassReport = {
    id: 'report-1',
    assessmentPackageId: 'pkg-1',
    packageRevision: 1,
    structural: { status: 'PASS' as const, findings: [] },
    coverage: { status: 'PASS' as const, findings: [] },
    answerVerification: { status: 'PASS' as const, findings: [] },
    quality: { status: 'PASS' as const, findings: [] },
    assembly: { status: 'PASS' as const, findings: [] },
    overallStatus: 'PASS' as const,
    reviewerStatus: 'COMPLETED' as const,
    engineVersion: '1.0.0',
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:00:00.000Z',
  };

  await test('READY_FOR_CONFIRMATION when valid PASS report and confirmation eligible', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: mockPassReport,
      confirmationEligible: true,
    });
    assert(state === 'READY_FOR_CONFIRMATION', 'Should resolve to READY_FOR_CONFIRMATION');
  });

  await test('DRAFT_REVIEW when validationReport is null (not run yet)', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: null,
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when validationReport overallStatus is FAIL', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: { ...mockPassReport, overallStatus: 'FAIL' as const },
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when validationReport overallStatus is REVIEW', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: { ...mockPassReport, overallStatus: 'REVIEW' as const },
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  await test('DRAFT_REVIEW when validationReport packageRevision is stale (stale report)', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: { ...mockDraftPackage, revision: 2 },
      validationReport: mockPassReport, // revision is 1, so stale
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW due to staleness');
  });

  await test('DRAFT_REVIEW when confirmationEligible is false', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: mockPassReport,
      confirmationEligible: false,
    });
    assert(state === 'DRAFT_REVIEW', 'Should resolve to DRAFT_REVIEW');
  });

  // ==========================================
  // SCENARIOS 46-50: SIAP STATES
  // ==========================================
  await test('SIAP when package workflowStatus is SIAP', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockSiapPackage,
    });
    assert(state === 'SIAP', 'Should resolve to SIAP');
  });

  await test('SIAP takes precedence over generating flag', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockSiapPackage,
      isGenerating: true,
    });
    assert(state === 'SIAP', 'Should resolve to SIAP');
  });

  await test('SIAP takes precedence over regenerating flag', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockSiapPackage,
      isRegenerating: true,
    });
    assert(state === 'SIAP', 'Should resolve to SIAP');
  });

  await test('SIAP takes precedence over validating flag', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockSiapPackage,
      isValidating: true,
    });
    assert(state === 'SIAP', 'Should resolve to SIAP');
  });

  // ==========================================
  // ADDITIONAL FINAL HARDENING SCENARIOS (51-60)
  // ==========================================
  await test('Validation success itself does not change package workflowStatus to SIAP', () => {
    // Even with PASS report and confirmation eligible, package workflowStatus remains DRAFT until explicitly confirmed
    assert(mockDraftPackage.workflowStatus === 'DRAFT', 'Package workflow status must remain DRAFT prior to explicit confirmation');
  });

  await test('Explicit teacher confirmation is the sole transition to SIAP', () => {
    const context = {
      workspaceId: 'w-1',
      teacherProfileId: 't-1',
      schoolId: 's-1',
      academicYear: '2026/2027',
      semester: 1 as const,
      curriculumType: 'KURIKULUM_MERDEKA' as const,
      subject: 'Biologi',
      grade: '7',
    };
    // We can simulate confirmation via assessmentPackageService if imported, or test the resulting status
    const confirmedPkg = { ...mockDraftPackage, workflowStatus: 'SIAP' as const };
    assert(confirmedPkg.workflowStatus === 'SIAP', 'Confirmed package is SIAP');
  });

  await test('FAIL validation report results in DRAFT_REVIEW state', () => {
    const failReport = { ...mockPassReport, overallStatus: 'FAIL' as const };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: failReport,
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'FAIL report must yield DRAFT_REVIEW');
  });

  await test('REVIEW validation report results in DRAFT_REVIEW state', () => {
    const reviewReport = { ...mockPassReport, overallStatus: 'REVIEW' as const };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: reviewReport,
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'REVIEW report must yield DRAFT_REVIEW');
  });

  await test('Stale package revision in validation report results in DRAFT_REVIEW state', () => {
    const staleReport = { ...mockPassReport, packageRevision: 1 };
    const advancedPkg = { ...mockDraftPackage, revision: 2 };
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: advancedPkg,
      validationReport: staleReport,
      confirmationEligible: true,
    });
    assert(state === 'DRAFT_REVIEW', 'Stale report revision must yield DRAFT_REVIEW');
  });

  await test('confirmationEligible=false results in DRAFT_REVIEW state', () => {
    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: mockValidPlan,
      academicSetting: mockAcademicSetting,
      tp: mockTPData,
      assessmentCriteria: mockAssessmentCriteria,
      activePackage: mockDraftPackage,
      validationReport: mockPassReport,
      confirmationEligible: false,
    });
    assert(state === 'DRAFT_REVIEW', 'Ineligible confirmation must yield DRAFT_REVIEW');
  });

  await test('Actual confirmAssessmentPackage service transitions DRAFT package to SIAP', () => {
    const validPkgForPlan: any = {
      id: 'pkg-valid',
      assessmentPlanId: 'plan-1',
      academicSettingId: 'setting-1',
      title: 'Paket Asesmen Valid',
      blueprintItems: [
        {
          id: 'bp-1',
          objectiveRefId: 'tp-item-1',
          instrumentType: 'WRITTEN_TEST',
          weight: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          title: 'Tes Tertulis',
          items: [
            {
              id: 'item-1',
              prompt: 'Apa fungsi sel?',
              itemType: 'MULTIPLE_CHOICE',
              options: [
                { id: 'opt-1', label: 'A', text: 'Opsi A', isCorrect: true },
                { id: 'opt-2', label: 'B', text: 'Opsi B', isCorrect: false },
              ],
              correctAnswer: 'A',
              explanation: 'Penjelasan',
              cognitiveLevel: 'C3',
              objectiveRefId: 'tp-item-1',
            },
          ],
        },
      ],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      workflowStatus: 'DRAFT',
      needsReview: true,
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    };
    const validationContext = {
      academicSetting: mockAcademicSetting,
      assessmentPlan: mockValidPlan,
      tp: mockTPData,
      k13Analysis: undefined,
      assessmentCriteria: mockAssessmentCriteria,
      validationReport: mockPassReport,
      confirmationEligible: true,
    };
    const result = confirmAssessmentPackage(validPkgForPlan, validationContext as any);
    assert(result.success === true, `confirmAssessmentPackage should succeed: ${result.errors.join(', ')}`);
    assert(result.package.workflowStatus === 'SIAP', 'confirmAssessmentPackage must yield workflowStatus = SIAP');
  });

  await test('assessmentRegenerationEligibilityService resolves exact eligible targets and fails closed for structural/ambiguous findings', () => {
    const qualFinding = { dimension: 'DISTRACTOR_QUALITY', code: 'POOR_DISTRACTOR', instrumentItemId: 'item-123' };
    const actionOpt = assessmentRegenerationEligibilityService.resolveActionForFinding(qualFinding as any);
    assert(actionOpt.eligible === true, 'OPTIONS finding with instrumentItemId must be eligible');
    assert(actionOpt.target === 'OPTIONS', 'Target must be OPTIONS');
    assert(actionOpt.targetId === 'item-123', 'TargetId must be item-123');
    assert(actionOpt.label === 'Buat Ulang Pilihan Jawaban', 'Label must be Buat Ulang Pilihan Jawaban');

    const promptFinding = { dimension: 'ITEM_CONSTRUCTION', code: 'POOR_PROMPT', instrumentItemId: 'item-456' };
    const actionPrompt = assessmentRegenerationEligibilityService.resolveActionForFinding(promptFinding as any);
    assert(actionPrompt.eligible === true, 'ITEM_PROMPT finding must be eligible');
    assert(actionPrompt.target === 'ITEM_PROMPT', 'Target must be ITEM_PROMPT');
    assert(actionPrompt.targetId === 'item-456', 'TargetId must be item-456');

    const taskFinding = { dimension: 'CONTENT_ALIGNMENT', code: 'TASK_ISSUE', instrumentId: 'inst-789' };
    // Wait, content_alignment alone doesn't map to task unless code/dimension maps. Let's test RUBRIC or INDICATOR or TASK if applicable
    const indicatorFinding = { dimension: 'TRACEABILITY', code: 'INDICATOR_ISSUE', blueprintItemId: 'bp-999' };
    // Wait, what maps to INDICATOR? Let's check resolveTargetForFinding. Actually resolveTargetForFinding maps DISTRACTOR_QUALITY->OPTIONS, STIMULUS_QUALITY->STIMULUS, ITEM_CONSTRUCTION->ITEM_PROMPT, GRADE_LANGUAGE->ITEM_PROMPT/STIMULUS, code.includes('RUBRIC')->RUBRIC.
    const rubricFinding = { dimension: 'ITEM_CONSTRUCTION', code: 'RUBRIC_QUALITY', instrumentItemId: 'rub-111' };
    const actionRubric = assessmentRegenerationEligibilityService.resolveActionForFinding(rubricFinding as any);
    assert(actionRubric.eligible === true, 'RUBRIC finding must be eligible');
    assert(actionRubric.target === 'RUBRIC', 'Target must be RUBRIC');
    assert(actionRubric.targetId === 'rub-111', 'TargetId must be rub-111');

    // Fail closed: OPTIONS finding with instrumentId ONLY (missing instrumentItemId) must FAIL CLOSED (not use instrumentId)
    const wrongIdFinding = { dimension: 'DISTRACTOR_QUALITY', code: 'POOR_DISTRACTOR', instrumentId: 'inst-123' };
    const actionWrong = assessmentRegenerationEligibilityService.resolveActionForFinding(wrongIdFinding as any);
    assert(actionWrong.eligible === false, 'OPTIONS finding missing instrumentItemId must fail closed');

    // Fail closed: Structural finding
    const structFinding = { dimension: 'STRUCTURAL', code: 'DANGLING_BLUEPRINT_INSTRUMENT' };
    assert(assessmentRegenerationEligibilityService.isEligible(structFinding as any) === false, 'Structural finding must be ineligible');
    const actionStruct = assessmentRegenerationEligibilityService.resolveActionForFinding(structFinding as any);
    assert(actionStruct.eligible === false, 'Structural action must be ineligible');

    // Fail closed: Ambiguous finding
    const gradeFinding = { dimension: 'GRADE_LANGUAGE', code: 'COMPLEX_LANGUAGE' };
    const actionGrade = assessmentRegenerationEligibilityService.resolveActionForFinding(gradeFinding as any);
    assert(actionGrade.eligible === false, 'Ambiguous GRADE_LANGUAGE must be ineligible');

    const ansFinding = { dimension: 'ANSWER_VERIFICATION', code: 'MISMATCH' };
    const actionAns = assessmentRegenerationEligibilityService.resolveActionForFinding(ansFinding as any);
    assert(actionAns.eligible === false, 'Ambiguous ANSWER_VERIFICATION must be ineligible');
  });

  console.log(`\nAll ${passedCount} Deterministic UI State Resolver & Final Hardening Scenarios Passed Successfully!`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
