import {
  AssessmentAllocationUnit,
  AssessmentAnswerKey,
  AssessmentAnswerType,
  AssessmentBlueprintItem,
  AssessmentCoverageUnit,
  AssessmentDifficultyTarget,
  AssessmentEvidenceType,
  AssessmentGeneratedContentSource,
  AssessmentGenerationContract,
  AssessmentGenerationContractUnit,
  AssessmentGenerationIssue,
  AssessmentGenerationPlan,
  AssessmentGenerationResult,
  AssessmentGenerationResultStatus,
  AssessmentGenerationSource,
  AssessmentGenerationSpec,
  AssessmentInstrument,
  AssessmentInstrumentType,
  AssessmentPackage,
  AssessmentRubric,
  AssessmentScoringGuide,
  AssessmentStimulusOrigin,
  AssessmentStimulusType,
  AssessmentTeacherContext,
  AssessmentAIGenerationProvider,
  AssessmentAIGenerationRawResponse,
  AssessmentAIGenerationRequest,
  CategoryResponseCategory,
  CategoryResponseStatement,
  CognitiveDemand,
  GenerateAssessmentPackageInput,
  GeneratedAssessmentUnit,
  GeneratedEvidenceUnit,
  GeneratedItemUnit,
  GeneratedObservationUnit,
  GeneratedTaskUnit,
  MatchingAssessmentEntry,
  ObservationAspect,
  OralAssessmentItem,
  PerformanceAspect,
  RubricCriterion,
  RubricScaleLevel,
  WrittenAssessmentItem,
  WrittenAssessmentItemType,
  WrittenAssessmentOption,
} from '../types';

const VALID_INSTRUMENT_TYPES: Set<AssessmentInstrumentType> = new Set([
  'WRITTEN_TEST',
  'ORAL_TEST',
  'PERFORMANCE',
  'OBSERVATION',
  'ASSIGNMENT',
  'PROJECT',
  'PRODUCT',
  'PORTFOLIO',
  'SELF_ASSESSMENT',
  'PEER_ASSESSMENT',
]);

const VALID_WRITTEN_ITEM_TYPES: Set<WrittenAssessmentItemType> = new Set([
  'MULTIPLE_CHOICE',
  'MULTIPLE_SELECT',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'ESSAY',
  'MATCHING',
  'CATEGORY_RESPONSE',
]);

// ==========================================
// DETERMINISTIC ID GENERATORS
// ==========================================

export function createDeterministicBlueprintId(
  packageId: string,
  coverageUnitId: string
): string {
  const cleanPkg = (packageId || 'pkg').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCov = (coverageUnitId || 'cov').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `bp:${cleanPkg}:${cleanCov}`;
}

export function createDeterministicInstrumentId(
  packageId: string,
  instrumentType: AssessmentInstrumentType
): string {
  const cleanPkg = (packageId || 'pkg').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanType = (instrumentType || 'inst').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `inst:${cleanPkg}:${cleanType}`;
}

export function createDeterministicItemId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `item:${cleanInst}:${index + 1}`;
}

export function createDeterministicOptionId(
  itemId: string,
  optionIndex: number
): string {
  const cleanItem = (itemId || 'item').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const optLetter = String.fromCharCode(65 + (optionIndex % 26));
  return `opt:${cleanItem}:${optLetter}`;
}

export function createDeterministicAspectId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `asp:${cleanInst}:${index + 1}`;
}

export function createDeterministicAnswerKeyId(
  instrumentId: string,
  itemId: string
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanItem = (itemId || 'item').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ans:${cleanInst}:${cleanItem}`;
}

export function createDeterministicRubricId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `rubric:${cleanInst}:${index + 1}`;
}

export function createDeterministicScoringGuideId(
  instrumentId: string,
  itemIdOrInstId: string
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRef = (itemIdOrInstId || 'main').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `sg:${cleanInst}:${cleanRef}`;
}

// ==========================================
// PRE-GENERATION GUARDS
// ==========================================

export interface PreGenerationGuardResult {
  valid: boolean;
  issues: AssessmentGenerationIssue[];
}

export function validatePreGenerationGuards(
  input: GenerateAssessmentPackageInput
): PreGenerationGuardResult {
  const issues: AssessmentGenerationIssue[] = [];

  // 1. Missing Input or Plan
  if (!input || !input.generationPlan) {
    issues.push({
      code: 'PLAN_MISSING',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan wajib disertakan untuk generasi paket asesmen.',
    });
    return { valid: false, issues };
  }

  const plan = input.generationPlan;

  // 2. Plan Resolution Status BLOCKED
  if (plan.resolution?.status === 'BLOCKED') {
    issues.push({
      code: 'PLAN_BLOCKED',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan berstatus BLOCKED dan tidak dapat dilanjutkan ke generasi AI.',
    });
  }

  // 3. Missing GenerationSpec
  if (!plan.generationSpec) {
    issues.push({
      code: 'SPEC_MISSING',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationSpec pada GenerationPlan tidak tersedia atau kosong.',
    });
    return { valid: false, issues };
  }

  const spec = plan.generationSpec;

  // 4. Spec Resolution Status BLOCKED
  if (spec.resolution?.status === 'BLOCKED') {
    issues.push({
      code: 'SPEC_BLOCKED',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationSpec berstatus BLOCKED dan tidak dapat dilanjutkan ke generasi AI.',
    });
  }

  // 5. Coverage Units Checks
  if (!plan.coverageUnits || plan.coverageUnits.length === 0) {
    issues.push({
      code: 'NO_COVERAGE_UNITS',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan tidak memiliki coverage unit untuk digenerasi.',
    });
    return { valid: false, issues };
  }

  const validObjectiveIds = new Set((spec.objectives || []).map((o) => o.id));
  const criteriaMap = new Map((spec.criteria || []).map((c) => [c.id, c]));

  plan.coverageUnits.forEach((unit, idx) => {
    // Blocked Unit
    if (unit.status === 'BLOCKED') {
      issues.push({
        code: 'COVERAGE_UNIT_BLOCKED',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} (${unit.id}) berstatus BLOCKED.`,
        objectiveRefId: unit.objectiveRefId,
        criterionId: unit.criterionId,
      });
    }

    // Objective Reference Check
    if (!unit.objectiveRefId || !validObjectiveIds.has(unit.objectiveRefId)) {
      issues.push({
        code: 'UNRESOLVED_OBJECTIVE_REF',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} merujuk pada objectiveRefId [${unit.objectiveRefId}] yang tidak ditemukan pada GenerationSpec.`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Criterion Reference Check
    if (unit.criterionId) {
      const crit = criteriaMap.get(unit.criterionId);
      if (!crit) {
        issues.push({
          code: 'DANGLING_CRITERION_REF',
          severity: 'BLOCKING',
          message: `Coverage unit #${idx + 1} merujuk pada criterionId [${unit.criterionId}] yang tidak ditemukan pada GenerationSpec.`,
          objectiveRefId: unit.objectiveRefId,
          criterionId: unit.criterionId,
        });
      } else if (crit.objectiveRefId !== unit.objectiveRefId) {
        issues.push({
          code: 'CRITERION_OBJECTIVE_MISMATCH',
          severity: 'BLOCKING',
          message: `Coverage unit #${idx + 1} merujuk pada criterionId [${unit.criterionId}] yang terhubung ke objective berbeda [${crit.objectiveRefId}].`,
          objectiveRefId: unit.objectiveRefId,
          criterionId: unit.criterionId,
        });
      }
    }

    // Instrument Type Check
    if (!unit.instrumentType || !VALID_INSTRUMENT_TYPES.has(unit.instrumentType)) {
      issues.push({
        code: 'UNRESOLVED_INSTRUMENT_TYPE',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} memiliki tipe instrumen yang belum terselesaikan atau tidak valid [${unit.instrumentType}].`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Allocation Unit Check
    if (!unit.allocationUnit) {
      issues.push({
        code: 'UNRESOLVED_ALLOCATION_UNIT',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} belum memiliki allocationUnit yang terselesaikan.`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Required Count Check
    if (
      unit.recommendedCount === undefined ||
      typeof unit.recommendedCount !== 'number' ||
      !Number.isFinite(unit.recommendedCount) ||
      !Number.isInteger(unit.recommendedCount) ||
      unit.recommendedCount <= 0
    ) {
      issues.push({
        code: 'INVALID_UNIT_COUNT',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} memiliki unit count tidak valid [${unit.recommendedCount}] (harus integer >= 1).`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Structural ambiguity in unit issues
    if (unit.issues && unit.issues.some((i) => i.severity === 'BLOCKING')) {
      unit.issues
        .filter((i) => i.severity === 'BLOCKING')
        .forEach((bi) => {
          issues.push(bi);
        });
    }
  });

  // 6. Existing Package Protection Check
  if (input.existingPackage) {
    const existing = input.existingPackage;
    if (existing.workflowStatus === 'SIAP') {
      issues.push({
        code: 'EXISTING_PACKAGE_CONFIRMED_SIAP',
        severity: 'BLOCKING',
        message: 'Paket asesmen yang sudah berstatus SIAP tidak dapat ditimpa otomatis oleh generasi AI awal (gunakan alur revisi terkontrol).',
      });
    } else if (existing.provenance?.generatedBy === 'USER') {
      if (
        (existing.instruments && existing.instruments.length > 0) ||
        (existing.blueprintItems && existing.blueprintItems.length > 0)
      ) {
        issues.push({
          code: 'EXISTING_PACKAGE_TEACHER_PROTECTED',
          severity: 'BLOCKING',
          message: 'Paket asesmen berisi konten yang telah dibuat/diubah oleh guru dan tidak boleh ditimpa secara silent.',
        });
      }
    }
  }

  // 7. Structural review check on plan
  if (plan.resolution?.status === 'NEEDS_REVIEW') {
    const structuralIssues = (plan.resolution?.issues || []).filter(
      (iss) =>
        iss.code === 'INSTRUMENT_RESOLUTION_AMBIGUOUS' ||
        iss.code === 'MULTIPLE_PLANNED_INSTRUMENTS' ||
        iss.code === 'NO_COMMON_INSTRUMENTS'
    );
    if (structuralIssues.length > 0) {
      issues.push({
        code: 'STRUCTURAL_AMBIGUITY_BLOCKS_GENERATION',
        severity: 'BLOCKING',
        message: 'Ambiguity struktural pada instrumen menghalangi generasi AI yang deterministik.',
      });
    }
  }

  const hasBlocking = issues.some((iss) => iss.severity === 'BLOCKING');
  return { valid: !hasBlocking, issues };
}

// ==========================================
// GENERATION CONTRACT BUILDER
// ==========================================

export function buildGenerationContract(
  plan: AssessmentGenerationPlan,
  teacherContext?: AssessmentTeacherContext,
  sourceMaterials?: AssessmentGenerationSource[]
): AssessmentGenerationContract {
  const spec = plan.generationSpec!;
  const objMap = new Map((spec.objectives || []).map((o) => [o.id, o]));
  const critMap = new Map((spec.criteria || []).map((c) => [c.id, c]));

  const units: AssessmentGenerationContractUnit[] = plan.coverageUnits.map((cov) => {
    const obj = objMap.get(cov.objectiveRefId);
    const crit = cov.criterionId ? critMap.get(cov.criterionId) : undefined;

    const objectiveText = obj ? obj.text : '';
    const criterionText = crit
      ? crit.description
        ? `${crit.name}: ${crit.description}`
        : crit.name
      : undefined;

    const indicatorSource: AssessmentGeneratedContentSource = cov.assessmentIndicator
      ? 'TEACHER'
      : 'AI_DRAFT';

    const materialSource: AssessmentGeneratedContentSource = cov.materialOrContext
      ? 'TEACHER'
      : 'AI_SYNTHETIC';

    return {
      coverageUnitId: cov.id,
      objectiveRefId: cov.objectiveRefId,
      criterionId: cov.criterionId,
      objectiveText,
      criterionText,
      instrumentType: cov.instrumentType!,
      allocationUnit: cov.allocationUnit!,
      requiredCount: cov.recommendedCount || 1,
      cognitiveDemand: cov.cognitiveDemand,
      stimulusType: cov.stimulusType,
      difficultyTarget: cov.difficultyTarget,
      assessmentIndicator: cov.assessmentIndicator,
      materialOrContext: cov.materialOrContext,
      indicatorSource,
      materialSource,
    };
  });

  return {
    assessmentPlanId: spec.assessmentPlanId,
    assessmentPackageId: spec.assessmentPackageId,
    curriculumContext: spec.curriculumContext,
    gradeCalibration: spec.generationProfile?.gradeCalibration,
    subjectProfile: spec.subjectProfile,
    sourceContext: spec.sourceContext || [],
    units,
  };
}

// ==========================================
// PROMPT BUILDER
// ==========================================

export function buildGenerationPrompts(
  contract: AssessmentGenerationContract,
  teacherContext?: AssessmentTeacherContext,
  sourceMaterials?: AssessmentGenerationSource[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `Anda adalah Asisten Penulis Soal dan Asesmen Pembelajaran (AI Assessment Content Generator).
Peran Anda adalah menghasilkan draf butir asesmen (soal, tugas, rubrik, bukti, observasi) secara terstruktur berdasarkan kontrak yang telah disepakati.

ATURAN GENERASI KETAT:
1. AI ADALAH CONTENT GENERATOR, BUKAN RESOLVER:
   - JANGAN mengubah atau mengarang Tujuan Pembelajaran (TP) / Kompetensi Dasar (KD).
   - JANGAN mengubah atau mengarang kriteria KKTP.
   - JANGAN mengubah coverageUnitId, objectiveRefId, criterionId, instrumentType, atau allocationUnit.
   - JANGAN mengubah jumlah butir/tugas (requiredCount). Hasilkan PERSIS sesuai requiredCount.
   - JANGAN mengklaim konten sintetis buatan AI sebagai dokumen resmi (OFFICIAL) atau regulasi pemerintah.
   - JANGAN menandai draf sebagai SIAP atau FINAL (seluruh keluaran adalah DRAFT).

2. SEMANTIK ALOKASI & FORMAT INSTRUMEN:
   - ITEM (WRITTEN_TEST / ORAL_TEST):
     * Pilihan Ganda: Buat pokok soal (stem) yang jelas, 1 kunci jawaban terbaik, opsi pengecoh homogen dan masuk akal, tanpa petunjuk jawaban (clues).
     * Uraian/Esai: Buat instruksi soal dan pedoman penskoran (scoring guide draft).
   - TASK (PERFORMANCE / ASSIGNMENT / PROJECT / PRODUCT):
     * Buat deskripsi tugas/instruksi kerja nyata, aspek yang dinilai, dan draf rubrik.
     * JANGAN mengubah tugas kinerja menjadi soal pilihan ganda atau tes tertulis biasa.
   - EVIDENCE (PORTFOLIO):
     * Buat persyaratan bukti karya dan kriteria evaluasi/rubrik portofolio.
   - OBSERVATION (OBSERVATION):
     * Buat aspek pengamatan dan indikator perilaku yang dapat diamati secara konkret.

3. KOGNISI & BAHASA:
   - Pertahankan cognitiveDemand jika diberikan pada kontrak (RECALL_UNDERSTAND, APPLY, ANALYZE_REASON, EVALUATE_CREATE).
   - JANGAN memaksakan rumus persentase baku seperti 30% LOTS / 40% MOTS / 30% HOTS.
   - JANGAN menganggap HOTS = HARD atau LOTS = EASY.
   - Sesuaikan beban membaca dan bahasa dengan kalibrasi kelas murid tanpa mencetak metadata internal di dalam teks soal.

FORMAT KELUARAN:
Keluarkan HANYA JSON murni (array dari objek unit generasi) tanpa teks pembuka atau penutup markdown selain blok json jika diperlukan.`;

  const userPrompt = `Kontrak Generasi Asesmen:
Konteks Kurikulum: ${contract.curriculumContext.curriculumType || 'Kurikulum Merdeka'}, Tingkat: ${contract.curriculumContext.schoolLevel || ''}, Kelas: ${contract.curriculumContext.grade ? 'Kelas ' + contract.curriculumContext.grade : ''}, Fase: ${contract.curriculumContext.phase || ''}
Mata Pelajaran: ${contract.subjectProfile.subjectLabel || contract.subjectProfile.subjectKey}

${
  contract.gradeCalibration
    ? `Kalibrasi Tingkat Kelas:
- Reading Load: ${contract.gradeCalibration.readingLoad}
- Instruction Load: ${contract.gradeCalibration.instructionLoad}
- Abstraction Level: ${contract.gradeCalibration.abstractionLevel}
- Visual Support: ${contract.gradeCalibration.visualSupport}`
    : ''
}

${
  teacherContext
    ? `Konteks Tambahan dari Guru:
${teacherContext.instructions ? `- Instruksi: ${teacherContext.instructions}` : ''}
${teacherContext.localContext ? `- Konteks Lokal: ${teacherContext.localContext}` : ''}
${teacherContext.focusAreas?.length ? `- Fokus: ${teacherContext.focusAreas.join(', ')}` : ''}`
    : ''
}

${
  sourceMaterials?.length
    ? `Materi Sumber Belajar:
${sourceMaterials.map((s, i) => `[Sumber ${i + 1}: ${s.title}] ${s.content}`).join('\n')}`
    : ''
}

DAFTAR UNIT YANG WAJIB DIGENERASI (${contract.units.length} UNIT):
${JSON.stringify(contract.units, null, 2)}

Hasilkan JSON array dari objek GeneratedAssessmentUnit yang mencakup setiap unit di atas sesuai requiredCount masing-masing.`;

  return { systemPrompt, userPrompt };
}

// ==========================================
// RUNTIME PARSING & REFERENCE VALIDATION
// ==========================================

export interface ParsedAIResponseResult {
  validatedUnits: GeneratedAssessmentUnit[];
  failedCoverageUnitIds: string[];
  issues: AssessmentGenerationIssue[];
}

export function parseAndValidateRawAIResponse(
  rawText: string,
  contract: AssessmentGenerationContract
): ParsedAIResponseResult {
  const issues: AssessmentGenerationIssue[] = [];
  const validatedUnits: GeneratedAssessmentUnit[] = [];
  const contractMap = new Map(contract.units.map((u) => [u.coverageUnitId, u]));

  let parsedRaw: any;
  try {
    let cleanText = (rawText || '').trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    parsedRaw = JSON.parse(cleanText);
  } catch (err: any) {
    return {
      validatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'MALFORMED_AI_RESPONSE',
          severity: 'BLOCKING',
          message: `Gagal mem-parsing keluaran AI sebagai JSON: ${err.message || 'SyntaxError'}`,
        },
      ],
    };
  }

  let candidates: any[] = [];
  if (Array.isArray(parsedRaw)) {
    candidates = parsedRaw;
  } else if (parsedRaw && Array.isArray(parsedRaw.units)) {
    candidates = parsedRaw.units;
  } else if (parsedRaw && Array.isArray(parsedRaw.items)) {
    candidates = parsedRaw.items;
  } else if (parsedRaw && typeof parsedRaw === 'object') {
    // Single unit wrapped in object
    candidates = [parsedRaw];
  } else {
    return {
      validatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'INVALID_AI_RESPONSE_STRUCTURE',
          severity: 'BLOCKING',
          message: 'Keluaran AI bukan merupakan array unit generasi yang valid.',
        },
      ],
    };
  }

  const generatedCountPerCoverage = new Map<string, number>();

  candidates.forEach((candidate, idx) => {
    if (!candidate || typeof candidate !== 'object') {
      issues.push({
        code: 'INVALID_CANDIDATE_OBJECT',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} bukan objek yang valid.`,
      });
      return;
    }

    const covId = candidate.coverageUnitId;
    if (!covId || typeof covId !== 'string') {
      issues.push({
        code: 'MISSING_COVERAGE_UNIT_ID',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} tidak memiliki coverageUnitId.`,
      });
      return;
    }

    const contractUnit = contractMap.get(covId);
    if (!contractUnit) {
      issues.push({
        code: 'UNKNOWN_COVERAGE_UNIT_ID',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} memiliki coverageUnitId [${covId}] yang tidak terdaftar pada kontrak.`,
      });
      return;
    }

    // Reference Integrity Checks against Contract (ID > TEXT MATCH)
    if (candidate.objectiveRefId !== contractUnit.objectiveRefId) {
      issues.push({
        code: 'OBJECTIVE_REF_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah objectiveRefId [${candidate.objectiveRefId}] (harus [${contractUnit.objectiveRefId}]).`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    const candidateCrit = candidate.criterionId || undefined;
    const contractCrit = contractUnit.criterionId || undefined;
    if (candidateCrit !== contractCrit) {
      issues.push({
        code: 'CRITERION_REF_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} tidak cocok criterionId [${candidateCrit}] vs [${contractCrit}].`,
        objectiveRefId: contractUnit.objectiveRefId,
        criterionId: contractUnit.criterionId,
      });
      return;
    }

    if (candidate.instrumentType !== contractUnit.instrumentType) {
      issues.push({
        code: 'INSTRUMENT_TYPE_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah instrumentType [${candidate.instrumentType}] vs [${contractUnit.instrumentType}].`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    if (candidate.allocationUnit !== contractUnit.allocationUnit) {
      issues.push({
        code: 'ALLOCATION_UNIT_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah allocationUnit [${candidate.allocationUnit}] vs [${contractUnit.allocationUnit}].`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    // Semantic Family Validation
    switch (contractUnit.allocationUnit) {
      case 'ITEM': {
        const itemType = candidate.itemType || 'MULTIPLE_CHOICE';
        if (!VALID_WRITTEN_ITEM_TYPES.has(itemType)) {
          issues.push({
            code: 'INVALID_ITEM_TYPE',
            severity: 'REVIEW',
            message: `Kandidat ITEM #${idx + 1} memiliki itemType tidak valid [${itemType}].`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
        if (!prompt) {
          issues.push({
            code: 'EMPTY_ITEM_PROMPT',
            severity: 'REVIEW',
            message: `Kandidat ITEM #${idx + 1} memiliki prompt kosong.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const itemUnit: GeneratedItemUnit = {
          allocationUnit: 'ITEM',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          itemType,
          prompt,
          stimulus: candidate.stimulus || undefined,
          stimulusOrigin: candidate.stimulus ? 'AI_SYNTHETIC' : undefined,
          stimulusSource: candidate.stimulusSource || undefined,
          options: Array.isArray(candidate.options)
            ? candidate.options.map((opt: any, oIdx: number) => ({
                id: opt.id || undefined,
                text: typeof opt === 'string' ? opt : opt.text || `Pilihan ${String.fromCharCode(65 + oIdx)}`,
                isCorrect: typeof opt === 'object' ? opt.isCorrect : undefined,
              }))
            : undefined,
          matchingPremises: Array.isArray(candidate.matchingPremises) ? candidate.matchingPremises : undefined,
          matchingResponses: Array.isArray(candidate.matchingResponses) ? candidate.matchingResponses : undefined,
          categoryStatements: Array.isArray(candidate.categoryStatements) ? candidate.categoryStatements : undefined,
          categoryCategories: Array.isArray(candidate.categoryCategories) ? candidate.categoryCategories : undefined,
          proposedAnswer: candidate.proposedAnswer
            ? {
                answerType: candidate.proposedAnswer.answerType || 'OPTION',
                value: candidate.proposedAnswer.value,
                optionIndices: Array.isArray(candidate.proposedAnswer.optionIndices)
                  ? candidate.proposedAnswer.optionIndices
                  : undefined,
                matchingPairs: Array.isArray(candidate.proposedAnswer.matchingPairs)
                  ? candidate.proposedAnswer.matchingPairs
                  : undefined,
                categoryAnswers: Array.isArray(candidate.proposedAnswer.categoryAnswers)
                  ? candidate.proposedAnswer.categoryAnswers
                  : undefined,
                explanation: candidate.proposedAnswer.explanation,
              }
            : undefined,
          scoringGuideDraft: candidate.scoringGuideDraft
            ? {
                instructions: candidate.scoringGuideDraft.instructions,
                maxScore: candidate.scoringGuideDraft.maxScore,
              }
            : undefined,
        };

        validatedUnits.push(itemUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'TASK': {
        const taskPrompt =
          typeof candidate.taskPrompt === 'string'
            ? candidate.taskPrompt.trim()
            : typeof candidate.instructions === 'string'
            ? candidate.instructions.trim()
            : typeof candidate.taskTitle === 'string'
            ? candidate.taskTitle.trim()
            : '';

        if (!taskPrompt) {
          issues.push({
            code: 'EMPTY_TASK_PROMPT',
            severity: 'REVIEW',
            message: `Kandidat TASK #${idx + 1} tidak memiliki instruksi/tugas yang jelas.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const taskUnit: GeneratedTaskUnit = {
          allocationUnit: 'TASK',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          taskTitle: candidate.taskTitle || 'Tugas Kinerja / Penugasan',
          taskPrompt,
          instructions: candidate.instructions || taskPrompt,
          expectedDeliverable: candidate.expectedDeliverable || undefined,
          aspects: Array.isArray(candidate.aspects)
            ? candidate.aspects.map((asp: any, aIdx: number) => ({
                label: asp.label || asp.name || `Aspek Penilaian #${aIdx + 1}`,
                description: asp.description || undefined,
                weight: typeof asp.weight === 'number' ? asp.weight : undefined,
              }))
            : undefined,
          rubricDraft: candidate.rubricDraft
            ? {
                title: candidate.rubricDraft.title || 'Rubrik Penilaian Tugas',
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria.map((c: any, cIdx: number) => ({
                      label: c.label || c.name || `Kriteria #${cIdx + 1}`,
                      indicator: c.indicator || undefined,
                      weight: typeof c.weight === 'number' ? c.weight : undefined,
                    }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale.map((s: any, sIdx: number) => ({
                      label: s.label || `Level ${sIdx + 1}`,
                      score: typeof s.score === 'number' ? s.score : sIdx + 1,
                      descriptor: s.descriptor || undefined,
                      order: typeof s.order === 'number' ? s.order : sIdx + 1,
                    }))
                  : [],
              }
            : undefined,
          scoringGuideDraft: candidate.scoringGuideDraft
            ? {
                instructions: candidate.scoringGuideDraft.instructions,
                maxScore: candidate.scoringGuideDraft.maxScore,
              }
            : undefined,
        };

        validatedUnits.push(taskUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'EVIDENCE': {
        const evidenceRequirements = Array.isArray(candidate.evidenceRequirements)
          ? candidate.evidenceRequirements
          : typeof candidate.instructions === 'string'
          ? [candidate.instructions]
          : [];

        if (evidenceRequirements.length === 0) {
          issues.push({
            code: 'EMPTY_EVIDENCE_REQUIREMENTS',
            severity: 'REVIEW',
            message: `Kandidat EVIDENCE #${idx + 1} tidak memiliki persyaratan bukti portofolio.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const evidenceUnit: GeneratedEvidenceUnit = {
          allocationUnit: 'EVIDENCE',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          instructions: candidate.instructions || 'Kumpulkan bukti karya sesuai ketentuan berikut:',
          evidenceRequirements,
          rubricDraft: candidate.rubricDraft
            ? {
                title: candidate.rubricDraft.title || 'Rubrik Penilaian Portofolio',
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria.map((c: any, cIdx: number) => ({
                      label: c.label || c.name || `Kriteria Portofolio #${cIdx + 1}`,
                      indicator: c.indicator || undefined,
                      weight: typeof c.weight === 'number' ? c.weight : undefined,
                    }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale.map((s: any, sIdx: number) => ({
                      label: s.label || `Level ${sIdx + 1}`,
                      score: typeof s.score === 'number' ? s.score : sIdx + 1,
                      descriptor: s.descriptor || undefined,
                      order: typeof s.order === 'number' ? s.order : sIdx + 1,
                    }))
                  : [],
              }
            : undefined,
          scoringGuideDraft: candidate.scoringGuideDraft
            ? {
                instructions: candidate.scoringGuideDraft.instructions,
                maxScore: candidate.scoringGuideDraft.maxScore,
              }
            : undefined,
        };

        validatedUnits.push(evidenceUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'OBSERVATION': {
        const aspects = Array.isArray(candidate.aspects)
          ? candidate.aspects.map((asp: any, aIdx: number) => ({
              label: asp.label || asp.name || `Aspek Pengamatan #${aIdx + 1}`,
              indicator: asp.indicator || undefined,
            }))
          : [];

        if (aspects.length === 0) {
          issues.push({
            code: 'EMPTY_OBSERVATION_ASPECTS',
            severity: 'REVIEW',
            message: `Kandidat OBSERVATION #${idx + 1} tidak memiliki aspek pengamatan.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const observationUnit: GeneratedObservationUnit = {
          allocationUnit: 'OBSERVATION',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          recordingScheme: candidate.recordingScheme || 'Skala Sikap / Lembar Pengamatan',
          instructions: candidate.instructions || 'Amati dan catat ketercapaian aspek perilaku berikut:',
          aspects,
          rubricDraft: candidate.rubricDraft
            ? {
                title: candidate.rubricDraft.title || 'Rubrik Pengamatan Observasi',
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria.map((c: any, cIdx: number) => ({
                      label: c.label || c.name || `Aspek #${cIdx + 1}`,
                      indicator: c.indicator || undefined,
                    }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale.map((s: any, sIdx: number) => ({
                      label: s.label || `Level ${sIdx + 1}`,
                      score: typeof s.score === 'number' ? s.score : sIdx + 1,
                      descriptor: s.descriptor || undefined,
                      order: typeof s.order === 'number' ? s.order : sIdx + 1,
                    }))
                  : [],
              }
            : undefined,
        };

        validatedUnits.push(observationUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }
    }
  });

  // Verify Required Counts per Contract Unit (Count is Authoritative, NO Fake Data)
  const failedCoverageUnitIds: string[] = [];
  contract.units.forEach((cu) => {
    const generatedCount = generatedCountPerCoverage.get(cu.coverageUnitId) || 0;
    if (generatedCount < cu.requiredCount) {
      failedCoverageUnitIds.push(cu.coverageUnitId);
      issues.push({
        code: 'INSUFFICIENT_GENERATED_UNITS',
        severity: 'REVIEW',
        message: `Coverage unit [${cu.coverageUnitId}] menghasilkan ${generatedCount} dari ${cu.requiredCount} unit yang diminta.`,
        objectiveRefId: cu.objectiveRefId,
        criterionId: cu.criterionId,
      });
    }
  });

  return { validatedUnits, failedCoverageUnitIds, issues };
}

// ==========================================
// DETERMINISTIC ASSESSMENT PACKAGE MAPPER
// ==========================================

export function mapGeneratedUnitsToAssessmentPackage(
  validatedUnits: GeneratedAssessmentUnit[],
  contract: AssessmentGenerationContract,
  plan: AssessmentGenerationPlan
): AssessmentPackage {
  const now = new Date().toISOString();
  const pkgId = contract.assessmentPackageId || `pkg-${plan.generationSpec?.assessmentPlanId || 'ai'}`;
  const spec = plan.generationSpec;

  const blueprintItems: AssessmentBlueprintItem[] = [];
  const instruments: AssessmentInstrument[] = [];
  const answerKeys: AssessmentAnswerKey[] = [];
  const scoringGuides: AssessmentScoringGuide[] = [];
  const rubrics: AssessmentRubric[] = [];

  // Group generated units by instrumentType
  const unitsByInstrument = new Map<AssessmentInstrumentType, GeneratedAssessmentUnit[]>();
  validatedUnits.forEach((u) => {
    const list = unitsByInstrument.get(u.instrumentType) || [];
    list.push(u);
    unitsByInstrument.set(u.instrumentType, list);
  });

  // Keep track of item/aspect IDs per coverageUnit for Blueprint item mapping
  const coverageToItemIds = new Map<string, string[]>();

  // Map Instruments
  unitsByInstrument.forEach((units, instType) => {
    const instId = createDeterministicInstrumentId(pkgId, instType);

    switch (instType) {
      case 'WRITTEN_TEST': {
        const writtenItems: WrittenAssessmentItem[] = [];

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'ITEM') return;
          const itemUnit = u as GeneratedItemUnit;
          const itemId = createDeterministicItemId(instId, uIdx);

          // Track for blueprint
          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(itemId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          // Build Options with deterministic IDs
          const options: WrittenAssessmentOption[] = (itemUnit.options || []).map((opt, optIdx) => ({
            id: opt.id || createDeterministicOptionId(itemId, optIdx),
            label: String.fromCharCode(65 + (optIdx % 26)),
            text: opt.text,
            isCorrect: opt.isCorrect,
          }));

          const item: WrittenAssessmentItem = {
            id: itemId,
            blueprintItemId: createDeterministicBlueprintId(pkgId, u.coverageUnitId),
            itemType: itemUnit.itemType,
            prompt: itemUnit.prompt,
            stimulus: itemUnit.stimulus,
            stimulusOrigin: itemUnit.stimulus ? 'AI_SYNTHETIC' : undefined,
            stimulusSource: itemUnit.stimulusSource,
            options: options.length > 0 ? options : undefined,
            order: uIdx + 1,
          };
          writtenItems.push(item);

          // Answer Key (Proposed / Unverified)
          if (itemUnit.proposedAnswer) {
            const ansKeyId = createDeterministicAnswerKeyId(instId, itemId);
            const matchedOptionIds = options
              .filter((opt, oIdx) => {
                if (itemUnit.proposedAnswer?.optionIndices?.includes(oIdx)) return true;
                if (itemUnit.proposedAnswer?.value && opt.text.includes(itemUnit.proposedAnswer.value)) return true;
                if (opt.isCorrect) return true;
                return false;
              })
              .map((o) => o.id);

            answerKeys.push({
              id: ansKeyId,
              instrumentId: instId,
              instrumentItemId: itemId,
              answerType: itemUnit.proposedAnswer.answerType,
              value: itemUnit.proposedAnswer.value,
              optionIds: matchedOptionIds.length > 0 ? matchedOptionIds : undefined,
              notes: itemUnit.proposedAnswer.explanation,
            });
          }

          // Scoring Guide
          if (itemUnit.scoringGuideDraft || itemUnit.itemType === 'ESSAY') {
            const sgId = createDeterministicScoringGuideId(instId, itemId);
            scoringGuides.push({
              id: sgId,
              title: `Pedoman Penskoran Butir #${uIdx + 1}`,
              instrumentId: instId,
              instrumentItemId: itemId,
              guideType: itemUnit.itemType === 'ESSAY' ? 'ESSAY' : 'OBJECTIVE',
              instructions: itemUnit.scoringGuideDraft?.instructions || 'Beri skor sesuai kriteria jawaban benar.',
              maxScore: itemUnit.scoringGuideDraft?.maxScore || (itemUnit.itemType === 'ESSAY' ? 10 : 1),
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'WRITTEN_TEST',
          title: 'Instrumen Tes Tertulis (Draf AI)',
          instructions: 'Pilihlah atau jawablah pertanyaan-pertanyaan berikut dengan tepat.',
          items: writtenItems,
        });
        break;
      }

      case 'ORAL_TEST': {
        const oralItems: OralAssessmentItem[] = [];
        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'ITEM') return;
          const itemUnit = u as GeneratedItemUnit;
          const itemId = createDeterministicItemId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(itemId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          oralItems.push({
            id: itemId,
            blueprintItemId: createDeterministicBlueprintId(pkgId, u.coverageUnitId),
            prompt: itemUnit.prompt,
            expectedResponse: itemUnit.proposedAnswer?.value || itemUnit.proposedAnswer?.explanation,
            order: uIdx + 1,
          });
        });

        instruments.push({
          id: instId,
          type: 'ORAL_TEST',
          title: 'Instrumen Tes Lisan (Draf AI)',
          instructions: 'Sampaikan pertanyaan berikut secara lisan kepada murid.',
          items: oralItems,
        });
        break;
      }

      case 'PERFORMANCE': {
        const aspects: PerformanceAspect[] = [];
        let combinedTask = '';
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(aspId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          if (!combinedTask) {
            combinedTask = taskUnit.taskPrompt || taskUnit.taskTitle;
          }

          if (taskUnit.aspects && taskUnit.aspects.length > 0) {
            taskUnit.aspects.forEach((asp, aIdx) => {
              aspects.push({
                id: `${aspId}-${aIdx + 1}`,
                label: asp.label,
                description: asp.description,
                weight: asp.weight,
              });
            });
          } else {
            aspects.push({
              id: aspId,
              label: taskUnit.taskTitle,
              description: taskUnit.instructions,
            });
          }

          // Rubric Draft
          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            const critList: RubricCriterion[] = (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
              id: `crit-${rubricId}-${cIdx + 1}`,
              label: c.label,
              indicator: c.indicator,
              weight: c.weight,
            }));
            const scaleList: RubricScaleLevel[] = (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
              id: `scale-${rubricId}-${sIdx + 1}`,
              label: s.label,
              score: s.score,
              descriptor: s.descriptor,
              order: s.order || sIdx + 1,
            }));

            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Penilaian Kinerja (Draf AI)',
              instrumentId: instId,
              criteria: critList,
              scale: scaleList,
              status: 'DRAFT',
            });
          }

          // Scoring Guide Draft
          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Kinerja',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions || 'Gunakan rubrik penilaian untuk menentukan skor akhir.',
              maxScore: taskUnit.scoringGuideDraft.maxScore || 100,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PERFORMANCE',
          title: 'Instrumen Penilaian Kinerja / Praktik (Draf AI)',
          task: combinedTask || 'Laksanakan tugas unjuk kerja berikut:',
          instructions: 'Lakukan pengamatan dan penilaian terhadap proses dan hasil kinerja murid.',
          aspects: aspects.length > 0 ? aspects : undefined,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'OBSERVATION': {
        const aspects: ObservationAspect[] = [];
        let rubricId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'OBSERVATION') return;
          const obsUnit = u as GeneratedObservationUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(aspId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          obsUnit.aspects.forEach((asp, aIdx) => {
            aspects.push({
              id: `${aspId}-${aIdx + 1}`,
              label: asp.label,
              indicator: asp.indicator,
            });
          });

          if (obsUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            const critList: RubricCriterion[] = (obsUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
              id: `crit-${rubricId}-${cIdx + 1}`,
              label: c.label,
              indicator: c.indicator,
            }));
            const scaleList: RubricScaleLevel[] = (obsUnit.rubricDraft.scale || []).map((s, sIdx) => ({
              id: `scale-${rubricId}-${sIdx + 1}`,
              label: s.label,
              score: s.score,
              descriptor: s.descriptor,
              order: s.order || sIdx + 1,
            }));

            rubrics.push({
              id: rubricId,
              title: obsUnit.rubricDraft.title || 'Rubrik Lembar Observasi (Draf AI)',
              instrumentId: instId,
              criteria: critList,
              scale: scaleList,
              status: 'DRAFT',
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'OBSERVATION',
          title: 'Instrumen Lembar Pengamatan / Observasi (Draf AI)',
          instructions: 'Catat ketercapaian aspek perilaku murid selama proses pembelajaran.',
          recordingScheme: 'Skala Penilaian / Checklist Pengamatan',
          aspects,
        });
        break;
      }

      case 'PORTFOLIO': {
        const evidenceReqs: string[] = [];
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'EVIDENCE') return;
          const evUnit = u as GeneratedEvidenceUnit;
          const reqId = `ev-${instId}-${uIdx + 1}`;

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(reqId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          evUnit.evidenceRequirements.forEach((req) => {
            if (!evidenceReqs.includes(req)) evidenceReqs.push(req);
          });

          if (evUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: evUnit.rubricDraft.title || 'Rubrik Penilaian Portofolio (Draf AI)',
              instrumentId: instId,
              criteria: (evUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
                weight: c.weight,
              })),
              scale: (evUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (evUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Portofolio',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: evUnit.scoringGuideDraft.instructions || 'Gunakan rubrik untuk menilai kelengkapan dan mutu bukti portofolio.',
              maxScore: evUnit.scoringGuideDraft.maxScore || 100,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PORTFOLIO',
          title: 'Instrumen Asesmen Portofolio (Draf AI)',
          instructions: 'Kumpulkan dan susun bukti-bukti hasil pembelajaran berikut:',
          evidenceRequirements: evidenceReqs,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'ASSIGNMENT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(aspId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Penugasan (Draf AI)',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Penugasan',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions || 'Periksa kelengkapan dan kualitas laporan penugasan.',
              maxScore: taskUnit.scoringGuideDraft.maxScore || 100,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'ASSIGNMENT',
          title: 'Instrumen Penugasan (Draf AI)',
          instructions: 'Kerjakan penugasan terstruktur sesuai petunjuk yang diberikan.',
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'PROJECT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(aspId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Proyek (Draf AI)',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Proyek',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions || 'Evaluasi tahapan perencanaan, pelaksanaan, dan pelaporan proyek.',
              maxScore: taskUnit.scoringGuideDraft.maxScore || 100,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PROJECT',
          title: 'Instrumen Penilaian Proyek (Draf AI)',
          projectBrief: 'Rancang dan laksanakan proyek investigatif/kolaboratif sesuai tema pembelajaran.',
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'PRODUCT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(aspId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Penilaian Produk (Draf AI)',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Produk',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions || 'Nilai kualitas rancangan dan produk akhir yang dibuat murid.',
              maxScore: taskUnit.scoringGuideDraft.maxScore || 100,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PRODUCT',
          title: 'Instrumen Penilaian Produk (Draf AI)',
          productBrief: 'Ciptakan karya/produk nyata yang mendemonstrasikan penguasaan kompetensi.',
          rubricId,
          scoringGuideId,
        });
        break;
      }
    }
  });

  // Map Blueprint Items
  contract.units.forEach((cu, idx) => {
    const itemIds = coverageToItemIds.get(cu.coverageUnitId) || [];
    const generatedForUnit = validatedUnits.filter((u) => u.coverageUnitId === cu.coverageUnitId);

    const bpItem: AssessmentBlueprintItem = {
      id: createDeterministicBlueprintId(pkgId, cu.coverageUnitId),
      objectiveRefId: cu.objectiveRefId,
      criterionId: cu.criterionId,
      assessmentIndicator:
        cu.assessmentIndicator ||
        (generatedForUnit[0] as any)?.assessmentIndicator ||
        'Indikator Asesmen (Draf AI)',
      materialOrContext:
        cu.materialOrContext ||
        (generatedForUnit[0] as any)?.materialOrContext ||
        undefined,
      instrumentType: cu.instrumentType,
      instrumentItemIds: itemIds,
      order: idx + 1,
      status: 'DRAFT',
      cognitiveDemand: cu.cognitiveDemand,
      evidenceType: plan.coverageUnits.find((u) => u.id === cu.coverageUnitId)?.evidenceType,
      stimulusType: cu.stimulusType,
      difficultyTarget: cu.difficultyTarget,
      recommendedItemCount: cu.requiredCount,
    };
    blueprintItems.push(bpItem);
  });

  const pkg: AssessmentPackage = {
    id: pkgId,
    assessmentPlanId: contract.assessmentPlanId,
    academicSettingId: spec?.assessmentPlanId ? `setting-${spec.assessmentPlanId}` : 'setting-default',
    title: `Perangkat Asesmen - ${contract.subjectProfile.subjectLabel || contract.subjectProfile.subjectKey} (Draf AI)`,
    blueprintItems,
    instruments,
    answerKeys,
    scoringGuides,
    rubrics,
    workflowStatus: 'DRAFT', // CRITICAL: AI GENERATION ALWAYS PRODUCES DRAFT, NEVER SIAP
    needsReview: true,
    reviewReason: 'Draf hasil generasi AI, wajib ditinjau dan divalidasi oleh guru.',
    revision: 1,
    provenance: {
      generatedBy: 'AI',
      generatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  return pkg;
}

// ==========================================
// MAIN GENERATOR ENTRY POINT
// ==========================================

export async function generateAssessmentPackageDraft(
  input: GenerateAssessmentPackageInput
): Promise<AssessmentGenerationResult> {
  // 1. Pre-generation Guards Check (Fail-closed, no AI call if blocked)
  const guardResult = validatePreGenerationGuards(input);
  if (!guardResult.valid) {
    const failedCoverageUnitIds = input?.generationPlan?.coverageUnits?.map((u) => u.id) || [];
    return {
      status: 'BLOCKED',
      generatedPackage: undefined,
      contract: undefined,
      generatedUnits: [],
      failedCoverageUnitIds,
      issues: guardResult.issues,
    };
  }

  const plan = input.generationPlan;

  // 2. Build Deterministic Generation Contract
  const contract = buildGenerationContract(plan, input.teacherContext, input.sourceMaterials);

  // 3. Build Prompts
  const { systemPrompt, userPrompt } = buildGenerationPrompts(
    contract,
    input.teacherContext,
    input.sourceMaterials
  );

  const request: AssessmentAIGenerationRequest = {
    systemPrompt,
    userPrompt,
    generationContract: contract,
  };

  // 4. Provider Execution
  if (!input.provider) {
    return {
      status: 'FAILED',
      contract,
      generatedPackage: undefined,
      generatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'PROVIDER_MISSING',
          severity: 'BLOCKING',
          message: 'AssessmentAIGenerationProvider tidak tersedia atau belum disuntikkan.',
        },
      ],
    };
  }

  let rawResponse: AssessmentAIGenerationRawResponse;
  try {
    rawResponse = await input.provider.generate(request);
  } catch (err: any) {
    return {
      status: 'FAILED',
      contract,
      generatedPackage: undefined,
      generatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'PROVIDER_EXECUTION_ERROR',
          severity: 'BLOCKING',
          message: `Eksekusi AI provider mengalami kegagalan: ${err.message || 'UnknownError'}`,
        },
      ],
    };
  }

  // 5. Runtime Parsing & Reference Validation
  const parseResult = parseAndValidateRawAIResponse(rawResponse.rawText, contract);

  let status: AssessmentGenerationResultStatus;
  if (parseResult.validatedUnits.length === 0) {
    status = 'FAILED';
  } else if (parseResult.failedCoverageUnitIds.length > 0) {
    status = 'PARTIAL';
  } else {
    status = 'GENERATED';
  }

  // 6. Map to AssessmentPackage (Always DRAFT, never SIAP, no auto-confirmation)
  let generatedPackage: AssessmentPackage | undefined;
  if (parseResult.validatedUnits.length > 0) {
    generatedPackage = mapGeneratedUnitsToAssessmentPackage(
      parseResult.validatedUnits,
      contract,
      plan
    );
  }

  return {
    status,
    generatedPackage,
    contract,
    generatedUnits: parseResult.validatedUnits,
    failedCoverageUnitIds: parseResult.failedCoverageUnitIds,
    issues: [...guardResult.issues, ...parseResult.issues],
  };
}
