import {
  AssessmentPackage,
  AssessmentPlan,
  AssessmentBlueprintItem,
  AssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  AssessmentRubric,
  AcademicSetting,
  TPData,
  K13Analysis,
  AssessmentCriterion,
  WrittenAssessmentInstrument,
  OralAssessmentInstrument,
  PerformanceAssessmentInstrument,
  ObservationAssessmentInstrument,
  AssignmentAssessmentInstrument,
  ProjectAssessmentInstrument,
  ProductAssessmentInstrument,
  PortfolioAssessmentInstrument,
  SelfPeerAssessmentInstrument,
} from '../types';
import { isK13, isMerdeka } from './curriculumRouter';

export interface AssessmentPackageValidationContext {
  academicSetting?: AcademicSetting;
  assessmentPlan?: AssessmentPlan;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  assessmentCriteria?: AssessmentCriterion[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function createEmptyAssessmentPackage(
  plan: AssessmentPlan,
  academicSettingId: string,
  workspaceId?: string
): AssessmentPackage {
  const now = new Date().toISOString();
  return {
    id: `pkg-${plan.id}`,
    assessmentPlanId: plan.id,
    academicSettingId,
    workspaceId: workspaceId || plan.workspaceId,
    title: plan.displayLabel || plan.title || 'Perangkat Asesmen',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    needsReview: false,
    revision: 1,
    provenance: {
      generatedBy: 'USER',
      generatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function validateAssessmentPackage(
  pkg: AssessmentPackage,
  context: AssessmentPackageValidationContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Title Check
  if (!pkg.title || pkg.title.trim() === '') {
    errors.push('Judul Perangkat Asesmen wajib diisi.');
  }

  // 2. Parent AssessmentPlan Verification
  if (!pkg.assessmentPlanId) {
    errors.push('Perangkat Asesmen tidak terhubung dengan Rencana Asesmen (assessmentPlanId kosong).');
  } else if (!context.assessmentPlan || context.assessmentPlan.id !== pkg.assessmentPlanId) {
    errors.push('Parent AssessmentPlan tidak ditemukan atau referensi ID tidak valid.');
  } else {
    const parentPlan = context.assessmentPlan;
    if (parentPlan.workflowStatus !== 'SIAP') {
      errors.push(`Rencana Asesmen induk "${parentPlan.title}" belum berstatus SIAP.`);
    }

    // Instrument Type Coherence with Parent Plan
    const planInstrumentTypes = new Set((parentPlan.instruments || []).map((i) => i.type));
    pkg.instruments.forEach((inst) => {
      if (!planInstrumentTypes.has(inst.type)) {
        errors.push(
          `Tipe instrumen "${inst.type}" pada Perangkat Asesmen tidak terdaftar pada Rencana Asesmen induk.`
        );
      }
    });

    // Verify all selected instruments in plan have a corresponding package instrument
    planInstrumentTypes.forEach((reqType) => {
      const existsInPkg = pkg.instruments.some((i) => i.type === reqType);
      if (!existsInPkg) {
        errors.push(`Instrumen tipe "${reqType}" yang direncanakan pada Rencana Asesmen belum dibuat.`);
      }
    });
  }

  // 3. Objective Source Verification for Blueprint (Kisi-Kisi)
  const validObjectiveIds = new Set<string>();
  if (isMerdeka(context.academicSetting)) {
    if (context.tp?.items) {
      context.tp.items.forEach((t) => validObjectiveIds.add(t.id));
    }
  } else if (isK13(context.academicSetting)) {
    if (context.k13Analysis?.items) {
      context.k13Analysis.items.forEach((k) => validObjectiveIds.add(k.id));
    }
  }

  if (pkg.blueprintItems.length === 0) {
    warnings.push('Kisi-kisi asesmen (blueprint) masih kosong.');
  } else {
    pkg.blueprintItems.forEach((bp, idx) => {
      if (!bp.objectiveRefId) {
        errors.push(`Butir kisi-kisi #${idx + 1} tidak memiliki referensi Tujuan Pembelajaran (TP/KD).`);
      } else if (validObjectiveIds.size > 0 && !validObjectiveIds.has(bp.objectiveRefId)) {
        errors.push(
          `Butir kisi-kisi #${idx + 1} merujuk pada TP/KD ID [${bp.objectiveRefId}] yang tidak valid atau telah dihapus.`
        );
      }

      if (bp.criterionId && context.assessmentCriteria) {
        const critExists = context.assessmentCriteria.some((c) => c.id === bp.criterionId);
        if (!critExists) {
          errors.push(
            `Butir kisi-kisi #${idx + 1} merujuk pada kriteria KKTP [${bp.criterionId}] yang tidak ditemukan.`
          );
        }
      }

      if (!bp.assessmentIndicator || bp.assessmentIndicator.trim() === '') {
        warnings.push(`Indikator asesmen pada butir kisi-kisi #${idx + 1} belum diisi.`);
      }
    });
  }

  // 4. Instrument-Specific Validation
  pkg.instruments.forEach((inst) => {
    switch (inst.type) {
      case 'WRITTEN_TEST': {
        const written = inst as WrittenAssessmentInstrument;
        if (!written.items || written.items.length === 0) {
          errors.push('Tes Tertulis wajib memiliki minimal 1 butir soal.');
        } else {
          written.items.forEach((item, itemIdx) => {
            if (!item.prompt || item.prompt.trim() === '') {
              errors.push(`Soal tertulis #${itemIdx + 1} belum memiliki teks pertanyaan (prompt).`);
            }
            if (item.itemType === 'MULTIPLE_CHOICE' || item.itemType === 'MULTIPLE_SELECT') {
              if (!item.options || item.options.length < 2) {
                errors.push(`Soal pilihan ganda #${itemIdx + 1} wajib memiliki minimal 2 opsi jawaban.`);
              } else {
                const hasCorrect = item.options.some((opt) => opt.isCorrect);
                const hasAnswerKey = pkg.answerKeys.some(
                  (ak) => ak.instrumentItemId === item.id && (ak.value || (ak.optionIds && ak.optionIds.length > 0))
                );
                if (!hasCorrect && !hasAnswerKey) {
                  errors.push(`Soal pilihan ganda #${itemIdx + 1} belum menentukan kunci/opsi jawaban yang benar.`);
                }
              }
            }
          });
        }
        break;
      }
      case 'ORAL_TEST': {
        const oral = inst as OralAssessmentInstrument;
        if (!oral.items || oral.items.length === 0) {
          errors.push('Tes Lisan wajib memiliki minimal 1 pertanyaan lisan.');
        } else {
          oral.items.forEach((item, itemIdx) => {
            if (!item.prompt || item.prompt.trim() === '') {
              errors.push(`Pertanyaan tes lisan #${itemIdx + 1} belum memiliki teks pertanyaan.`);
            }
          });
        }
        break;
      }
      case 'PERFORMANCE': {
        const perf = inst as PerformanceAssessmentInstrument;
        if (!perf.task || perf.task.trim() === '') {
          errors.push('Asesmen Performa/Praktik wajib memiliki instruksi/tugas yang jelas.');
        }
        const hasRubric = perf.rubricId && pkg.rubrics.some((r) => r.id === perf.rubricId);
        const hasScoringGuide = perf.scoringGuideId && pkg.scoringGuides.some((sg) => sg.id === perf.scoringGuideId);
        const hasAspects = perf.aspects && perf.aspects.length > 0;
        if (!hasRubric && !hasScoringGuide && !hasAspects) {
          errors.push('Asesmen Performa/Praktik wajib dilengkapi rubrik, pedoman penskoran, atau aspek penilaian.');
        }
        break;
      }
      case 'OBSERVATION': {
        const obs = inst as ObservationAssessmentInstrument;
        if (!obs.aspects || obs.aspects.length === 0) {
          errors.push('Lembar Observasi wajib memiliki minimal 1 aspek pengamatan yang ditentukan guru.');
        } else {
          obs.aspects.forEach((asp, aspIdx) => {
            if (!asp.label || asp.label.trim() === '') {
              errors.push(`Aspek observasi #${aspIdx + 1} belum memiliki label aspek.`);
            }
          });
        }
        break;
      }
      case 'ASSIGNMENT': {
        const assign = inst as AssignmentAssessmentInstrument;
        if (!assign.instructions || assign.instructions.trim() === '') {
          errors.push('Penugasan wajib memiliki instruksi tugas.');
        }
        break;
      }
      case 'PROJECT': {
        const proj = inst as ProjectAssessmentInstrument;
        if (!proj.projectBrief || proj.projectBrief.trim() === '') {
          errors.push('Asesmen Proyek wajib memiliki brief/deskripsi proyek.');
        }
        break;
      }
      case 'PRODUCT': {
        const prod = inst as ProductAssessmentInstrument;
        if (!prod.productBrief || prod.productBrief.trim() === '') {
          errors.push('Asesmen Produk wajib memiliki brief/deskripsi produk.');
        }
        break;
      }
      case 'PORTFOLIO': {
        const port = inst as PortfolioAssessmentInstrument;
        if (!port.instructions || port.instructions.trim() === '') {
          errors.push('Asesmen Portofolio wajib memiliki instruksi.');
        }
        if (!port.evidenceRequirements || port.evidenceRequirements.length === 0) {
          errors.push('Asesmen Portofolio wajib mencantumkan persyaratan bukti (evidence requirements).');
        }
        break;
      }
      case 'SELF_ASSESSMENT':
      case 'PEER_ASSESSMENT': {
        const selfPeer = inst as SelfPeerAssessmentInstrument;
        if (!selfPeer.items || selfPeer.items.length === 0) {
          errors.push(`Asesmen Diri/Sebaya (${inst.type}) wajib memiliki minimal 1 pernyataan penilaian.`);
        } else {
          selfPeer.items.forEach((item, itemIdx) => {
            if (!item.statement || item.statement.trim() === '') {
              errors.push(`Pernyataan asesmen #${itemIdx + 1} belum diisi.`);
            }
          });
        }
        break;
      }
    }
  });

  // 5. Answer Keys Reference Integrity
  pkg.answerKeys.forEach((ak, akIdx) => {
    if (ak.answerType === 'OPTION' || ak.answerType === 'MULTIPLE_OPTION') {
      const writtenInst = pkg.instruments.find((i) => i.id === ak.instrumentId) as WrittenAssessmentInstrument | undefined;
      if (writtenInst && writtenInst.items) {
        const item = writtenInst.items.find((it) => it.id === ak.instrumentItemId);
        if (item && item.options && ak.optionIds) {
          const validOptIds = new Set(item.options.map((o) => o.id));
          ak.optionIds.forEach((optId) => {
            if (!validOptIds.has(optId)) {
              errors.push(`Kunci jawaban #${akIdx + 1} merujuk pada opsi ID [${optId}] yang tidak ada pada pilihan soal.`);
            }
          });
        }
      }
    }
  });

  // 6. Rubrics Structure Integrity (No default levels/descriptors fabricated if empty!)
  pkg.rubrics.forEach((rub, rubIdx) => {
    if (!rub.criteria || rub.criteria.length === 0) {
      errors.push(`Rubrik #${rubIdx + 1} ("${rub.title}") wajib memiliki minimal 1 kriteria.`);
    }
    if (!rub.scale || rub.scale.length === 0) {
      errors.push(`Rubrik #${rubIdx + 1} ("${rub.title}") wajib memiliki minimal 1 tingkat skala penilaian.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function confirmAssessmentPackage(
  pkg: AssessmentPackage,
  context: AssessmentPackageValidationContext
): { success: boolean; package: AssessmentPackage; errors: string[] } {
  const validation = validateAssessmentPackage(pkg, context);
  if (!validation.valid) {
    return {
      success: false,
      package: {
        ...pkg,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: validation.errors.join('; '),
      },
      errors: validation.errors,
    };
  }

  const updatedPkg: AssessmentPackage = {
    ...pkg,
    workflowStatus: 'SIAP',
    needsReview: false,
    reviewReason: undefined,
    updatedAt: new Date().toISOString(),
  };

  return {
    success: true,
    package: updatedPkg,
    errors: [],
  };
}

export function invalidateAssessmentPackageDependencies(
  pkg: AssessmentPackage,
  context: AssessmentPackageValidationContext
): { isInvalidated: boolean; package: AssessmentPackage; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Check parent AssessmentPlan
  if (!context.assessmentPlan || context.assessmentPlan.id !== pkg.assessmentPlanId) {
    reasons.push('Parent AssessmentPlan tidak ditemukan atau telah dihapus.');
  } else if (context.assessmentPlan.workflowStatus !== 'SIAP') {
    reasons.push(`Parent AssessmentPlan "${context.assessmentPlan.title}" tidak lagi berstatus SIAP.`);
  } else {
    // Check instrument types in plan match package
    const planInstTypes = new Set((context.assessmentPlan.instruments || []).map((i) => i.type));
    pkg.instruments.forEach((inst) => {
      if (!planInstTypes.has(inst.type)) {
        reasons.push(`Tipe instrumen "${inst.type}" telah dihapus dari Rencana Asesmen induk.`);
      }
    });
  }

  // 2. Check Objective references in Blueprint
  const validObjectiveIds = new Set<string>();
  if (isMerdeka(context.academicSetting)) {
    if (context.tp?.items) {
      context.tp.items.forEach((t) => validObjectiveIds.add(t.id));
    }
  } else if (isK13(context.academicSetting)) {
    if (context.k13Analysis?.items) {
      context.k13Analysis.items.forEach((k) => validObjectiveIds.add(k.id));
    }
  }

  if (validObjectiveIds.size > 0 && pkg.blueprintItems.length > 0) {
    const invalidBp = pkg.blueprintItems.filter((bp) => !validObjectiveIds.has(bp.objectiveRefId));
    if (invalidBp.length > 0) {
      reasons.push(`Terdapat ${invalidBp.length} referensi TP/KD pada kisi-kisi yang telah dihapus di hulu.`);
    }
  }

  if (reasons.length > 0) {
    const invalidatedPkg: AssessmentPackage = {
      ...pkg,
      workflowStatus: 'PERLU_DILENGKAPI',
      needsReview: true,
      reviewReason: reasons.join('; '),
      updatedAt: new Date().toISOString(),
    };
    return {
      isInvalidated: true,
      package: invalidatedPkg,
      reasons,
    };
  }

  return {
    isInvalidated: false,
    package: pkg,
    reasons: [],
  };
}
