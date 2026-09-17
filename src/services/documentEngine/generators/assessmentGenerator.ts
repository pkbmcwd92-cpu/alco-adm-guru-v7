import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  HeadingLevel,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
} from '../docxStyles';
import {
  validateAssessmentPackage,
} from '../../assessmentPackageService';
import {
  AssessmentPackage,
  WrittenAssessmentInstrument,
  ObservationAssessmentInstrument,
  PerformanceAssessmentInstrument,
} from '../../../types';

export async function generateAssessment(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, tp, k13Analysis, assessmentCriteria } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // Helper Section Heading
  const addSectionHeading = (title: string) => {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );
  };

  // Header
  docChildren.push(
    ...createDocumentHeader(
      isBlankMode ? 'PANDUAN, INSTRUMEN ASESMEN & RUBRIK PENILAIAN (FORMAT KOSONG)' : 'PANDUAN, INSTRUMEN ASESMEN & RUBRIK PENILAIAN',
      `${academicSetting.curriculum} — ${academicSetting.subject} ${academicSetting.grade}`
    )
  );

  // Identity Metadata
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  if (isBlankMode) {
    // BLANK TEMPLATE MODE (10 blank print rows, zero fake data)
    addSectionHeading('I. KISI-KISI ASESMEN PEMBELAJARAN (IKTP & TEKNIK PENILAIAN)');
    const kisiHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6),
        createTableHeaderCell('Kode & Tujuan Pembelajaran', 34, AlignmentType.LEFT),
        createTableHeaderCell('Indikator Asesmen', 30, AlignmentType.LEFT),
        createTableHeaderCell('Teknik Asesmen', 15),
        createTableHeaderCell('Bentuk Instrumen', 15),
      ],
    });

    const kisiBlankRows = Array.from({ length: 10 }, (_, idx) =>
      new TableRow({
        children: [
          createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell('..........................................................................................', 34),
          createTableDataCell('..........................................................................................', 30),
          createTableDataCell('....................', 15, AlignmentType.CENTER),
          createTableDataCell('....................', 15, AlignmentType.CENTER),
        ],
      })
    );
    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [kisiHeader, ...kisiBlankRows] }));

    // Blank Instruments
    addSectionHeading('II. INSTRUMEN ASESMEN (FORMAT KOSONG)');
    const instHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6),
        createTableHeaderCell('Nama Peserta Didik', 30, AlignmentType.LEFT),
        createTableHeaderCell('Aspek / Indikator 1', 16),
        createTableHeaderCell('Aspek / Indikator 2', 16),
        createTableHeaderCell('Aspek / Indikator 3', 16),
        createTableHeaderCell('Catatan Kejadian', 16, AlignmentType.LEFT),
      ],
    });
    const instBlankRows = Array.from({ length: 10 }, (_, idx) =>
      new TableRow({
        children: [
          createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell(`${idx + 1}. ........................................`, 30),
          createTableDataCell('', 16),
          createTableDataCell('', 16),
          createTableDataCell('', 16),
          createTableDataCell('', 16),
        ],
      })
    );
    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [instHeader, ...instBlankRows] }));

    // Blank Rubric
    addSectionHeading('III. RUBRIK PENILAIAN (FORMAT KOSONG)');
    const rubHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('Kriteria', 25),
        createTableHeaderCell('Skala 1', 18),
        createTableHeaderCell('Skala 2', 18),
        createTableHeaderCell('Skala 3', 18),
        createTableHeaderCell('Skala 4', 21),
      ],
    });
    const rubBlankRows = Array.from({ length: 4 }, (_, idx) =>
      new TableRow({
        children: [
          createTableDataCell(`Kriteria ${idx + 1}: ....................`, 25),
          createTableDataCell('....................', 18),
          createTableDataCell('....................', 18),
          createTableDataCell('....................', 18),
          createTableDataCell('....................', 21),
        ],
      })
    );
    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [rubHeader, ...rubBlankRows] }));
  } else {
    // CANONICAL DATA MODE
    // Locate active canonical AssessmentPackage
    let pkg: AssessmentPackage | undefined;
    if (context.activeAssessmentPackageId && context.assessmentPackages) {
      pkg = context.assessmentPackages.find((p) => p.id === context.activeAssessmentPackageId);
    } else if (context.assessmentPackages && context.assessmentPackages.length > 0) {
      pkg = context.assessmentPackages.find((p) => p.workflowStatus === 'SIAP') || context.assessmentPackages[0];
    }

    if (!pkg) {
      throw new Error('Dokumen Asesmen tidak dapat dicetak: Perangkat Asesmen (AssessmentPackage) belum tersedia.');
    }

    // Validate Package
    const parentPlan = context.assessmentPlans?.find((p) => p.id === pkg!.assessmentPlanId);
    const validation = validateAssessmentPackage(pkg, {
      academicSetting,
      assessmentPlan: parentPlan,
      tp,
      k13Analysis,
      assessmentCriteria,
    });

    if (!validation.valid || pkg.workflowStatus !== 'SIAP') {
      throw new Error(
        `Dokumen Asesmen tidak dapat dicetak: Perangkat Asesmen "${pkg.title}" belum berstatus SIAP. Alasan: ${validation.errors.join('; ')}`
      );
    }

    // I. KISI-KISI ASESMEN (from pkg.blueprintItems)
    addSectionHeading('I. KISI-KISI ASESMEN PEMBELAJARAN');
    const kisiHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6),
        createTableHeaderCell('Tujuan Pembelajaran (TP/KD)', 34, AlignmentType.LEFT),
        createTableHeaderCell('Indikator Asesmen', 30, AlignmentType.LEFT),
        createTableHeaderCell('Lingkup Materi', 15),
        createTableHeaderCell('Bentuk Instrumen', 15),
      ],
    });

    // Map objectives lookup
    const tpMap = new Map((tp?.items || []).map((item) => [item.id, item]));
    const k13Map = new Map((k13Analysis?.items || []).map((item) => [item.id, item]));

    const kisiRows = pkg.blueprintItems.map((bp, idx) => {
      let tpText = bp.objectiveRefId;
      if (tpMap.has(bp.objectiveRefId)) {
        const item = tpMap.get(bp.objectiveRefId)!;
        tpText = `[${item.code}] ${item.statement}`;
      } else if (k13Map.has(bp.objectiveRefId)) {
        const item = k13Map.get(bp.objectiveRefId)!;
        tpText = `[KD ${item.kd}] ${item.tujuanPembelajaran || item.indikator || ''}`;
      }

      return new TableRow({
        children: [
          createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell(tpText, 34),
          createTableDataCell(bp.assessmentIndicator || '—', 30),
          createTableDataCell(bp.materialOrContext || '—', 15, AlignmentType.CENTER),
          createTableDataCell(bp.instrumentType, 15, AlignmentType.CENTER),
        ],
      });
    });

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [kisiHeader, ...(kisiRows.length > 0 ? kisiRows : [
          new TableRow({
            children: [
              createTableDataCell('—', 6, AlignmentType.CENTER),
              createTableDataCell('Belum ada butir kisi-kisi', 34),
              createTableDataCell('—', 30),
              createTableDataCell('—', 15),
              createTableDataCell('—', 15),
            ],
          })
        ])],
      })
    );

    // II. INSTRUMEN ASESMEN
    addSectionHeading('II. INSTRUMEN ASESMEN');

    if (pkg.instruments.length === 0) {
      docChildren.push(new Paragraph({ children: [new TextRun({ text: 'Belum ada instrumen yang dikonfigurasi.', italics: true, size: 19 })] }));
    } else {
      pkg.instruments.forEach((inst) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({ text: `Instrumen: ${inst.type}`, bold: true, size: 20, font: 'Arial', color: '1E3A8A' }),
            ],
          })
        );

        if (inst.type === 'WRITTEN_TEST') {
          const written = inst as WrittenAssessmentInstrument;
          written.items.forEach((item, itemIdx) => {
            docChildren.push(
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [
                  new TextRun({ text: `${itemIdx + 1}. `, bold: true, size: 19 }),
                  new TextRun({ text: item.prompt, size: 19 }),
                ],
              })
            );
            if (item.options && item.options.length > 0) {
              item.options.forEach((opt) => {
                docChildren.push(
                  new Paragraph({
                    indent: { left: 360 },
                    spacing: { after: 20 },
                    children: [
                      new TextRun({ text: `${opt.label}. `, bold: true, size: 19 }),
                      new TextRun({ text: opt.text, size: 19 }),
                    ],
                  })
                );
              });
            }
          });
        } else if (inst.type === 'OBSERVATION') {
          const obs = inst as ObservationAssessmentInstrument;
          const obsHeader = new TableRow({
            tableHeader: true,
            children: [
              createTableHeaderCell('No', 6),
              createTableHeaderCell('Nama Peserta Didik', 34, AlignmentType.LEFT),
              ...obs.aspects.map((asp) => createTableHeaderCell(asp.label, Math.floor(60 / Math.max(obs.aspects.length, 1)))),
            ],
          });

          // 0 students = 0 rows in data mode!
          const actualStudents = context.students || [];
          const obsRows = actualStudents.map((st, idx) =>
            new TableRow({
              children: [
                createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
                createTableDataCell(st.name, 34),
                ...obs.aspects.map(() => createTableDataCell('', Math.floor(60 / Math.max(obs.aspects.length, 1)))),
              ],
            })
          );

          docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [obsHeader, ...obsRows] }));
        } else if (inst.type === 'PERFORMANCE') {
          const perf = inst as PerformanceAssessmentInstrument;
          docChildren.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: `Tugas/Instruksi: ${perf.task}`, size: 19 })],
            })
          );
        }
      });
    }

    // III. RUBRIK PENILAIAN (from pkg.rubrics)
    addSectionHeading('III. RUBRIK PENILAIAN & KRITERIA KETERCAPAIAN (KKTP)');

    if (pkg.rubrics.length === 0) {
      docChildren.push(new Paragraph({ children: [new TextRun({ text: 'Belum ada rubrik terdaftar.', italics: true, size: 19 })] }));
    } else {
      pkg.rubrics.forEach((rub) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 100, after: 60 },
            children: [new TextRun({ text: rub.title, bold: true, size: 20, color: '1E3A8A' })],
          })
        );

        const rubHeader = new TableRow({
          tableHeader: true,
          children: [
            createTableHeaderCell('Kriteria', 25),
            ...rub.scale.map((sc) => createTableHeaderCell(`${sc.label} (${sc.score || ''})`, Math.floor(75 / Math.max(rub.scale.length, 1)))),
          ],
        });

        const rubRows = rub.criteria.map((crit) =>
          new TableRow({
            children: [
              createTableDataCell(crit.label, 25),
              ...rub.scale.map((sc) => createTableDataCell(sc.descriptor || '', Math.floor(75 / Math.max(rub.scale.length, 1)))),
            ],
          })
        );

        docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [rubHeader, ...rubRows] }));
      });
    }
  }

  // Signoff Block
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = isBlankMode
    ? `[Format_Kosong]_Asesmen_Rubrik_${cleanSubject}_${cleanGrade}.docx`
    : `ASESMEN_DAN_RUBRIK_${cleanSubject}_${cleanGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'ASESMEN',
    title: isBlankMode ? 'Instrumen Asesmen & Rubrik Penilaian (Format Kosong)' : 'Instrumen Asesmen & Rubrik Penilaian',
    fileName,
    blob,
    record: {
      id: `doc-asesmen-${Date.now()}`,
      type: 'ASESMEN',
      title: isBlankMode ? 'Instrumen Asesmen & Rubrik Penilaian (Format Kosong)' : 'Instrumen Asesmen & Rubrik Penilaian',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
