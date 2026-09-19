import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentPackageValidationContext,
  AssessmentGradeCalibrationProfile,
  SubjectAssessmentProfile,
  AssessmentAnswerVerificationProvider,
  AssessmentQualityReviewProvider,
  AssessmentValidationReport,
} from '../src/types';
import {
  validateGeneratedAssessment,
  isAssessmentValidationReportStale,
  runStructuralAssessmentValidation,
  validateAssessmentAssembly,
} from '../src/services/assessmentValidationService';
import { validateAssessmentCoverage } from '../src/services/assessmentCoverageValidationService';
import { verifyAssessmentPackageAnswers } from '../src/services/assessmentAnswerVerificationService';
import { reviewAssessmentPackageQuality } from '../src/services/assessmentQualityReviewService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passedCount = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      process.exit(1);
    }
  })();
}

const mockValidationContext: AssessmentPackageValidationContext = {
  academicSetting: {
    id: 'setting-1',
    subjectId: 'BIOLOGY',
    gradeLevel: '10',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: 'ODD',
  },
  assessmentPlan: {
    id: 'plan-valid-1',
    title: 'Rencana Asesmen Biologi',
    workflowStatus: 'SIAP',
    instruments: [{ type: 'WRITTEN_TEST' }],
  } as any,
  tp: {
    items: [
      { id: 'tp-1', text: 'Memahami ekosistem' },
      { id: 'tp-2', text: 'Menganalisis jaring makanan' },
    ],
  } as any,
  assessmentCriteria: [
    { id: 'crit-1', text: 'Kriteria 1' },
  ] as any,
  learningPlanContext: {
    objectives: [
      { id: 'tp-1', text: 'Memahami ekosistem', targetCognitiveLevel: 'C2' },
      { id: 'tp-2', text: 'Menganalisis jaring makanan', targetCognitiveLevel: 'C4' },
    ],
  },
};

const validPackage: AssessmentPackage = {
  id: 'pkg-valid-1',
  assessmentPlanId: 'plan-valid-1',
  title: 'Paket Asesmen Biologi',
  workflowStatus: 'IN_PROGRESS',
  academicSettingId: 'setting-1',
  revision: 1,
  rubrics: [],
  scoringGuides: [],
  blueprintItems: [
    {
      id: 'bp-1',
      coverageUnitId: 'cu-1',
      objectiveRefId: 'tp-1',
      criterionId: 'crit-1',
      assessmentIndicator: 'Siswa dapat menjelaskan fungsi klorofil',
      instrumentType: 'WRITTEN_TEST',
      instrumentItemIds: ['item-1'],
      order: 1,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis Biologi',
      items: [
        {
          id: 'item-1',
          blueprintItemId: 'bp-1',
          coverageUnitId: 'cu-1',
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Apakah fungsi klorofil dalam fotosintesis?',
          options: [
            { id: 'opt-a', label: 'A', text: 'Menyerap energi cahaya', isCorrect: true },
            { id: 'opt-b', label: 'B', text: 'Menghasilkan CO2', isCorrect: false },
          ],
          order: 1,
        },
      ],
    },
  ],
  answerKeys: [
    {
      id: 'ak-1',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-1',
      answerType: 'SINGLE_OPTION',
      optionIds: ['opt-a'],
    },
  ],
};

const validPlan: AssessmentGenerationPlan = {
  id: 'plan-valid-1',
  title: 'Rencana Asesmen Biologi',
  specId: 'spec-1',
  status: 'APPROVED',
  coverageUnits: [
    {
      id: 'cu-1',
      objectiveRefId: 'tp-1',
      criterionId: 'crit-1',
      allocationUnit: 'ITEM',
      instrumentType: 'WRITTEN_TEST',
      recommendedCount: 1,
      targetCognitiveDemand: 'UNDERSTANDING',
    },
  ],
};

async function runAllTests() {
  console.log('=== STARTING AUDIT 9C.5 ASSESSMENT VALIDATION REGRESSION SUITE ===\n');

  // Test A: Structural Validation Adapter - Valid Package
  await test('Test A: Structural validation returns PASS for valid package', () => {
    const sec = runStructuralAssessmentValidation(validPackage, mockValidationContext);
    if (sec.status !== 'PASS') {
      console.log('Test A findings:', sec.findings);
    }
    assert(sec.status === 'PASS', 'Expected structural status PASS');
    assert(sec.findings.length === 0, 'Expected no findings');
  });

  // Test B: Structural Validation Adapter - Invalid Package
  await test('Test B: Structural validation returns FAIL for invalid package', () => {
    const invalidPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [], // Missing blueprint items
    };
    const sec = runStructuralAssessmentValidation(invalidPkg, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected structural status FAIL for empty blueprint');
    assert(sec.findings.some((f) => f.code === 'STRUCTURAL_ERROR'), 'Expected STRUCTURAL_ERROR finding');
  });

  // Test C: Coverage Validation - Match Plan
  await test('Test C: Coverage validation returns PASS when package matches generation plan', () => {
    const sec = validateAssessmentCoverage(validPackage, validPlan, mockValidationContext);
    assert(sec.status === 'PASS', 'Expected coverage status PASS');
    assert(sec.findings.length === 0, 'Expected zero findings');
  });

  // Test D: Coverage Validation - Missing Planned Coverage
  await test('Test D: Coverage validation flags MISSING_PLANNED_COVERAGE when unit missing in package', () => {
    const planWithMissingUnit: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        ...validPlan.coverageUnits,
        {
          id: 'cu-missing-2',
          objectiveRefId: 'tp-2',
          allocationUnit: 'ITEM',
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(validPackage, planWithMissingUnit, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected coverage status FAIL');
    assert(sec.findings.some((f) => f.code === 'MISSING_PLANNED_COVERAGE'), 'Expected MISSING_PLANNED_COVERAGE finding');
  });

  // Test E: Coverage Validation - Mismatched Objective Ref
  await test('Test E: Coverage validation flags OBJECTIVE_REF_MISMATCH when blueprint refers wrong objective', () => {
    const pkgMismatch: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-wrong-ref', // mismatch
          criterionId: 'crit-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgMismatch, validPlan, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected coverage status FAIL');
    assert(sec.findings.some((f) => f.code === 'OBJECTIVE_REF_MISMATCH'), 'Expected OBJECTIVE_REF_MISMATCH finding');
  });

  // Test F: Coverage Validation - Mismatched Instrument Type
  await test('Test F: Coverage validation flags INSTRUMENT_TYPE_MISMATCH', () => {
    const pkgInstrumentTypeMismatch: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'PERFORMANCE', // plan expected WRITTEN_TEST
          title: 'Unjuk Kerja',
          task: 'Lakukan pengamatan',
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgInstrumentTypeMismatch, validPlan, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected coverage status FAIL');
    assert(sec.findings.some((f) => f.code === 'INSTRUMENT_TYPE_MISMATCH'), 'Expected INSTRUMENT_TYPE_MISMATCH finding');
  });

  // Test G: Coverage Validation - Incompatible Allocation Semantics
  await test('Test G: Coverage validation flags ALLOCATION_SEMANTICS_MISMATCH', () => {
    const planIncompatible: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          allocationUnit: 'EVIDENCE', // EVIDENCE requires PORTFOLIO, but inst is WRITTEN_TEST
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(validPackage, planIncompatible, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected coverage status FAIL');
    assert(sec.findings.some((f) => f.code === 'ALLOCATION_SEMANTICS_MISMATCH'), 'Expected ALLOCATION_SEMANTICS_MISMATCH finding');
  });

  // Test H: Answer Verification - Objective Item Deterministic PASS
  await test('Test H: Answer verification passes valid multiple choice item deterministically', async () => {
    const res = await verifyAssessmentPackageAnswers(validPackage);
    assert(res.section.status === 'PASS', 'Expected answer verification status PASS');
    assert(res.itemResults.some((r) => r.status === 'VERIFIED'), 'Expected item result VERIFIED');
  });

  // Test I: Answer Verification - Non-applicable Instrument
  await test('Test I: Answer verification marks subjective performance instrument as NOT_APPLICABLE', async () => {
    const performancePkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-perf-1',
          type: 'PERFORMANCE',
          title: 'Praktikum',
          task: 'Praktikum fotosintesis',
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(performancePkg);
    assert(res.section.status === 'PASS', 'Expected NOT_APPLICABLE instruments do NOT fail answer verification');
  });

  // Test J: Answer Verification - Dangling Option Reference
  await test('Test J: Answer verification detects DANGLING_ANSWER_KEY_OPTION', async () => {
    const danglingKeyPkg: AssessmentPackage = {
      ...validPackage,
      answerKeys: [
        {
          id: 'ak-1',
          instrumentId: 'inst-1',
          instrumentItemId: 'item-1',
          answerType: 'SINGLE_OPTION',
          optionIds: ['nonexistent-opt-id'], // Dangling option reference
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(danglingKeyPkg);
    assert(res.section.status === 'FAIL', 'Expected answer verification status FAIL');
    assert(res.section.findings.some((f) => f.code === 'DANGLING_ANSWER_KEY_OPTION'), 'Expected DANGLING_ANSWER_KEY_OPTION finding');
  });

  // Test K: Answer Verification - Dual Source Conflict
  await test('Test K: Answer verification detects ANSWER_SOURCE_CONFLICT between options and answerKey', async () => {
    const conflictPkg: AssessmentPackage = {
      ...validPackage,
      answerKeys: [
        {
          id: 'ak-1',
          instrumentId: 'inst-1',
          instrumentItemId: 'item-1',
          answerType: 'SINGLE_OPTION',
          optionIds: ['opt-b'], // opt-b is false in item.options, whereas opt-a is true
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(conflictPkg);
    assert(res.section.status === 'FAIL', 'Expected answer verification status FAIL on conflicting key');
    assert(res.section.findings.some((f) => f.code === 'ANSWER_SOURCE_CONFLICT'), 'Expected ANSWER_SOURCE_CONFLICT finding');
  });

  // Test L: Answer Verification - AI Verifier Denoing Wrong Answer
  await test('Test L: AI Answer Verifier REJECTED leads to FAIL and WRONG_SEMANTIC_ANSWER finding', async () => {
    const mockAIProvider: AssessmentAnswerVerificationProvider = {
      verify: async (_req) => ({
        results: [
          {
            instrumentItemId: 'item-1',
            status: 'REJECTED',
            reason: 'Jawaban yang ditunjuk salah secara ilmiah.',
          },
        ],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, mockAIProvider);
    assert(res.section.status === 'FAIL', 'Expected answer verification FAIL');
    assert(res.section.findings.some((f) => f.code === 'WRONG_SEMANTIC_ANSWER'), 'Expected WRONG_SEMANTIC_ANSWER finding');
  });

  // Test M: Quality Review - Skipped / Provider Unavailable
  await test('Test M: Quality review without provider returns REVIEW and QUALITY_REVIEW_SKIPPED', async () => {
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan);
    assert(res.section.status === 'REVIEW', 'Expected quality review status REVIEW');
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected reviewerStatus REVIEW_UNAVAILABLE');
    assert(res.section.findings.some((f) => f.code === 'QUALITY_REVIEW_SKIPPED'), 'Expected QUALITY_REVIEW_SKIPPED finding');
  });

  // Test N: Quality Review - Successful Provider Execution PASS
  await test('Test N: Quality review with valid provider returning PASS findings succeeds', async () => {
    const mockQualityProvider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'TRACEABILITY',
            status: 'PASS',
            reason: 'Setiap item memiliki jejak TP/KD yang jelas.',
            instrumentItemId: 'item-1',
          },
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, mockQualityProvider);
    assert(res.section.status === 'PASS', 'Expected quality review status PASS');
    assert(res.reviewerStatus === 'COMPLETED', 'Expected reviewerStatus COMPLETED');
  });

  // Test O: Quality Review - Malformed AI Response
  await test('Test O: Quality review flags MALFORMED_QUALITY_FINDING when raw finding is invalid', async () => {
    const mockMalformedQualityProvider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'INVALID_DIMENSION' as any, // invalid dimension
            status: 'PASS',
            reason: '', // empty reason
          },
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, mockMalformedQualityProvider);
    assert(res.section.status === 'REVIEW', 'Expected quality review status REVIEW for malformed finding');
    assert(res.section.findings.some((f) => f.code === 'MALFORMED_QUALITY_FINDING'), 'Expected MALFORMED_QUALITY_FINDING finding');
  });

  // Test P: Assembly Validation - Duplicate Item Prompt
  await test('Test P: Assembly validation detects EXACT_DUPLICATE_ITEM_PROMPT', () => {
    const duplicatePromptPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-1',
              itemType: 'MULTIPLE_CHOICE',
              prompt: 'Apakah fungsi klorofil dalam fotosintesis?',
              options: [{ id: 'opt-a', text: 'Menyerap cahaya', isCorrect: true }],
              order: 1,
            },
            {
              id: 'item-2',
              itemType: 'MULTIPLE_CHOICE',
              prompt: 'Apakah fungsi klorofil dalam fotosintesis?  ', // exact duplicate normalized
              options: [{ id: 'opt-b', text: 'Menyerap cahaya', isCorrect: true }],
              order: 2,
            },
          ],
        },
      ],
    };
    const sec = validateAssessmentAssembly(duplicatePromptPkg);
    assert(sec.status === 'REVIEW', 'Expected assembly validation status REVIEW');
    assert(sec.findings.some((f) => f.code === 'EXACT_DUPLICATE_ITEM_PROMPT'), 'Expected EXACT_DUPLICATE_ITEM_PROMPT finding');
  });

  // Test Q: Full Assessment Validation Aggregator - DETERMINISTIC FAIL > AI PASS
  await test('Test Q: Full validator overallStatus is FAIL when deterministic check fails even if AI quality passes', async () => {
    const invalidPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [], // structural error
    };

    const mockPassingQualityProvider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'CONTENT_ALIGNMENT',
            status: 'PASS',
            reason: 'Kualitatif konten sangat baik.',
          },
        ],
      }),
    };

    const report = await validateGeneratedAssessment({
      assessmentPackage: invalidPkg,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
      qualityReviewProvider: mockPassingQualityProvider,
    });

    assert(report.overallStatus === 'FAIL', 'DETERMINISTIC FAIL MUST OVERRIDE AI PASS -> overallStatus FAIL');
    assert(report.structural.status === 'FAIL', 'Structural section must be FAIL');
    assert(report.quality.status === 'PASS', 'Quality section can be PASS');
  });

  // Test R: Immutability and Stale Report Helper Check
  await test('Test R: Validation does NOT mutate input package and isAssessmentValidationReportStale detects revision mismatch', async () => {
    const initialPkgState = JSON.stringify(validPackage);

    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });

    assert(JSON.stringify(validPackage) === initialPkgState, 'Input assessmentPackage MUST NOT be mutated!');
    assert(validPackage.workflowStatus === 'IN_PROGRESS', 'workflowStatus MUST NOT be changed by validation!');

    // Stale report check
    assert(!isAssessmentValidationReportStale(report, validPackage), 'Report for same revision must NOT be stale');

    const updatedPkg: AssessmentPackage = {
      ...validPackage,
      revision: 2,
    };
    assert(isAssessmentValidationReportStale(report, updatedPkg), 'Report for previous revision MUST be stale');
  });

  console.log(`\n=== ALL ${passedCount} AUDIT 9C.5 REGRESSION TESTS PASSED SUCCESSFULLY! ===`);
}

runAllTests().catch((e) => {
  console.error('Fatal error running regression tests:', e);
  process.exit(1);
});
