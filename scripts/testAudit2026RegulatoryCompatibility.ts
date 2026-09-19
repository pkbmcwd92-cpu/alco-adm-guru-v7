import {
  validateLearningPlan,
  createEmptyLearningPlan,
  createAIDraftLearningPlan,
  migrateLegacyLearningPlan,
  LEARNING_EXPERIENCE_PHASE_LABELS,
  DEEP_LEARNING_PRINCIPLE_LABELS,
} from '../src/services/learningPlanService';
import { generateModulAjar } from '../src/services/documentEngine/generators/modulAjarGenerator';
import {
  LearningPlan,
  AcademicSetting,
  TPData,
  ATPData,
  SchoolData,
  TeacherProfile,
} from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('RUNNING REGULATORY COMPATIBILITY 2026 REGRESSION TEST');
console.log('====================================================\n');

const mockSchool: SchoolData = {
  id: 'school-1',
  name: 'SMA Negeri 1 Edukasi',
  npsn: '12345678',
  address: 'Jl. Pendidikan No. 1',
  village: 'Sukamaju',
  district: 'Cibadak',
  regency: 'Bandung',
  province: 'Jawa Barat',
  principalName: 'Kepala Sekolah, M.Pd',
  principalNip: '197501012000011001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockProfile: TeacherProfile = {
  id: 'prof-1',
  name: 'Guru Teladan, S.Kom',
  nip: '198501012010011001',
  status: 'PNS',
  defaultSubject: 'Informatika',
  defaultLevel: 'SMA',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSetting: AcademicSetting = {
  id: 'setting-2026',
  profileId: 'prof-1',
  subject: 'Informatika',
  level: 'SMA',
  grade: 'Kelas 10',
  phase: 'Fase E',
  semester: '1 (Ganjil)',
  academicYear: '2025/2026',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  updatedAt: new Date().toISOString(),
};

const mockTP: TPData = {
  id: 'tpdata-2026',
  academicSettingId: 'setting-2026',
  items: [
    {
      id: 'tp-inf-01',
      code: 'TP-10.1',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
      contentScope: 'Algoritma dan Pemrograman',
      competence: 'Memahami konsep',
      order: 1,
    },
    {
      id: 'tp-inf-02',
      code: 'TP-10.2',
      statement: 'Menerapkan struktur kontrol percabangan dan perulangan dalam kode program.',
      contentScope: 'Struktur Kontrol',
      competence: 'Menerapkan struktur',
      order: 2,
    },
  ],
  updatedAt: new Date().toISOString(),
};

const mockATP: ATPData = {
  id: 'atpdata-2026',
  academicSettingId: 'setting-2026',
  items: [
    {
      id: 'atp-inf-01',
      tpId: 'tp-inf-01',
      stepNumber: 1,
      materialScope: 'Algoritma dan Pemrograman',
      jp: 4,
    },
  ],
  updatedAt: new Date().toISOString(),
};

// ----------------------------------------------------
// 1. TERMINOLOGY CONSTANTS
// ----------------------------------------------------
console.log('1. Testing Terminology & Display Constants');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.UNDERSTAND === 'Memahami', 'UNDERSTAND mapped to Memahami');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.APPLY === 'Mengaplikasi', 'APPLY mapped to Mengaplikasi');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.REFLECT === 'Merefleksi', 'REFLECT mapped to Merefleksi');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.MINDFUL === 'Berkesadaran', 'MINDFUL mapped to Berkesadaran');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.MEANINGFUL === 'Bermakna', 'MEANINGFUL mapped to Bermakna');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.JOYFUL === 'Menggembirakan', 'JOYFUL mapped to Menggembirakan');

// ----------------------------------------------------
// 2. VALIDATOR - CANONICAL LEARNING EXPERIENCES
// ----------------------------------------------------
console.log('\n2. Testing validateLearningPlan with Canonical 2026 Learning Experiences');

const planWithExperiences: LearningPlan = {
  id: 'plan-2026-01',
  academicSettingId: 'setting-2026',
  curriculumType: 'KURIKULUM_MERDEKA',
  sourceType: 'MANUAL',
  status: 'DRAFT',
  tpIds: ['tp-inf-01'],
  atpItemIds: ['atp-inf-01'],
  objectives: [
    {
      id: 'tp-inf-01',
      tpId: 'tp-inf-01',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
    },
  ],
  learningExperiences: [
    {
      id: 'exp-01',
      phase: 'UNDERSTAND',
      description: 'Murid menyimak penjelasan analogi algoritma dalam kehidupan sehari-hari.',
      durationMinutes: 20,
    },
    {
      id: 'exp-02',
      phase: 'APPLY',
      description: 'Murid menyusun diagram alir (flowchart) untuk solusi permasalahan sederhana.',
      durationMinutes: 45,
    },
    {
      id: 'exp-03',
      phase: 'REFLECT',
      description: 'Murid merefleksikan hambatan yang dialami saat menyusun logika algoritma.',
      durationMinutes: 15,
    },
  ],
  assessmentPlan: {
    formative: [
      {
        id: 'asm-01',
        type: 'FORMATIVE',
        linkedTpIds: ['tp-inf-01'],
        description: 'Observasi rubrik penyusunan flowchart.',
      },
    ],
  },
  graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri'],
  deepLearningContext: {
    principles: ['MINDFUL', 'MEANINGFUL', 'JOYFUL'],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const res1 = validateLearningPlan(planWithExperiences, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res1.valid === true, 'Plan with 2026 canonical LearningExperiences is valid without legacy core steps');
assert(res1.errors.length === 0, 'No errors in valid 2026 canonical plan');

// ----------------------------------------------------
// 3. VALIDATOR - REJECT INVALID EXPERIENCES
// ----------------------------------------------------
console.log('\n3. Testing validateLearningPlan Error Handling for Malformed Experiences');

const malformedExpPlan: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-malformed-exp',
  learningExperiences: [
    {
      id: '',
      phase: 'UNDERSTAND',
      description: 'Kegiatan A',
    },
    {
      id: 'exp-dup',
      phase: 'INVALID_PHASE' as any,
      description: '',
    },
    {
      id: 'exp-dup',
      phase: 'APPLY',
      description: 'Deskripsi valid',
      linkedTpIds: ['tp-non-existent'],
    },
  ],
};

const res2 = validateLearningPlan(malformedExpPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res2.valid === false, 'Validator rejects plan with malformed experiences');
assert(res2.errors.some((e) => e.includes('ID kosong')), 'Detects empty experience ID');
assert(res2.errors.some((e) => e.includes('duplikasi ID')), 'Detects duplicate experience ID');
assert(res2.errors.some((e) => e.includes('fase tidak sah')), 'Detects invalid experience phase');
assert(res2.errors.some((e) => e.includes('deskripsi kosong')), 'Detects empty experience description');
assert(res2.errors.some((e) => e.includes('dangling TP reference')), 'Detects dangling TP reference in experience');

// ----------------------------------------------------
// 4. VALIDATOR - DEEP LEARNING CONTEXT & DUPLICATE DIMENSIONS
// ----------------------------------------------------
console.log('\n4. Testing validateLearningPlan Deep Learning Context & Graduate Profile Dimensions');

const invalidContextPlan: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-invalid-dl',
  deepLearningContext: {
    principles: ['MINDFUL', 'MINDFUL', 'UNKNOWN_PRINCIPLE' as any],
  },
  graduateProfileDimensions: ['Mandiri', 'Mandiri'],
};

const res3 = validateLearningPlan(invalidContextPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res3.errors.some((e) => e.includes('Prinsip Pembelajaran Mendalam')), 'Detects invalid deep learning principle');
assert(res3.errors.some((e) => e.includes('duplikasi nilai pada prinsip')), 'Detects duplicate deep learning principles');
assert(res3.warnings.some((w) => w.includes('duplikasi nilai pada Dimensi Profil Lulusan')), 'Warns on duplicate graduate profile dimensions');

// ----------------------------------------------------
// 5. VALIDATOR - LEGACY BACKWARD COMPATIBILITY
// ----------------------------------------------------
console.log('\n5. Testing Legacy Backward Compatibility');

const legacyPlan: LearningPlan = {
  id: 'plan-legacy-01',
  academicSettingId: 'setting-2026',
  curriculumType: 'KURIKULUM_MERDEKA',
  sourceType: 'MANUAL',
  status: 'DRAFT',
  tpIds: ['tp-inf-01'],
  atpItemIds: ['atp-inf-01'],
  objectives: [
    {
      id: 'tp-inf-01',
      tpId: 'tp-inf-01',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
    },
  ],
  learningSteps: {
    opening: [{ id: 's1', description: 'Guru membuka kelas dengan salam.' }],
    core: [{ id: 's2', description: 'Siswa mempraktikkan pseudocode.' }],
    closing: [{ id: 's3', description: 'Guru memberikan umpan balik.' }],
  },
  assessmentPlan: {
    formative: [{ id: 'a1', type: 'FORMATIVE', description: 'Latihan mandiri', linkedTpIds: ['tp-inf-01'] }],
  },
  p3Dimensions: ['Bernalar Kritis'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const res4 = validateLearningPlan(legacyPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res4.valid === true, 'Legacy plan with learningSteps and p3Dimensions is valid');
assert(res4.errors.length === 0, 'Legacy plan has no validation errors');

// Empty activity check
const emptyActivityPlan: LearningPlan = {
  ...legacyPlan,
  id: 'plan-empty-act',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [],
};
const res5 = validateLearningPlan(emptyActivityPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res5.valid === false, 'Rejects plan when neither experiences nor legacy steps exist');
assert(res5.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Appropriate error message for empty learning activity');

// ----------------------------------------------------
// 6. FACTORY FUNCTIONS (createEmptyLearningPlan & createAIDraftLearningPlan)
// ----------------------------------------------------
console.log('\n6. Testing Factory Functions (No Auto-Fabrication)');

const emptyPlan = createEmptyLearningPlan({
  academicSetting: mockSetting,
  curriculumType: 'KURIKULUM_MERDEKA',
  tpIds: ['tp-inf-01'],
  context: { tp: mockTP },
});
assert(emptyPlan.sourceType === 'MANUAL', 'createEmptyLearningPlan sets sourceType MANUAL');
assert(emptyPlan.status === 'DRAFT', 'createEmptyLearningPlan sets status DRAFT');
assert(Array.isArray(emptyPlan.learningExperiences) && emptyPlan.learningExperiences.length === 0, 'learningExperiences is empty array');
assert(emptyPlan.deepLearningContext === undefined, 'deepLearningContext is not fabricated');
assert(emptyPlan.graduateProfileDimensions === undefined, 'graduateProfileDimensions is not fabricated');

const aiDraftPlan = createAIDraftLearningPlan({
  academicSetting: mockSetting,
  curriculumType: 'KURIKULUM_MERDEKA',
  tpIds: ['tp-inf-01'],
  aiDraft: {
    learningExperiences: [
      { id: 'ai-exp-1', phase: 'UNDERSTAND', description: 'Memahami konsep' },
    ],
    deepLearningContext: { principles: ['MINDFUL'] },
    graduateProfileDimensions: ['Mandiri'],
  },
  context: { tp: mockTP },
});
assert(aiDraftPlan.sourceType === 'AI_DRAFT', 'createAIDraftLearningPlan sets sourceType AI_DRAFT');
assert(aiDraftPlan.status === 'DRAFT', 'createAIDraftLearningPlan sets status DRAFT');
assert(aiDraftPlan.learningExperiences?.length === 1, 'Preserves provided experiences in AI draft');
assert(aiDraftPlan.deepLearningContext?.principles?.[0] === 'MINDFUL', 'Preserves provided deepLearningContext in AI draft');
assert(aiDraftPlan.graduateProfileDimensions?.[0] === 'Mandiri', 'Preserves provided graduateProfileDimensions in AI draft');

// ----------------------------------------------------
// 7. MIGRATION (migrateLegacyLearningPlan)
// ----------------------------------------------------
console.log('\n7. Testing migrateLegacyLearningPlan');

const legacyRaw = {
  id: 'old-plan-1',
  objectives: ['Tujuan legacy 1'],
  learningSteps: [
    { id: 'step-1', stepName: 'Kegiatan Pendahuluan', description: 'Apersepsi' },
    { id: 'step-2', stepName: 'Kegiatan Inti', description: 'Eksplorasi' },
  ],
  assessmentPlan: [{ type: 'FORMATIVE', instrument: 'Rubrik' }],
  p3Dimensions: ['Gotong Royong'],
};

const migrated = migrateLegacyLearningPlan(legacyRaw, 'setting-2026');
assert(migrated.sourceType === 'MIGRATED', 'Migrated plan has sourceType MIGRATED');
assert(migrated.status === 'DRAFT', 'Migrated plan has status DRAFT');
assert(migrated.learningSteps.opening?.length === 1, 'Preserves legacy opening step');
assert(migrated.learningSteps.core?.length === 1, 'Preserves legacy core step');
assert(migrated.learningExperiences === undefined, 'Does NOT fabricate canonical learningExperiences from legacy steps');
assert(migrated.graduateProfileDimensions === undefined, 'Does NOT fabricate graduateProfileDimensions from p3Dimensions');
assert(migrated.p3Dimensions?.[0] === 'Gotong Royong', 'Preserves legacy p3Dimensions');

// ----------------------------------------------------
// 8. DOCUMENT GENERATOR (generateModulAjar)
// ----------------------------------------------------
console.log('\n8. Testing Document Generator (generateModulAjar)');

async function runDocGenTests() {
  const ready2026Plan: LearningPlan = {
    ...planWithExperiences,
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
  };

  const docResult = await generateModulAjar({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockSetting,
    tp: mockTP,
    atp: mockATP,
    learningPlans: [ready2026Plan],
    activeLearningPlanId: ready2026Plan.id,
    documentMode: 'blank', // Use blank mode to test doc children generation without requiring full SIAP validation chain
    skipDownload: true,
  });

  assert(docResult.fileName.includes('Modul_Ajar') || docResult.title.includes('MODUL AJAR'), 'generateModulAjar returns valid document metadata');
  assert(docResult.success === true, 'generateModulAjar produces successful result');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('ALL REGULATORY COMPATIBILITY 2026 REGRESSION TESTS PASSED!');
  }
}

runDocGenTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

