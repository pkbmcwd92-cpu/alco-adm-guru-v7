import {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentPlan,
  K13Analysis,
  TPData,
} from '../src/types';
import {
  resolveAssessmentGenerationSpec,
  getExplicitCurriculum,
} from '../src/services/assessmentGenerationSpecService';
import {
  resolveGrade,
  resolvePhaseForGrade,
  resolveAKMProgression,
  getGradeCalibrationProfile,
  createAssessmentGenerationProfile,
} from '../src/services/assessmentGenerationProfileService';
import { resolveSubjectAssessmentProfile } from '../src/services/subjectAssessmentProfileService';
import { mapObjectiveToEvidence } from '../src/services/assessmentEvidenceMapperService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) {
      console.error(`         Detail: ${detail}`);
    }
    failed++;
  }
}

async function runRegressionSuite() {
  console.log('=== STARTING AUDIT 9C.2 GENERATION SPEC REGRESSION TEST SUITE ===\n');

  // Baseline Mock Contexts
  const mockAcademicSettingSD4: AcademicSetting = {
    id: 'setting-sd-4',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'Matematika',
    updatedAt: new Date().toISOString(),
  };

  const mockTPMat: TPData = {
    id: 'tp-data-mat',
    academicSettingId: 'setting-sd-4',
    items: [
      {
        id: 'tp-mat-1',
        code: 'TP-M1',
        tp: 'Memahami konsep pecahan senilai dan desimal dasar',
        order: 1,
      } as any,
      {
        id: 'tp-mat-2',
        code: 'TP-M2',
        tp: 'Menghitung operasi pembagian dan perkalian bilangan cacah',
        order: 2,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockPlanMatSiap: AssessmentPlan = {
    id: 'plan-mat-1',
    academicSettingId: 'setting-sd-4',
    title: 'Penilaian Sumatif Matematika Bab 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-mat-1'],
    criterionIds: ['crit-mat-1'],
    instruments: [
      {
        id: 'inst-mat-1',
        type: 'WRITTEN_TEST',
      },
    ],
    workflowStatus: 'SIAP',
    revision: 1,
    provenance: {
      generatedBy: 'USER',
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockCriteriaMat: AssessmentCriterion[] = [
    {
      id: 'crit-mat-1',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-mat-1',
      description: 'Peserta didik mampu mengidentifikasi pecahan senilai',
      approach: 'deskripsi',
      indicators: ['Menyebutkan contoh pecahan senilai'],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  // ==========================================
  // TEST A: AssessmentPlan SIAP + valid context -> RESOLVED
  // ==========================================
  const specA = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specA.resolution.status === 'RESOLVED' && specA.resolution.issues.length === 0,
    'Case A: AssessmentPlan SIAP + valid TP and Criteria resolves to RESOLVED',
    `status=${specA.resolution.status}, issues=${JSON.stringify(specA.resolution.issues)}`
  );

  // ==========================================
  // TEST B: AssessmentPlan DRAFT -> BLOCKED
  // ==========================================
  const planDraft: AssessmentPlan = { ...mockPlanMatSiap, workflowStatus: 'DRAFT' };
  const specB = resolveAssessmentGenerationSpec({
    assessmentPlan: planDraft,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specB.resolution.status === 'BLOCKED' &&
      specB.resolution.issues.some((i) => i.code === 'ASSESSMENT_PLAN_NOT_READY'),
    'Case B: AssessmentPlan in DRAFT status is BLOCKED with ASSESSMENT_PLAN_NOT_READY'
  );

  // ==========================================
  // TEST C: AssessmentPlan PERLU_DILENGKAPI -> BLOCKED
  // ==========================================
  const planPerlu: AssessmentPlan = { ...mockPlanMatSiap, workflowStatus: 'PERLU_DILENGKAPI' };
  const specC = resolveAssessmentGenerationSpec({
    assessmentPlan: planPerlu,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specC.resolution.status === 'BLOCKED' &&
      specC.resolution.issues.some((i) => i.code === 'ASSESSMENT_PLAN_NOT_READY'),
    'Case C: AssessmentPlan in PERLU_DILENGKAPI status is BLOCKED'
  );

  // ==========================================
  // TEST D: Curriculum unresolved -> BLOCKED
  // ==========================================
  const settingUnresolvedCurriculum: AcademicSetting = {
    ...mockAcademicSettingSD4,
    curriculum: '',
    curriculumType: undefined,
  };
  const specD = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingUnresolvedCurriculum,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specD.resolution.status === 'BLOCKED' &&
      specD.resolution.issues.some((i) => i.code === 'CURRICULUM_UNRESOLVED'),
    'Case D: Unresolved curriculum is fail-closed and returns BLOCKED with CURRICULUM_UNRESOLVED'
  );

  // ==========================================
  // TEST E: Grade unresolved -> BLOCKED
  // ==========================================
  const settingInvalidGrade: AcademicSetting = {
    ...mockAcademicSettingSD4,
    grade: 'TK-A', // Tidak ada digit atau bukan kelas 1-12
  };
  const specE = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingInvalidGrade,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specE.resolution.status === 'BLOCKED' &&
      specE.resolution.issues.some((i) => i.code === 'GRADE_UNRESOLVED'),
    'Case E: Unresolved grade (no numeric 1-12) is BLOCKED with GRADE_UNRESOLVED'
  );

  // ==========================================
  // TEST F: Subject unresolved -> BLOCKED
  // ==========================================
  const settingInvalidSubject: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: '',
  };
  const specF = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingInvalidSubject,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specF.resolution.status === 'BLOCKED' &&
      specF.resolution.issues.some((i) => i.code === 'SUBJECT_UNRESOLVED'),
    'Case F: Unresolved or empty subject is BLOCKED with SUBJECT_UNRESOLVED'
  );

  // ==========================================
  // TEST G: TP tidak ditemukan (dangling tpId) -> BLOCKED
  // ==========================================
  const planDanglingTP: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['tp-ghost-not-found'],
  };
  const specG = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingTP,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specG.resolution.status === 'BLOCKED' &&
      specG.resolution.issues.some((i) => i.code === 'DANGLING_OBJECTIVE_REF'),
    'Case G: Dangling tpId in AssessmentPlan returns BLOCKED with DANGLING_OBJECTIVE_REF'
  );

  // ==========================================
  // TEST H: KD tidak ditemukan (dangling kdId) pada K13 -> BLOCKED
  // ==========================================
  const mockK13Setting: AcademicSetting = {
    ...mockAcademicSettingSD4,
    curriculum: 'Kurikulum 2013',
    curriculumType: 'K13',
  };
  const mockK13Analysis: K13Analysis = {
    id: 'k13-1',
    academicSettingId: mockK13Setting.id,
    items: [
      {
        id: 'kd-3.1',
        kdCode: '3.1',
        kdText: 'Memahami teks laporan hasil observasi',
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planDanglingKD: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['kd-ghost-99'],
  };
  const specH = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingKD,
    academicSetting: mockK13Setting,
    k13Analysis: mockK13Analysis,
  });
  assert(
    specH.resolution.status === 'BLOCKED' &&
      specH.resolution.issues.some((i) => i.code === 'DANGLING_OBJECTIVE_REF'),
    'Case H: Dangling kdId in K13 plan returns BLOCKED with DANGLING_OBJECTIVE_REF'
  );

  // ==========================================
  // TEST I: KKTP criterion dangling -> BLOCKED
  // ==========================================
  const planDanglingCrit: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: ['crit-ghost-999'],
  };
  const specI = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingCrit,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specI.resolution.status === 'BLOCKED' &&
      specI.resolution.issues.some((i) => i.code === 'DANGLING_CRITERION_REF'),
    'Case I: Dangling criterionId returns BLOCKED with DANGLING_CRITERION_REF'
  );

  // ==========================================
  // TEST J: KKTP criterion milik TP lain -> BLOCKED
  // ==========================================
  const criteriaBelongsToOtherTP: AssessmentCriterion[] = [
    {
      id: 'crit-other-tp',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-other-foreign-tp', // Tidak ada di planMatSiap.tpIds
      description: 'Kriteria milik TP lain',
      approach: 'rubrik',
      indicators: [],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];
  const planOtherCrit: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: ['crit-other-tp'],
  };
  const specJ = resolveAssessmentGenerationSpec({
    assessmentPlan: planOtherCrit,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: criteriaBelongsToOtherTP,
  });
  assert(
    specJ.resolution.status === 'BLOCKED' &&
      specJ.resolution.issues.some((i) => i.code === 'CRITERION_OBJECTIVE_MISMATCH'),
    'Case J: Criterion belonging to a different TP returns BLOCKED with CRITERION_OBJECTIVE_MISMATCH'
  );

  // ==========================================
  // TEST K: Missing criterion saat canonical optional -> tidak blocked
  // ==========================================
  const planNoCriteria: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: [], // Guru tidak mencantumkan criterion khusus
  };
  const specK = resolveAssessmentGenerationSpec({
    assessmentPlan: planNoCriteria,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: [],
  });
  assert(
    specK.resolution.status === 'RESOLVED',
    'Case K: Optional criterion omission does NOT block resolution'
  );

  // ==========================================
  // TEST L: Planned instrument kosong -> BLOCKED
  // ==========================================
  const planNoInstruments: AssessmentPlan = {
    ...mockPlanMatSiap,
    instruments: [],
  };
  const specL = resolveAssessmentGenerationSpec({
    assessmentPlan: planNoInstruments,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specL.resolution.status === 'BLOCKED' &&
      specL.resolution.issues.some((i) => i.code === 'PLANNED_INSTRUMENT_EMPTY'),
    'Case L: AssessmentPlan without planned instruments is BLOCKED with PLANNED_INSTRUMENT_EMPTY'
  );

  // ==========================================
  // TEST M: Recommendation mismatch dengan AssessmentPlan -> NEEDS_REVIEW, plan tidak termutasi
  // ==========================================
  // Contoh: TP PJOK motorik direkomendasikan PERFORMANCE, tapi di plan guru memasang WRITTEN_TEST
  const settingPJOK: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  };
  const tpPjokMotorik: TPData = {
    id: 'tp-pjok',
    academicSettingId: settingPJOK.id,
    items: [
      {
        id: 'tp-p-1',
        code: 'TP-PJOK-1',
        tp: 'Mempraktikkan variasi gerak dasar lokomotor dan manipulatif menendang bola',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planPjokMismatch: AssessmentPlan = {
    id: 'plan-pjok-mismatch',
    academicSettingId: settingPJOK.id,
    title: 'Penilaian PJOK Motorik',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-p-1'],
    criterionIds: [],
    instruments: [
      {
        id: 'inst-pjok-1',
        type: 'WRITTEN_TEST', // Mismatch dengan rekomendasi psikomotor PJOK
      },
    ],
    workflowStatus: 'SIAP',
    revision: 1,
    provenance: { generatedBy: 'USER', generatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialPlanSnapshot = JSON.stringify(planPjokMismatch);
  const specM = resolveAssessmentGenerationSpec({
    assessmentPlan: planPjokMismatch,
    academicSetting: settingPJOK,
    tp: tpPjokMotorik,
  });

  assert(
    specM.resolution.status === 'NEEDS_REVIEW' &&
      specM.resolution.issues.some((i) => i.code === 'INSTRUMENT_RECOMMENDATION_MISMATCH') &&
      JSON.stringify(planPjokMismatch) === initialPlanSnapshot &&
      specM.plannedInstrumentTypes.includes('WRITTEN_TEST'),
    'Case M: Instrument recommendation mismatch triggers NEEDS_REVIEW and preserves original plan without mutation'
  );

  // ==========================================
  // TEST N: Mapel spesifik PJOK: TP motorik merekomendasikan PERFORMANCE / OBSERVATION
  // ==========================================
  const pjokProfile = resolveSubjectAssessmentProfile('PJOK');
  const recMotor = mapObjectiveToEvidence({
    objective: { id: 'tp-1', sourceType: 'TP', text: 'Mempraktikkan variasi gerak dasar senam lantai', criterionIds: [] },
    subjectProfile: pjokProfile,
  });
  assert(
    recMotor.evidenceTypes.includes('PERFORMANCE') &&
      recMotor.recommendedInstrumentTypes.includes('PERFORMANCE'),
    'Case N: PJOK psychomotor competence recommends PERFORMANCE / OBSERVATION'
  );

  // ==========================================
  // TEST O: Mapel spesifik PJOK: TP pemahaman aturan merekomendasikan WRITTEN_TEST / ORAL_TEST
  // ==========================================
  const recKnowledge = mapObjectiveToEvidence({
    objective: { id: 'tp-2', sourceType: 'TP', text: 'Menjelaskan peraturan permainan bola voli dan prosedur keselamatan', criterionIds: [] },
    subjectProfile: pjokProfile,
  });
  assert(
    recKnowledge.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recKnowledge.recommendedInstrumentTypes.includes('WRITTEN_TEST'),
    'Case O: PJOK rules knowledge competence recommends WRITTEN_TEST / ORAL_TEST (does not force performance)'
  );

  // ==========================================
  // TEST P: Mapel spesifik Bahasa Indonesia: 4 domain
  // ==========================================
  const bindoProfile = resolveSubjectAssessmentProfile('Bahasa Indonesia');
  const recMembaca = mapObjectiveToEvidence({
    objective: { id: 'b-1', sourceType: 'TP', text: 'Membaca dan menemukan informasi tersurat dan tersirat dalam teks narasi', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recMenulis = mapObjectiveToEvidence({
    objective: { id: 'b-2', sourceType: 'TP', text: 'Menulis teks deskripsi dengan struktur paragraf yang koheren', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recBicara = mapObjectiveToEvidence({
    objective: { id: 'b-3', sourceType: 'TP', text: 'Berbicara dan mempresentasikan gagasan dalam diskusi kelompok', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recSimak = mapObjectiveToEvidence({
    objective: { id: 'b-4', sourceType: 'TP', text: 'Menyimak rekaman dongeng dan mendengarkan instruksi guru', criterionIds: [] },
    subjectProfile: bindoProfile,
  });

  assert(
    recMembaca.recommendedInstrumentTypes.includes('WRITTEN_TEST') &&
      recMenulis.recommendedInstrumentTypes.includes('PRODUCT') &&
      recBicara.recommendedInstrumentTypes.includes('ORAL_TEST') &&
      recSimak.evidenceTypes.includes('ORAL_RESPONSE'),
    'Case P: Bahasa Indonesia correctly differentiates reading, writing, speaking, and listening competencies'
  );

  // ==========================================
  // TEST Q: Mapel spesifik Matematika: konsep vs prosedur vs penalaran vs problem solving
  // ==========================================
  const matProfile = resolveSubjectAssessmentProfile('Matematika');
  const recMatKonsep = mapObjectiveToEvidence({
    objective: { id: 'm-1', sourceType: 'TP', text: 'Memahami konsep pecahan senilai dan sifat bangun datar', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatProsedur = mapObjectiveToEvidence({
    objective: { id: 'm-2', sourceType: 'TP', text: 'Menghitung operasi hitung pembagian pecahan campuran', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatNalar = mapObjectiveToEvidence({
    objective: { id: 'm-3', sourceType: 'TP', text: 'Menjelaskan alasan dan membuktikan kebenaran sifat segitiga sama sisi', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatProblem = mapObjectiveToEvidence({
    objective: { id: 'm-4', sourceType: 'TP', text: 'Memecahkan masalah kontekstual dan soal cerita transaksi jual beli', criterionIds: [] },
    subjectProfile: matProfile,
  });

  assert(
    recMatKonsep.recommendedInstrumentTypes.includes('WRITTEN_TEST') &&
      recMatProsedur.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recMatNalar.evidenceTypes.includes('REASONING') &&
      recMatProblem.evidenceTypes.includes('REASONING'),
    'Case Q: Matematika correctly identifies conceptual, procedural, reasoning, and problem solving'
  );

  // ==========================================
  // TEST R: Mapel spesifik IPA/IPAS: inkuiri vs eksplanasi kausal vs observasi
  // ==========================================
  const ipasProfile = resolveSubjectAssessmentProfile('IPAS');
  const recIpasInkuiri = mapObjectiveToEvidence({
    objective: { id: 'i-1', sourceType: 'TP', text: 'Melakukan percobaan menyelidiki perpindahan kalor secara konduksi', criterionIds: [] },
    subjectProfile: ipasProfile,
  });
  const recIpasKausal = mapObjectiveToEvidence({
    objective: { id: 'i-2', sourceType: 'TP', text: 'Menjelaskan hubungan sebab akibat terjadinya siklus air dan hujan', criterionIds: [] },
    subjectProfile: ipasProfile,
  });
  const recIpasObs = mapObjectiveToEvidence({
    objective: { id: 'i-3', sourceType: 'TP', text: 'Mengamati dan mengidentifikasi bagian tubuh serangga di lingkungan sekitar', criterionIds: [] },
    subjectProfile: ipasProfile,
  });

  assert(
    recIpasInkuiri.recommendedInstrumentTypes.includes('PERFORMANCE') &&
      recIpasKausal.evidenceTypes.includes('REASONING') &&
      recIpasObs.evidenceTypes.includes('OBSERVATION'),
    'Case R: IPA/IPAS differentiates scientific inquiry, causal reasoning, and phenomenon observation'
  );

  // ==========================================
  // TEST S: Mapel spesifik Pendidikan Pancasila: nilai vs studi kasus vs refleksi vs gotong royong
  // ==========================================
  const pknProfile = resolveSubjectAssessmentProfile('Pendidikan Pancasila');
  const recPknNilai = mapObjectiveToEvidence({
    objective: { id: 'pk-1', sourceType: 'TP', text: 'Memahami makna sila pertama dan norma hukum di lingkungan sekitar', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknKasus = mapObjectiveToEvidence({
    objective: { id: 'pk-2', sourceType: 'TP', text: 'Menganalisis studi kasus sikap toleransi antarumat beragama', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknRefleksi = mapObjectiveToEvidence({
    objective: { id: 'pk-3', sourceType: 'TP', text: 'Merefleksikan komitmen pribadi dalam menjalankan kewajiban sebagai warga', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknGotongRoyong = mapObjectiveToEvidence({
    objective: { id: 'pk-4', sourceType: 'TP', text: 'Mempraktikkan kerja sama gotong royong membersihkan kelas', criterionIds: [] },
    subjectProfile: pknProfile,
  });

  assert(
    recPknNilai.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recPknKasus.evidenceTypes.includes('REASONING') &&
      recPknRefleksi.recommendedInstrumentTypes.includes('SELF_ASSESSMENT') &&
      recPknGotongRoyong.evidenceTypes.includes('PERFORMANCE'),
    'Case S: Pendidikan Pancasila differentiates civic knowledge, case analysis, self reflection, and collaborative action'
  );

  // ==========================================
  // TEST T: Mapel non-MVP (misal Seni Musik / Bahasa Inggris) -> GENERIC + NEEDS_REVIEW
  // ==========================================
  const settingSeniMusik: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: 'Seni Musik',
  };
  const tpSeniMusik: TPData = {
    id: 'tp-seni',
    academicSettingId: settingSeniMusik.id,
    items: [
      {
        id: 'tp-s-1',
        code: 'TP-SM-1',
        tp: 'Menyanyikan lagu daerah dengan intonasi yang tepat',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planSeni: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['tp-s-1'],
    criterionIds: [],
    instruments: [{ id: 'inst-seni-1', type: 'PERFORMANCE' }],
  };
  const specT = resolveAssessmentGenerationSpec({
    assessmentPlan: planSeni,
    academicSetting: settingSeniMusik,
    tp: tpSeniMusik,
  });
  assert(
    specT.subjectProfile.profileStatus === 'GENERIC' &&
      specT.resolution.status === 'NEEDS_REVIEW' &&
      specT.resolution.issues.some((i) => i.code === 'GENERIC_SUBJECT_PROFILE'),
    'Case T: Non-MVP subject (Seni Musik) resolves to GENERIC profile with NEEDS_REVIEW'
  );

  // ==========================================
  // TEST U: Phase ter-resolve konsisten dengan grade (1-12)
  // ==========================================
  assert(
    resolvePhaseForGrade(1) === 'Fase A' &&
      resolvePhaseForGrade(2) === 'Fase A' &&
      resolvePhaseForGrade(3) === 'Fase B' &&
      resolvePhaseForGrade(4) === 'Fase B' &&
      resolvePhaseForGrade(5) === 'Fase C' &&
      resolvePhaseForGrade(6) === 'Fase C' &&
      resolvePhaseForGrade(7) === 'Fase D' &&
      resolvePhaseForGrade(8) === 'Fase D' &&
      resolvePhaseForGrade(9) === 'Fase D' &&
      resolvePhaseForGrade(10) === 'Fase E' &&
      resolvePhaseForGrade(11) === 'Fase F' &&
      resolvePhaseForGrade(12) === 'Fase F',
    'Case U: Grades 1-12 map cleanly to official phases (A-F)'
  );

  // ==========================================
  // TEST V: Phase grade invalid -> undefined
  // ==========================================
  assert(
    resolvePhaseForGrade(0) === undefined &&
      resolvePhaseForGrade(13) === undefined &&
      resolvePhaseForGrade(-1) === undefined,
    'Case V: Grades outside 1-12 resolve phase to undefined'
  );

  // ==========================================
  // TEST W s/d AB: AKM progression level 1-6
  // ==========================================
  assert(resolveAKMProgression(1)?.level === 1 && resolveAKMProgression(2)?.level === 1, 'Case W: Grade 1-2 -> AKM Level 1');
  assert(resolveAKMProgression(3)?.level === 2 && resolveAKMProgression(4)?.level === 2, 'Case X: Grade 3-4 -> AKM Level 2');
  assert(resolveAKMProgression(5)?.level === 3 && resolveAKMProgression(6)?.level === 3, 'Case Y: Grade 5-6 -> AKM Level 3');
  assert(resolveAKMProgression(7)?.level === 4 && resolveAKMProgression(8)?.level === 4, 'Case Z: Grade 7-8 -> AKM Level 4');
  assert(resolveAKMProgression(9)?.level === 5 && resolveAKMProgression(10)?.level === 5, 'Case AA: Grade 9-10 -> AKM Level 5');
  assert(resolveAKMProgression(11)?.level === 6 && resolveAKMProgression(12)?.level === 6, 'Case AB: Grade 11-12 -> AKM Level 6');

  // ==========================================
  // TEST AC: AKM progression tidak menentukan cognitive demand / difficulty / item count
  // ==========================================
  const akmProg = resolveAKMProgression(4);
  assert(
    akmProg !== undefined &&
      (akmProg as any).difficulty === undefined &&
      (akmProg as any).cognitiveDemand === undefined &&
      (akmProg as any).itemCount === undefined &&
      (akmProg as any).passingScore === undefined,
    'Case AC: AKM progression is purely an OFFICIAL_REFERENCE framework and does not set difficulty, demand, or item counts'
  );

  // ==========================================
  // TEST AD: Grade calibration profile: grade 1-2 -> reading VERY_LOW, single step
  // ==========================================
  const calibG1 = getGradeCalibrationProfile(1);
  assert(
    calibG1.readingLoad === 'VERY_LOW' &&
      calibG1.instructionLoad === 'SINGLE_STEP_PREFERRED' &&
      calibG1.abstractionLevel === 'CONCRETE' &&
      calibG1.visualSupport === 'STRONGLY_CONSIDER',
    'Case AD: Grade 1 calibration sets VERY_LOW reading load and SINGLE_STEP_PREFERRED'
  );

  // ==========================================
  // TEST AE: Grade calibration profile: grade 10-12 -> reading HIGH, multi step
  // ==========================================
  const calibG11 = getGradeCalibrationProfile(11);
  assert(
    calibG11.readingLoad === 'HIGH' &&
      calibG11.instructionLoad === 'MULTI_STEP_ALLOWED' &&
      calibG11.abstractionLevel === 'ABSTRACT_ALLOWED',
    'Case AE: Grade 11 calibration sets HIGH reading load and MULTI_STEP_ALLOWED'
  );

  // ==========================================
  // TEST AF: Provenance eksplisit untuk semua profile/rule
  // ==========================================
  const genProfile = createAssessmentGenerationProfile(4);
  const provValid =
    genProfile.provenance.length > 0 &&
    genProfile.provenance.every((p) => p.id && p.sourceType && p.description) &&
    pjokProfile.recommendationRules.every((r) => r.provenance && r.provenance.sourceType);
  assert(
    provValid,
    'Case AF: Explicit provenance exists on generation profiles, calibrations, and recommendation rules'
  );

  // ==========================================
  // TEST AG: Ambiguous competency -> confidence: NEEDS_TEACHER_REVIEW
  // ==========================================
  const recAmbiguous = mapObjectiveToEvidence({
    objective: { id: 'tp-random', sourceType: 'TP', text: '123456 qwerty zzz tanpa kata kunci kompetensi', criterionIds: [] },
    subjectProfile: matProfile,
  });
  assert(
    recAmbiguous.confidence === 'NEEDS_TEACHER_REVIEW' &&
      recAmbiguous.rationaleCode === 'COMPETENCY_AMBIGUOUS',
    'Case AG: Unmatched/ambiguous competency text sets confidence to NEEDS_TEACHER_REVIEW'
  );

  // ==========================================
  // TEST AH: GenerationSpec tidak membawa prompt AI
  // ==========================================
  assert(
    (specA as any).prompt === undefined &&
      (specA as any).systemPrompt === undefined &&
      (specA as any).aiPrompt === undefined,
    'Case AH: GenerationSpec strictly contains no AI prompts or LLM instructions'
  );

  // ==========================================
  // TEST AI: GenerationSpec tidak membawa soal yang sudah jadi
  // ==========================================
  assert(
    (specA as any).items === undefined &&
      (specA as any).questions === undefined &&
      (specA as any).soal === undefined,
    'Case AI: GenerationSpec strictly contains no generated assessment items/questions'
  );

  // ==========================================
  // TEST AJ: GenerationSpec belum memiliki question budget
  // ==========================================
  assert(
    (specA as any).itemCount === undefined &&
      (specA as any).recommendedItemCount === undefined &&
      (specA as any).estimatedMinutes === undefined &&
      (specA as any).difficultyDistribution === undefined,
    'Case AJ: GenerationSpec does not yet define question budget, durations, or item counts'
  );

  // ==========================================
  // TEST AK: Canonical AssessmentPlan tidak termutasi selama proses resolution
  // ==========================================
  const planForMutationTest: AssessmentPlan = {
    ...mockPlanMatSiap,
    title: 'Rencana Asesmen Uji Imutabilitas',
  };
  const beforeSnapshot = JSON.stringify(planForMutationTest);
  resolveAssessmentGenerationSpec({
    assessmentPlan: planForMutationTest,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const afterSnapshot = JSON.stringify(planForMutationTest);
  assert(
    beforeSnapshot === afterSnapshot,
    'Case AK: Canonical AssessmentPlan is completely immutable during generation spec resolution'
  );

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
