import {
  createEmptyAssessmentPackage,
  validateAssessmentPackage,
  confirmAssessmentPackage,
  invalidateAssessmentPackageDependencies,
} from '../src/services/assessmentPackageService';
import { generateAssessment } from '../src/services/documentEngine/generators/assessmentGenerator';
import {
  AcademicSetting,
  AssessmentPlan,
  AssessmentPackage,
  TPData,
  TeacherProfile,
  SchoolData,
} from '../src/types';

async function runRegressionTests() {
  console.log('=== STARTING AUDIT 9B REGRESSION TEST SUITE ===\n');

  const mockAcademicSetting: AcademicSetting = {
    id: 'setting-1',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'IPAS',
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'prof-1',
    name: 'Guru Test',
    nip: '123456789',
    status: 'PNS',
    defaultLevel: 'SD',
    defaultSubject: 'IPAS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSchool: SchoolData = {
    id: 'sch-1',
    name: 'SD Negeri 1 Test',
    address: 'Jl. Pendidikan No. 1',
    npsn: '12345678',
    village: 'Desa Test',
    district: 'Kecamatan Test',
    regency: 'Kabupaten Test',
    province: 'Provinsi Test',
    principalName: 'Kepala Sekolah',
    principalNip: '987654321',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTP: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    items: [
      { id: 'tp-1', code: 'TP-1', statement: 'Menganalisis fotosintesis pada tumbuhan', competence: 'Menganalisis', contentScope: 'Fotosintesis', p3Dimensions: [], order: 1 },
      { id: 'tp-2', code: 'TP-2', statement: 'Memahami siklus air dan dampaknya', competence: 'Memahami', contentScope: 'Siklus Air', p3Dimensions: [], order: 2 },
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockAssessmentPlan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Penilaian Sumatif Bab 1 IPAS',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    criterionIds: [],
    instruments: [{ id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis Essay' }],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Test Factory: createEmptyAssessmentPackage
  console.log('Test 1: createEmptyAssessmentPackage factory');
  const pkg1 = createEmptyAssessmentPackage(mockAssessmentPlan, 'setting-1');
  if (pkg1.assessmentPlanId !== 'plan-1' || (pkg1.workflowStatus !== 'DRAFT' && pkg1.workflowStatus !== 'PERLU_DILENGKAPI')) {
    throw new Error('FAILED: Factory did not set parent plan ID or default DRAFT/PERLU_DILENGKAPI status');
  }
  console.log('  PASSED: Empty package created cleanly.');

  // 2. Test Parent Plan Not SIAP validation failure
  console.log('Test 2: Validation fails if parent AssessmentPlan is not SIAP');
  const draftPlan = { ...mockAssessmentPlan, workflowStatus: 'DRAFT' as const };
  const valParentNotReady = validateAssessmentPackage(pkg1, {
    academicSetting: mockAcademicSetting,
    assessmentPlan: draftPlan,
    tp: mockTP,
  });
  if (valParentNotReady.valid) {
    throw new Error('FAILED: Package validation should fail when parent AssessmentPlan is DRAFT');
  }
  console.log(`  PASSED: Failed as expected with error: "${valParentNotReady.errors[0]}"`);

  // 3. Test Instrument Type Mismatch validation
  console.log('Test 3: Validation fails if instrument types mismatch parent AssessmentPlan');
  const invalidInstrumentPkg: AssessmentPackage = {
    ...pkg1,
    instruments: [{ id: 'inst-obs-1', type: 'OBSERVATION', aspects: [{ id: 'asp-1', label: 'Sikap' }] }],
  };
  const valMismatchInst = validateAssessmentPackage(invalidInstrumentPkg, {
    academicSetting: mockAcademicSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
  });
  if (valMismatchInst.valid) {
    throw new Error('FAILED: Package validation should fail on instrument type mismatch');
  }
  console.log(`  PASSED: Failed as expected with error: "${valMismatchInst.errors[0]}"`);

  // 4. Test Blueprint Invalid Objective Ref
  console.log('Test 4: Validation fails if blueprint refers to invalid TP/KD ID');
  const invalidBlueprintPkg: AssessmentPackage = {
    ...pkg1,
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'non-existent-tp',
        assessmentIndicator: 'Siswa dapat menjelaskan x',
        materialOrContext: 'Materi 1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: [],
        order: 1,
      },
    ],
  };
  const valInvalidBp = validateAssessmentPackage(invalidBlueprintPkg, {
    academicSetting: mockAcademicSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
  });
  if (valInvalidBp.valid) {
    throw new Error('FAILED: Package validation should fail when objectiveRefId is invalid');
  }
  console.log(`  PASSED: Failed as expected with error: "${valInvalidBp.errors[0]}"`);

  // 5. Test Confirm Package Workflow & Validation
  console.log('Test 5: Confirming package transition to SIAP when valid');
  const validPkg: AssessmentPackage = {
    ...pkg1,
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Siswa dapat menjelaskan proses fotosintesis',
        materialOrContext: 'Fotosintesis',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-1'],
        order: 1,
      },
    ],
    instruments: [
      {
        id: 'inst-w-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'ESSAY',
            prompt: 'Jelaskan peran cahaya matahari dalam fotosintesis.',
            order: 1,
          },
        ],
      },
    ],
  };

  const confirmRes = confirmAssessmentPackage(validPkg, {
    academicSetting: mockAcademicSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
  });

  if (!confirmRes.success || confirmRes.package.workflowStatus !== 'SIAP') {
    throw new Error(`FAILED: Could not confirm valid package. Errors: ${confirmRes.errors.join(', ')}`);
  }
  console.log('  PASSED: Package successfully confirmed and status updated to SIAP.');

  // 6. Test Invalidation Dependency Tracking
  console.log('Test 6: Dependency Invalidation when parent plan is downgraded from SIAP');
  const confirmedPkg = confirmRes.package;
  const invRes = invalidateAssessmentPackageDependencies(confirmedPkg, {
    academicSetting: mockAcademicSetting,
    assessmentPlan: draftPlan,
    tp: mockTP,
  });
  if (!invRes.isInvalidated || invRes.package.workflowStatus !== 'PERLU_DILENGKAPI') {
    throw new Error('FAILED: Package status was not invalidated to PERLU_DILENGKAPI when parent plan was downgraded');
  }
  console.log('  PASSED: Package automatically invalidated to PERLU_DILENGKAPI.');

  // 7. Test Generator Throws on Non-SIAP Package
  console.log('Test 7: Document Generator blocks export if AssessmentPackage is not SIAP');
  let threwExportError = false;
  try {
    await generateAssessment({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      documentMode: 'data',
      assessmentPlans: [mockAssessmentPlan],
      assessmentPackages: [invRes.package], // invRes.package is PERLU_DILENGKAPI
      skipDownload: true,
    });
  } catch (err: any) {
    threwExportError = true;
    console.log(`  PASSED: Generator threw expected error: "${err.message}"`);
  }
  if (!threwExportError) {
    throw new Error('FAILED: Document generator did NOT throw error for non-SIAP package');
  }

  console.log('\n=== ALL AUDIT 9B REGRESSION TESTS PASSED SUCCESSFULLY! ===');
}

runRegressionTests();
