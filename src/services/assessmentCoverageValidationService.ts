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

  // 1. Check each planned coverage unit against package using CANONICAL coverageUnitId ONLY (BLOCKER 3)
  for (const planUnit of generationPlan.coverageUnits) {
    // Exact coverageUnitId match ONLY. No fallback to objectiveRefId/criterionId!
    const matchingBpItems = pkg.blueprintItems.filter((bp) => bp.coverageUnitId === planUnit.id);

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

    // Validate matching blueprint items against planned objective and criterion
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

      // Resolve instrument deterministically (BLOCKER 4 - NO FIRST-MATCH FALLBACK)
      const res = resolveInstrumentForBlueprintItem(bpItem, pkg.instruments);

      if (res.error === 'AMBIGUOUS_INSTRUMENT_LINKAGE') {
        findings.push({
          code: 'AMBIGUOUS_INSTRUMENT_LINKAGE',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Terdapat lebih dari satu instrumen bertipe ${bpItem.instrumentType} tanpa keterkaitan ID yang unik.`,
          source: 'DETERMINISTIC',
        });
      } else if (res.error === 'DANGLING_BLUEPRINT_INSTRUMENT' || res.error === 'MISSING_INSTRUMENT') {
        findings.push({
          code: 'INSTRUMENT_TYPE_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Instrumen terencana bertipe ${planUnit.instrumentType} tidak ditemukan atau merujuk ID instrumen yang hilang.`,
          source: 'DETERMINISTIC',
        });
      } else if (res.instrument) {
        const instrument = res.instrument;
        if (instrument.type !== planUnit.instrumentType) {
          findings.push({
            code: 'INSTRUMENT_TYPE_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            coverageUnitId: planUnit.id,
            blueprintItemId: bpItem.id,
            instrumentId: instrument.id,
            message: `Tipe instrumen (${instrument.type}) tidak sesuai dengan yang direncanakan (${planUnit.instrumentType}).`,
            source: 'DETERMINISTIC',
          });
        }

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

    // BLOCKER 5: Check planned count vs actual count ONLY if recommendedCount is defined
    if (planUnit.recommendedCount !== undefined) {
      const expectedCount = planUnit.recommendedCount;
      let actualCount = 0;

      for (const bpItem of matchingBpItems) {
        const res = resolveInstrumentForBlueprintItem(bpItem, pkg.instruments);
        const inst = res.instrument;
        if (inst) {
          if (inst.type === 'WRITTEN_TEST' && 'items' in inst && Array.isArray((inst as any).items)) {
            const count = ((inst as any).items as any[]).filter(
              (item) =>
                item.blueprintItemId === bpItem.id ||
                item.coverageUnitId === planUnit.id ||
                bpItem.instrumentItemIds?.includes(item.id)
            ).length;
            actualCount += count > 0 ? count : (matchingBpItems.length === 1 ? (inst as any).items.length : 1);
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
  }

  // 2. Check for missing or unexpected coverage units in package blueprint items
  for (const bpItem of pkg.blueprintItems) {
    if (!bpItem.coverageUnitId) {
      findings.push({
        code: 'MISSING_BLUEPRINT_COVERAGE_UNIT_ID',
        status: 'FAIL',
        severity: 'BLOCKING',
        blueprintItemId: bpItem.id,
        message: `Item kisi-kisi (${bpItem.id}) tidak memiliki coverageUnitId yang valid.`,
        source: 'DETERMINISTIC',
      });
    } else if (!planUnitsMap.has(bpItem.coverageUnitId)) {
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

function resolveInstrumentForBlueprintItem(
  bpItem: any,
  instruments: any[]
): { instrument?: any; error?: 'DANGLING_BLUEPRINT_INSTRUMENT' | 'AMBIGUOUS_INSTRUMENT_LINKAGE' | 'MISSING_INSTRUMENT' } {
  if (!instruments || instruments.length === 0) {
    return { error: 'MISSING_INSTRUMENT' };
  }

  if (bpItem.instrumentId) {
    const found = instruments.find((i) => i.id === bpItem.instrumentId);
    if (!found) {
      return { error: 'DANGLING_BLUEPRINT_INSTRUMENT' };
    }
    return { instrument: found };
  }

  // 1. Try item-level linkage first
  const itemLinked = instruments.filter((inst) => {
    if ('items' in inst && Array.isArray((inst as any).items)) {
      return (inst as any).items.some(
        (item: any) =>
          item.blueprintItemId === bpItem.id ||
          (bpItem.coverageUnitId && item.coverageUnitId === bpItem.coverageUnitId) ||
          (Array.isArray(bpItem.instrumentItemIds) && bpItem.instrumentItemIds.includes(item.id))
      );
    }
    return false;
  });

  if (itemLinked.length === 1) {
    return { instrument: itemLinked[0] };
  } else if (itemLinked.length > 1) {
    return { error: 'AMBIGUOUS_INSTRUMENT_LINKAGE' };
  }

  // 2. Try type matching
  if (bpItem.instrumentType) {
    const typeMatches = instruments.filter((i) => i.type === bpItem.instrumentType);
    if (typeMatches.length === 1) {
      return { instrument: typeMatches[0] };
    } else if (typeMatches.length > 1) {
      return { error: 'AMBIGUOUS_INSTRUMENT_LINKAGE' };
    }
  }

  return { error: 'MISSING_INSTRUMENT' };
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
