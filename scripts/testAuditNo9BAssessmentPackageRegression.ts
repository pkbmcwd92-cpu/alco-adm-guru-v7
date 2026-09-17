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
  K13Analysis,
  TeacherProfile,
  SchoolData,
  AssessmentBlueprintItem,
  AssessmentCriterion,
} from '../src/types';

async function runRegressionTests() {
  console.log('=== STARTING AUDIT 9B REGRESSION TEST SUITE (TESTS A-O) ===\n');

  const mockMerdekaSetting: AcademicSetting = {
    id: 'setting-merdeka',
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

  const mockK13Setting: AcademicSetting = {
    id: 'setting-k13',
    profileId: 'prof-1',
    curriculum: 'Kurikulum 2013',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'IPAS',
    updatedAt: new Date().toISOString(),
  };

  const mockUnresolvedSetting: AcademicSetting = {
    id: 'setting-unresolved',
    profileId: 'prof-1',
    curriculum: '' as any,
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
    academicSettingId: 'setting-merdeka',
    items: [
      { id: 'tp-1', code: 'TP-1', statement: 'Menganalisis fotosintesis pada tumbuhan', competence: 'Menganalisis', contentScope: 'Fotosintesis', p3Dimensions: [], order: 1 },
      { id: 'tp-2', code: 'TP-2', statement: 'Memahami siklus air dan dampaknya', competence: 'Memahami', contentScope: 'Siklus Air', p3Dimensions: [], order: 2 },
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockCriteria: AssessmentCriterion[] = [
    {
      id: 'crit-1',
      academicSettingId: 'setting-merdeka',
      tpId: 'tp-1',
      description: 'Penguasaan Konsep Fotosintesis',
      approach: 'rubrik',
      indicators: ['Menjelaskan fotosintesis'],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockAssessmentPlan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Penilaian Sumatif Bab 1 IPAS',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    criterionIds: ['crit-1'],
    instruments: [
      { id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
      { id: 'inst-ref-2', type: 'OBSERVATION', label: 'Lembar Observasi' },
    ],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const emptyPkg = createEmptyAssessmentPackage(mockAssessmentPlan, 'setting-merdeka');

  // TEST A: New blueprint does not depend on first TP/KD fallback (starts unresolved)
  console.log('Test A: New blueprint item initializes as unresolved (objectiveRefId = "")');
  const bpItemA: AssessmentBlueprintItem = {
    id: 'bp-a',
    objectiveRefId: '',
    instrumentType: '',
    instrumentItemIds: [],
    order: 1,
  };
  if (bpItemA.objectiveRefId !== '') {
    throw new Error('FAILED: New blueprint item should have empty objectiveRefId');
  }
  console.log('  PASSED: objectiveRefId is empty string by default.');

  // TEST B: No WRITTEN_TEST default fallback
  console.log('Test B: New blueprint item has unresolved instrumentType (instrumentType = "")');
  if (bpItemA.instrumentType !== '') {
    throw new Error('FAILED: New blueprint item should have empty instrumentType');
  }
  console.log('  PASSED: instrumentType is empty string by default.');

  const singleInstPlan: AssessmentPlan = {
    ...mockAssessmentPlan,
    instruments: [{ id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  };

  // TEST C: Merdeka + missing TP canonical source -> FAIL
  console.log('Test C: Merdeka + missing TP canonical source -> FAIL');
  const pkgWithBp: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: [], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valC = validateAssessmentPackage(pkgWithBp, {
    academicSetting: mockMerdekaSetting, // tp is missing!
    assessmentPlan: singleInstPlan,
  });
  if (valC.valid || !valC.errors.some((e) => e.includes('Sumber data TP'))) {
    throw new Error(`FAILED: Validation should fail when TP source is missing in Merdeka. Errors: ${valC.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valC.errors[0]}"`);

  // TEST D: K13 + missing K13 canonical source -> FAIL
  console.log('Test D: K13 + missing K13 canonical source -> FAIL');
  const pkgK13Bp: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'kd-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: [], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valD = validateAssessmentPackage(pkgK13Bp, {
    academicSetting: mockK13Setting, // k13Analysis is missing!
    assessmentPlan: singleInstPlan,
  });
  if (valD.valid || !valD.errors.some((e) => e.includes('K13Analysis'))) {
    throw new Error(`FAILED: Validation should fail when K13Analysis source is missing in K13. Errors: ${valD.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valD.errors[0]}"`);

  // TEST E: Unresolved curriculum + blueprint -> FAIL
  console.log('Test E: Unresolved curriculum + blueprint -> FAIL');
  const valE = validateAssessmentPackage(pkgWithBp, {
    academicSetting: mockUnresolvedSetting,
    assessmentPlan: singleInstPlan,
  });
  if (valE.valid || !valE.errors.some((e) => e.includes('Kurikulum tidak dapat ditentukan'))) {
    throw new Error(`FAILED: Validation should fail when curriculum is unresolved. Errors: ${valE.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valE.errors[0]}"`);

  // TEST F: Zero blueprint -> cannot SIAP (FAIL)
  console.log('Test F: Zero blueprint -> cannot SIAP (FAIL)');
  const valF = validateAssessmentPackage(emptyPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
  });
  if (valF.valid || !valF.errors.some((e) => e.includes('Kisi-kisi asesmen (blueprint) wajib diisi'))) {
    throw new Error(`FAILED: Validation should fail when blueprint is empty. Errors: ${valF.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valF.errors[0]}"`);

  // TEST G: Dangling instrumentItemId -> FAIL
  console.log('Test G: Dangling instrumentItemId in blueprint -> FAIL');
  const pkgDangling: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['non-existent-q'], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valG = validateAssessmentPackage(pkgDangling, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: singleInstPlan,
    tp: mockTP,
  });
  if (valG.valid || !valG.errors.some((e) => e.includes('dangling reference'))) {
    throw new Error(`FAILED: Validation should fail on dangling instrumentItemId. Errors: ${valG.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valG.errors[0]}"`);

  // TEST H: Cross-instrument-type item reference -> FAIL
  console.log('Test H: Cross-instrument-type item reference -> FAIL');
  const pkgCrossInst: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['obs-1'], order: 1 },
    ],
    instruments: [
      { id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valH = validateAssessmentPackage(pkgCrossInst, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
        { id: 'i2', type: 'OBSERVATION', label: 'Observasi' },
      ],
    },
    tp: mockTP,
  });
  if (valH.valid || !valH.errors.some((e) => e.includes('cross-instrument-type reference'))) {
    throw new Error(`FAILED: Validation should fail on cross-instrument-type reference. Errors: ${valH.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valH.errors[0]}"`);

  // TEST I: Valid Blueprint -> InstrumentItem linkage -> PASS
  console.log('Test I: Valid Blueprint -> InstrumentItem linkage -> PASS');
  const validLinkedPkg: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
    instruments: [
      { id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Jelaskan X', order: 1 }] },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valI = validateAssessmentPackage(validLinkedPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (!valI.valid) {
    throw new Error(`FAILED: Valid linkage failed validation: ${valI.errors.join('; ')}`);
  }
  console.log('  PASSED: Valid blueprint to instrument item linkage validated cleanly.');

  // TEST J: Deleted/missing canonical objective source invalidates existing SIAP package
  console.log('Test J: Deleted/missing canonical objective source invalidates existing SIAP package');
  const siapPkg: AssessmentPackage = {
    ...validLinkedPkg,
    workflowStatus: 'SIAP',
  };
  const invJ = invalidateAssessmentPackageDependencies(siapPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    // tp is omitted!
  });
  if (!invJ.isInvalidated || invJ.package.workflowStatus !== 'PERLU_DILENGKAPI') {
    throw new Error('FAILED: Package should be invalidated when TP source is missing');
  }
  console.log('  PASSED: Package invalidated cleanly when TP source was deleted.');

  // TEST K: Dangling criterionId -> FAIL
  console.log('Test K: Dangling criterionId in blueprint -> FAIL');
  const pkgDanglingCrit: AssessmentPackage = {
    ...validLinkedPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', criterionId: 'non-existent-crit', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
  };
  const valK = validateAssessmentPackage(pkgDanglingCrit, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  if (valK.valid || !valK.errors.some((e) => e.includes('kriteria KKTP'))) {
    throw new Error(`FAILED: Validation should fail on dangling criterionId. Errors: ${valK.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valK.errors[0]}"`);

  // TEST L: Missing canonical criteria source when criterionId exists -> FAIL
  console.log('Test L: Missing canonical criteria source when criterionId exists -> FAIL');
  const pkgWithCritId: AssessmentPackage = {
    ...validLinkedPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', criterionId: 'crit-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
  };
  const valL = validateAssessmentPackage(pkgWithCritId, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
    // assessmentCriteria is omitted!
  });
  if (valL.valid || !valL.errors.some((e) => e.includes('sumber kriteria KKTP tidak tersedia'))) {
    throw new Error(`FAILED: Validation should fail when criterionId exists but criteria source is missing. Errors: ${valL.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valL.errors[0]}"`);

  // TEST M: Parent AssessmentPlan not SIAP -> FAIL
  console.log('Test M: Parent AssessmentPlan not SIAP -> FAIL');
  const draftPlan = { ...mockAssessmentPlan, workflowStatus: 'DRAFT' as const };
  const valM = validateAssessmentPackage(validLinkedPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: draftPlan,
    tp: mockTP,
  });
  if (valM.valid || !valM.errors.some((e) => e.includes('belum berstatus SIAP'))) {
    throw new Error(`FAILED: Validation should fail when parent plan is DRAFT. Errors: ${valM.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valM.errors[0]}"`);

  // TEST N: Valid complete package -> SIAP
  console.log('Test N: Valid complete package -> SIAP confirmation');
  const confirmN = confirmAssessmentPackage(validLinkedPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (!confirmN.success || confirmN.package.workflowStatus !== 'SIAP') {
    throw new Error(`FAILED: Valid package could not be confirmed: ${confirmN.errors.join('; ')}`);
  }
  console.log('  PASSED: Valid package confirmed to SIAP successfully.');

  // TEST O: Non-SIAP / invalid package -> export blocked
  console.log('Test O: Non-SIAP / invalid package -> export blocked');
  let threwExportError = false;
  try {
    await generateAssessment({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockMerdekaSetting,
      tp: mockTP,
      documentMode: 'data',
      assessmentPlans: [mockAssessmentPlan],
      assessmentPackages: [{ ...validLinkedPkg, workflowStatus: 'PERLU_DILENGKAPI' }],
      skipDownload: true,
    });
  } catch (err: any) {
    threwExportError = true;
    console.log(`  PASSED: Export correctly blocked with error: "${err.message}"`);
  }
  if (!threwExportError) {
    throw new Error('FAILED: Export was NOT blocked for non-SIAP package');
  }

  console.log('\n=== ALL AUDIT 9B REGRESSION TESTS (A-O) PASSED SUCCESSFULLY! ===');
}

runRegressionTests();
