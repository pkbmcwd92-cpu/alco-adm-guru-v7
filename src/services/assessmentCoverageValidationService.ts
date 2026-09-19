import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentPackageValidationContext,
  AssessmentValidationSection,
  AssessmentValidationFinding,
  AssessmentValidationStatus,
} from '../types';

export function validateAssessmentCoverage(
  pkg: AssessmentPackage,
  generationPlan?: AssessmentGenerationPlan,
  _context?: AssessmentPackageValidationContext
): AssessmentValidationSection {
  const findings: AssessmentValidationFinding[] = [];

  if (!pkg.blueprintItems || pkg.blueprintItems.length === 0) {
    findings.push({
      code: 'MISSING_BLUEPRINT',
      status: 'FAIL',
      severity: 'BLOCKING',
      message: 'Kisi-kisi (blueprint) asesmen kosong.',
      source: 'DETERMINISTIC',
    });
    return {
      status: 'FAIL',
      findings,
    };
  }

  if (!generationPlan || !generationPlan.coverageUnits || generationPlan.coverageUnits.length === 0) {
    return {
      status: 'PASS',
      findings: [],
    };
  }

  const planUnitsMap = new Map(generationPlan.coverageUnits.map((u) => [u.id, u]));
  const matchedPlanUnitIds = new Set<string>();

  // 1. Check each planned coverage unit against package
  for (const planUnit of generationPlan.coverageUnits) {
    // Find blueprint items matching planUnit
    const matchingBpItems = pkg.blueprintItems.filter((bp) => {
      if (bp.coverageUnitId && bp.coverageUnitId === planUnit.id) return true;
      if (
        bp.objectiveRefId === planUnit.objectiveRefId &&
        (!planUnit.criterionId || bp.criterionId === planUnit.criterionId)
      ) {
        return true;
      }
      return false;
    });

    if (matchingBpItems.length === 0) {
      findings.push({
        code: 'MISSING_PLANNED_COVERAGE',
        status: 'FAIL',
        severity: 'BLOCKING',
        coverageUnitId: planUnit.id,
        message: `Unit cakupan rencana (${planUnit.id}) tidak ditemukan pada kisi-kisi perangkat asesmen.`,
        source: 'DETERMINISTIC',
      });
      continue;
    }

    matchedPlanUnitIds.add(planUnit.id);

    // Validate matching blueprint items
    for (const bpItem of matchingBpItems) {
      if (bpItem.objectiveRefId !== planUnit.objectiveRefId) {
        findings.push({
          code: 'OBJECTIVE_REF_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Referensi Tujuan Pembelajaran pada item kisi-kisi (${bpItem.objectiveRefId}) tidak cocok dengan rencana (${planUnit.objectiveRefId}).`,
          source: 'DETERMINISTIC',
        });
      }

      if (planUnit.criterionId && bpItem.criterionId && bpItem.criterionId !== planUnit.criterionId) {
        findings.push({
          code: 'CRITERION_REF_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Referensi Kriteria pada item kisi-kisi (${bpItem.criterionId}) tidak cocok dengan rencana (${planUnit.criterionId}).`,
          source: 'DETERMINISTIC',
        });
      }

      // Find instrument linked to blueprint item
      const instrument =
        pkg.instruments.find((inst) => inst.id === bpItem.instrumentId) ||
        pkg.instruments.find((inst) => inst.type === bpItem.instrumentType) ||
        pkg.instruments.find((inst) => {
          if ('items' in inst && Array.isArray((inst as any).items)) {
            return (inst as any).items.some((item: any) =>
              item.blueprintItemId === bpItem.id ||
              item.coverageUnitId === planUnit.id ||
              bpItem.instrumentItemIds?.includes(item.id)
            );
          }
          return false;
        });

      if (!instrument || instrument.type !== planUnit.instrumentType) {
        findings.push({
          code: 'INSTRUMENT_TYPE_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          instrumentId: instrument?.id,
          message: `Tipe instrumen (${instrument?.type || 'tidak ditemukan'}) tidak sesuai dengan yang direncanakan (${planUnit.instrumentType}).`,
          source: 'DETERMINISTIC',
        });
      }

      if (instrument) {
        // Validate allocation unit semantics
        const isCompatible = checkAllocationSemantics(planUnit.allocationUnit, instrument.type);
        if (!isCompatible) {
          findings.push({
            code: 'ALLOCATION_SEMANTICS_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            coverageUnitId: planUnit.id,
            blueprintItemId: bpItem.id,
            instrumentId: instrument.id,
            message: `Alokasi unit ${planUnit.allocationUnit} tidak kompatibel dengan tipe instrumen ${instrument.type}.`,
            source: 'DETERMINISTIC',
          });
        }
      }
    }

    // Check planned count vs actual count
    const expectedCount = planUnit.recommendedCount || 1;
    let actualCount = 0;
    for (const bpItem of matchingBpItems) {
      const inst =
        pkg.instruments.find((i) => i.id === bpItem.instrumentId) ||
        pkg.instruments.find((i) => i.type === bpItem.instrumentType) ||
        pkg.instruments[0];
      if (inst) {
        if (inst.type === 'WRITTEN_TEST' && 'items' in inst && Array.isArray((inst as any).items)) {
          actualCount += ((inst as any).items as any[]).filter(
            (item) => item.blueprintItemId === bpItem.id || item.coverageUnitId === planUnit.id || bpItem.instrumentItemIds?.includes(item.id)
          ).length;
        } else if (inst.type === 'OBSERVATION' && 'aspects' in inst && Array.isArray((inst as any).aspects)) {
          actualCount += ((inst as any).aspects as any[]).length;
        } else {
          actualCount += 1;
        }
      }
    }

    if (actualCount === 0) {
      actualCount = matchingBpItems.length;
    }

    if (actualCount !== expectedCount) {
      findings.push({
        code: 'COVERAGE_COUNT_MISMATCH',
        status: 'REVIEW',
        severity: 'REVIEW',
        coverageUnitId: planUnit.id,
        message: `Jumlah item/tugas tergenerasi (${actualCount}) tidak sama dengan rencana (${expectedCount}).`,
        source: 'DETERMINISTIC',
      });
    }
  }

  // 2. Check for unexpected coverage units in package
  for (const bpItem of pkg.blueprintItems) {
    if (bpItem.coverageUnitId && !planUnitsMap.has(bpItem.coverageUnitId)) {
      findings.push({
        code: 'UNEXPECTED_COVERAGE_UNIT',
        status: 'REVIEW',
        severity: 'REVIEW',
        blueprintItemId: bpItem.id,
        message: `Item kisi-kisi (${bpItem.id}) merujuk unit cakupan (${bpItem.coverageUnitId}) yang tidak ada dalam rencana.`,
        source: 'DETERMINISTIC',
      });
    }
  }

  // Aggregate status
  const hasFail = findings.some((f) => f.status === 'FAIL');
  const hasReview = findings.some((f) => f.status === 'REVIEW');
  const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

  return {
    status,
    findings,
  };
}

function checkAllocationSemantics(
  allocationUnit: 'ITEM' | 'TASK' | 'EVIDENCE' | 'OBSERVATION',
  instrumentType: string
): boolean {
  switch (allocationUnit) {
    case 'ITEM':
      return instrumentType === 'WRITTEN_TEST';
    case 'TASK':
      return ['PERFORMANCE', 'PROJECT', 'PRODUCT', 'ASSIGNMENT'].includes(instrumentType);
    case 'EVIDENCE':
      return instrumentType === 'PORTFOLIO';
    case 'OBSERVATION':
      return instrumentType === 'OBSERVATION';
    default:
      return true;
  }
}
