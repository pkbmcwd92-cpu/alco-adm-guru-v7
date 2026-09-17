import {
  LearningPlan,
  LearningPlanStatus,
  LearningPlanSource,
  AcademicSetting,
  TPData,
  ATPData,
  K13Analysis,
  TimeAllocation,
  AssessmentCriterion,
  CurriculumType,
  TPItem,
  ATPItem,
} from '../types';

export interface LearningPlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolvedTPs: Array<{ id: string; code?: string; statement: string; materialScope?: string }>;
  resolvedATPs: Array<{ id: string; stepNumber?: number; materialScope?: string; jp?: number }>;
  resolvedAllocatedJP?: number;
}

/**
 * Validates a canonical LearningPlan against workspace dependencies.
 * Follows strict principles:
 * - NO DATA > FAKE DATA
 * - ID > TEXT MATCH
 * - UNRESOLVED > GUESS
 * - VALIDATOR > AUTO SIAP
 * - AI OUTPUT = DRAFT
 */
export function validateLearningPlan(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
    timeAllocations?: TimeAllocation[] | null;
    assessmentCriteria?: AssessmentCriterion[] | null;
  }
): LearningPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolvedTPs: Array<{ id: string; code?: string; statement: string; materialScope?: string }> = [];
  const resolvedATPs: Array<{ id: string; stepNumber?: number; materialScope?: string; jp?: number }> = [];

  if (!plan) {
    return {
      valid: false,
      errors: ['Data Perencanaan Pembelajaran (LearningPlan) tidak ditemukan / kosong.'],
      warnings: [],
      resolvedTPs: [],
      resolvedATPs: [],
    };
  }

  // 1. Validate Academic Setting linkage
  if (!plan.academicSettingId || plan.academicSettingId.trim() === '') {
    errors.push('ID Pengaturan Akademik (academicSettingId) tidak valid.');
  } else if (context.academicSetting && context.academicSetting.id !== plan.academicSettingId) {
    errors.push(`ID Pengaturan Akademik tidak sesuai (Plan: ${plan.academicSettingId}, Context: ${context.academicSetting.id}).`);
  }

  // 2. Validate Canonical TP Dependency (Strict ID lookup - NO text matching)
  if (!plan.tpIds || !Array.isArray(plan.tpIds) || plan.tpIds.length === 0) {
    errors.push('Perencanaan Pembelajaran wajib merujuk minimal 1 Tujuan Pembelajaran (tpIds kosong).');
  } else {
    const isK13 = plan.curriculumType === 'K13';
    const availableTpItems: TPItem[] = context.tp?.items || [];
    const availableK13Items = context.k13Analysis?.items || [];

    for (const tpId of plan.tpIds) {
      if (isK13) {
        // In K13, check k13Analysis items or tp items
        const foundK13 = availableK13Items.find((item) => item.id === tpId);
        const foundTp = availableTpItems.find((item) => item.id === tpId);
        if (foundK13) {
          resolvedTPs.push({
            id: foundK13.id,
            code: foundK13.kd ? foundK13.kd.slice(0, 10) : 'KD',
            statement: foundK13.tujuanPembelajaran || foundK13.indikator || foundK13.kd || '',
            materialScope: foundK13.materi,
          });
        } else if (foundTp) {
          resolvedTPs.push({
            id: foundTp.id,
            code: foundTp.code,
            statement: foundTp.statement || foundTp.description || '',
            materialScope: foundTp.contentScope,
          });
        } else {
          errors.push(`Rujukan TP/KD dengan ID '${tpId}' tidak ditemukan pada data kurikulum aktif (Orphan TP ID).`);
        }
      } else {
        // Merdeka: Strict lookup in context.tp.items by item.id
        const foundTp = availableTpItems.find((item) => item.id === tpId);
        if (foundTp) {
          resolvedTPs.push({
            id: foundTp.id,
            code: foundTp.code,
            statement: foundTp.statement || foundTp.description || '',
            materialScope: foundTp.contentScope,
          });
        } else {
          errors.push(`Tujuan Pembelajaran dengan ID '${tpId}' tidak ditemukan dalam basis data TP (Orphan TP ID).`);
        }
      }
    }
  }

  // 3. Validate Canonical ATP Dependency (Strict ID lookup)
  if (plan.atpItemIds && Array.isArray(plan.atpItemIds) && plan.atpItemIds.length > 0) {
    const availableAtpItems: ATPItem[] = context.atp?.items || [];
    for (const atpItemId of plan.atpItemIds) {
      const foundAtp = availableAtpItems.find((item) => item.id === atpItemId);
      if (foundAtp) {
        resolvedATPs.push({
          id: foundAtp.id,
          stepNumber: foundAtp.stepNumber,
          materialScope: foundAtp.materialScope,
          jp: typeof foundAtp.jp === 'number' ? foundAtp.jp : undefined,
        });
      } else {
        errors.push(`Langkah ATP dengan ID '${atpItemId}' tidak ditemukan dalam alur ATP aktif (Orphan ATP ID).`);
      }
    }
  }

  // 4. Validate Objectives list
  if (!plan.objectives || !Array.isArray(plan.objectives) || plan.objectives.length === 0) {
    errors.push('Daftar rumusan Tujuan Pembelajaran (objectives) tidak boleh kosong.');
  } else {
    for (let i = 0; i < plan.objectives.length; i++) {
      const obj = plan.objectives[i];
      if (!obj.statement || obj.statement.trim() === '') {
        errors.push(`Tujuan Pembelajaran butir ke-${i + 1} memiliki rumusan kalimat kosong.`);
      }
    }
  }

  // 5. Validate Learning Steps (Kegiatan Pembelajaran)
  const openingSteps = plan.learningSteps?.opening || [];
  const coreSteps = plan.learningSteps?.core || [];
  const closingSteps = plan.learningSteps?.closing || [];

  const coreValidCount = coreSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  if (coreValidCount === 0) {
    errors.push('Kegiatan Inti pembelajaran wajib memiliki minimal 1 langkah aktivitas yang terisi deskripsinya.');
  }

  const openingValidCount = openingSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  if (openingValidCount === 0) {
    warnings.push('Kegiatan Pendahuluan belum diisi deskripsi aktivitasnya.');
  }

  const closingValidCount = closingSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  if (closingValidCount === 0) {
    warnings.push('Kegiatan Penutup belum diisi deskripsi aktivitasnya.');
  }

  // 6. Validate Assessment Plan (Rencana Asesmen)
  const initialAssessments = plan.assessmentPlan?.initial || [];
  const formativeAssessments = plan.assessmentPlan?.formative || [];
  const summativeAssessments = plan.assessmentPlan?.summative || [];

  const totalAssessmentItems = initialAssessments.length + formativeAssessments.length + summativeAssessments.length;
  if (totalAssessmentItems === 0) {
    errors.push('Rencana Asesmen minimal harus memuat salah satu bentuk penilaian (Awal, Formatif, atau Sumatif).');
  } else {
    const allAssessments = [...initialAssessments, ...formativeAssessments, ...summativeAssessments];
    for (const item of allAssessments) {
      if (item.linkedTpIds && Array.isArray(item.linkedTpIds)) {
        for (const linkedId of item.linkedTpIds) {
          if (!plan.tpIds.includes(linkedId)) {
            errors.push(`Rencana asesmen '${item.type}' merujuk TP ID '${linkedId}' yang tidak terdaftar dalam perencanaan ini.`);
          }
        }
      }
    }
  }

  // 7. Time / JP Allocation Resolution (Strictly from real data)
  let resolvedAllocatedJP: number | undefined = undefined;
  if (typeof plan.allocatedJP === 'number' && !isNaN(plan.allocatedJP) && plan.allocatedJP > 0) {
    resolvedAllocatedJP = plan.allocatedJP;
  } else if (resolvedATPs.length > 0) {
    const totalAtpJP = resolvedATPs.reduce((sum, item) => sum + (item.jp || 0), 0);
    if (totalAtpJP > 0) {
      resolvedAllocatedJP = totalAtpJP;
    }
  } else if (context.timeAllocations && context.timeAllocations.length > 0 && plan.timeAllocationIds && plan.timeAllocationIds.length > 0) {
    const matchedAllocs = context.timeAllocations.filter((ta) => plan.timeAllocationIds?.includes(ta.id));
    const totalAllocJP = matchedAllocs.reduce((sum, a) => sum + (a.allocatedJP || a.jp || 0), 0);
    if (totalAllocJP > 0) {
      resolvedAllocatedJP = totalAllocJP;
    }
  }

  // 8. Lifecycle & Status Validation
  if (plan.status === 'SIAP') {
    if (errors.length > 0) {
      errors.push('Status SIAP tidak valid karena masih terdapat kesalahan integritas data.');
    }
    if (!plan.confirmedAt) {
      errors.push('Status SIAP memerlukan konfirmasi dan penetapan eksplisit dari guru (confirmedAt belum tercatat).');
    }
    if (plan.sourceType === 'AI_DRAFT' && !plan.confirmedAt) {
      errors.push('Keluaran draf AI tidak boleh langsung berstatus SIAP tanpa peninjauan guru.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    resolvedTPs,
    resolvedATPs,
    resolvedAllocatedJP,
  };
}

/**
 * Creates an initial empty canonical LearningPlan in DRAFT status.
 */
export function createEmptyLearningPlan(params: {
  academicSetting: AcademicSetting;
  curriculumType?: CurriculumType;
  tpIds?: string[];
  atpItemIds?: string[];
  context?: { tp?: TPData | null; atp?: ATPData | null };
}): LearningPlan {
  const { academicSetting, curriculumType = 'KURIKULUM_MERDEKA', tpIds = [], atpItemIds = [], context } = params;
  const now = new Date().toISOString();

  // Populate initial objective references from canonical TP data if available
  const objectives: LearningPlan['objectives'] = [];
  if (tpIds.length > 0 && context?.tp?.items) {
    for (const id of tpIds) {
      const found = context.tp.items.find((item) => item.id === id);
      if (found) {
        objectives.push({
          id: found.id,
          tpId: found.id,
          code: found.code,
          statement: found.statement || found.description || '',
          materialScope: found.contentScope,
        });
      }
    }
  }

  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: academicSetting.id,
    curriculumType,
    sourceType: 'MANUAL',
    status: 'DRAFT',
    tpIds,
    atpItemIds,
    title: objectives.length > 0 ? `Modul Ajar: ${objectives[0].materialScope || objectives[0].code || 'Topik Pembelajaran'}` : '',
    topic: objectives.length > 0 ? (objectives[0].materialScope || '') : '',
    objectives,
    learningSteps: {
      opening: [],
      core: [],
      closing: [],
    },
    assessmentPlan: {
      initial: [],
      formative: [],
      summative: [],
    },
    resources: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates an AI Draft LearningPlan. Always sets sourceType: 'AI_DRAFT' and status: 'DRAFT'.
 */
export function createAIDraftLearningPlan(params: {
  academicSetting: AcademicSetting;
  curriculumType?: CurriculumType;
  tpIds: string[];
  atpItemIds?: string[];
  aiDraft: Partial<LearningPlan>;
  context?: { tp?: TPData | null; atp?: ATPData | null };
}): LearningPlan {
  const { academicSetting, curriculumType = 'KURIKULUM_MERDEKA', tpIds, atpItemIds = [], aiDraft, context } = params;
  const now = new Date().toISOString();

  // Populate objectives strictly from canonical TPs
  const objectives: LearningPlan['objectives'] = [];
  if (tpIds.length > 0 && context?.tp?.items) {
    for (const id of tpIds) {
      const found = context.tp.items.find((item) => item.id === id);
      if (found) {
        objectives.push({
          id: found.id,
          tpId: found.id,
          code: found.code,
          statement: found.statement || found.description || '',
          materialScope: found.contentScope,
        });
      }
    }
  }

  return {
    id: `lp-ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: academicSetting.id,
    curriculumType,
    sourceType: 'AI_DRAFT',
    status: 'DRAFT',
    tpIds,
    atpItemIds,
    title: aiDraft.title || (objectives.length > 0 ? `Draf Modul Ajar: ${objectives[0].materialScope || objectives[0].code || 'Topik'}` : 'Draf Modul Ajar'),
    topic: aiDraft.topic || (objectives.length > 0 ? objectives[0].materialScope : ''),
    objectives: objectives.length > 0 ? objectives : (aiDraft.objectives || []),
    learningSteps: {
      opening: aiDraft.learningSteps?.opening || [],
      core: aiDraft.learningSteps?.core || [],
      closing: aiDraft.learningSteps?.closing || [],
    },
    assessmentPlan: {
      initial: aiDraft.assessmentPlan?.initial || [],
      formative: aiDraft.assessmentPlan?.formative || [],
      summative: aiDraft.assessmentPlan?.summative || [],
    },
    resources: aiDraft.resources || [],
    differentiation: aiDraft.differentiation,
    meaningfulUnderstanding: aiDraft.meaningfulUnderstanding,
    triggerQuestions: aiDraft.triggerQuestions,
    reflection: aiDraft.reflection,
    enrichmentPlan: aiDraft.enrichmentPlan,
    remedialPlan: aiDraft.remedialPlan,
    initialCompetency: aiDraft.initialCompetency,
    targetStudents: aiDraft.targetStudents,
    learningModel: aiDraft.learningModel,
    p3Dimensions: aiDraft.p3Dimensions,
    allocatedJP: typeof aiDraft.allocatedJP === 'number' ? aiDraft.allocatedJP : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Confirms a LearningPlan as SIAP after rigorous validation.
 */
export function confirmLearningPlan(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
    timeAllocations?: TimeAllocation[] | null;
    assessmentCriteria?: AssessmentCriterion[] | null;
  }
): { success: boolean; plan: LearningPlan; validation: LearningPlanValidationResult } {
  // First evaluate validation without the status check
  const candidatePlan: LearningPlan = {
    ...plan,
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validation = validateLearningPlan(candidatePlan, context);

  if (!validation.valid) {
    return {
      success: false,
      plan: {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        updatedAt: new Date().toISOString(),
      },
      validation,
    };
  }

  return {
    success: true,
    plan: candidatePlan,
    validation,
  };
}

/**
 * Automatically invalidates SIAP status if underlying dependencies (TP/ATP) were deleted or changed.
 */
export function invalidatePlanIfDependenciesChanged(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
  }
): { plan: LearningPlan; isInvalidated: boolean; reason?: string } {
  if (plan.status !== 'SIAP') {
    return { plan, isInvalidated: false };
  }

  const validation = validateLearningPlan(plan, context);
  if (!validation.valid) {
    return {
      plan: {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        updatedAt: new Date().toISOString(),
      },
      isInvalidated: true,
      reason: `Status diturunkan ke PERLU_DILENGKAPI karena dependency berubah:\n${validation.errors.join('\n')}`,
    };
  }

  return { plan, isInvalidated: false };
}

/**
 * Migrates legacy learning plans without fabricating non-existent pedagogical facts.
 */
export function migrateLegacyLearningPlan(
  legacy: any,
  academicSettingId: string,
  curriculumType: CurriculumType = 'KURIKULUM_MERDEKA'
): LearningPlan {
  const now = new Date().toISOString();
  const rawId = legacy?.id || `lp-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Parse objectives safely
  const objectives: LearningPlan['objectives'] = [];
  if (Array.isArray(legacy?.objectives)) {
    for (let i = 0; i < legacy.objectives.length; i++) {
      const obj = legacy.objectives[i];
      if (typeof obj === 'string') {
        objectives.push({
          id: `obj-${i + 1}`,
          statement: obj,
        });
      } else if (obj && typeof obj === 'object') {
        objectives.push({
          id: obj.id || `obj-${i + 1}`,
          tpId: obj.tpId,
          code: obj.code,
          statement: obj.statement || obj.description || '',
          materialScope: obj.materialScope || obj.contentScope,
        });
      }
    }
  }

  // Parse steps safely
  const opening: LearningPlan['learningSteps']['opening'] = [];
  const core: LearningPlan['learningSteps']['core'] = [];
  const closing: LearningPlan['learningSteps']['closing'] = [];

  if (Array.isArray(legacy?.learningSteps)) {
    for (let i = 0; i < legacy.learningSteps.length; i++) {
      const s = legacy.learningSteps[i];
      const stepItem = {
        id: s.id || `step-${i + 1}`,
        stepName: s.stepName || 'Kegiatan Inti',
        description: s.description || '',
        durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : undefined,
      };
      const nameLower = (s.stepName || '').toLowerCase();
      if (nameLower.includes('awal') || nameLower.includes('pendahuluan')) {
        opening.push(stepItem);
      } else if (nameLower.includes('tutup') || nameLower.includes('penutup') || nameLower.includes('akhir')) {
        closing.push(stepItem);
      } else {
        core.push(stepItem);
      }
    }
  } else if (legacy?.learningSteps && typeof legacy.learningSteps === 'object') {
    if (Array.isArray(legacy.learningSteps.opening)) opening.push(...legacy.learningSteps.opening);
    if (Array.isArray(legacy.learningSteps.core)) core.push(...legacy.learningSteps.core);
    if (Array.isArray(legacy.learningSteps.closing)) closing.push(...legacy.learningSteps.closing);
  }

  // Parse assessments safely
  const initialAssessments: LearningPlan['assessmentPlan']['initial'] = [];
  const formativeAssessments: LearningPlan['assessmentPlan']['formative'] = [];
  const summativeAssessments: LearningPlan['assessmentPlan']['summative'] = [];

  if (Array.isArray(legacy?.assessmentPlan)) {
    for (let i = 0; i < legacy.assessmentPlan.length; i++) {
      const a = legacy.assessmentPlan[i];
      const item = {
        id: a.id || `asm-${i + 1}`,
        type: ((a.type || 'FORMATIVE').toUpperCase() as 'INITIAL' | 'FORMATIVE' | 'SUMMATIVE'),
        technique: a.technique,
        instrument: a.instrument,
        linkedTpIds: Array.isArray(a.linkedTpIds) ? a.linkedTpIds : [],
        description: a.description || a.instrument || a.technique,
      };
      if (item.type === 'INITIAL') initialAssessments.push(item);
      else if (item.type === 'SUMMATIVE') summativeAssessments.push(item);
      else formativeAssessments.push(item);
    }
  } else if (legacy?.assessmentPlan && typeof legacy.assessmentPlan === 'object') {
    if (Array.isArray(legacy.assessmentPlan.initial)) initialAssessments.push(...legacy.assessmentPlan.initial);
    if (Array.isArray(legacy.assessmentPlan.formative)) formativeAssessments.push(...legacy.assessmentPlan.formative);
    if (Array.isArray(legacy.assessmentPlan.summative)) summativeAssessments.push(...legacy.assessmentPlan.summative);
  }

  return {
    id: rawId,
    academicSettingId: legacy?.academicSettingId || academicSettingId,
    curriculumType: legacy?.curriculumType || curriculumType,
    sourceType: 'MIGRATED',
    status: 'DRAFT', // Migrated plans always require teacher review
    tpIds: Array.isArray(legacy?.tpIds) ? legacy.tpIds : [],
    atpItemIds: Array.isArray(legacy?.atpItemIds) ? legacy.atpItemIds : [],
    kktpCriterionIds: Array.isArray(legacy?.kktpCriterionIds) ? legacy.kktpCriterionIds : [],
    timeAllocationIds: Array.isArray(legacy?.timeAllocationIds) ? legacy.timeAllocationIds : [],
    title: legacy?.title || '',
    topic: legacy?.topic || '',
    objectives,
    learningSteps: {
      opening,
      core,
      closing,
    },
    assessmentPlan: {
      initial: initialAssessments,
      formative: formativeAssessments,
      summative: summativeAssessments,
    },
    resources: Array.isArray(legacy?.resources) ? legacy.resources.map((r: any, idx: number) => (typeof r === 'string' ? { id: `res-${idx + 1}`, title: r } : r)) : [],
    differentiation: legacy?.differentiation,
    meaningfulUnderstanding: legacy?.meaningfulUnderstanding,
    triggerQuestions: Array.isArray(legacy?.triggerQuestions) ? legacy.triggerQuestions : [],
    reflection: legacy?.reflection,
    enrichmentPlan: legacy?.enrichmentPlan,
    remedialPlan: legacy?.remedialPlan,
    initialCompetency: legacy?.initialCompetency,
    targetStudents: legacy?.targetStudents,
    learningModel: legacy?.learningModel,
    p3Dimensions: Array.isArray(legacy?.p3Dimensions) ? legacy.p3Dimensions : [],
    allocatedJP: typeof legacy?.allocatedJP === 'number' ? legacy.allocatedJP : undefined,
    createdAt: legacy?.createdAt || now,
    updatedAt: now,
  };
}
