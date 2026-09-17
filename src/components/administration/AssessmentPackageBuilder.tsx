import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  FileSpreadsheet,
  ListOrdered,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Save,
  Layers,
  BookOpen,
} from 'lucide-react';
import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AdministrationWorkspace,
  TPData,
  K13Analysis,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
  AssessmentBlueprintItem,
  AssessmentInstrument,
  WrittenAssessmentInstrument,
  WrittenAssessmentItem,
  WrittenAssessmentOption,
  OralAssessmentInstrument,
  PerformanceAssessmentInstrument,
  ObservationAssessmentInstrument,
  AssignmentAssessmentInstrument,
  ProjectAssessmentInstrument,
  ProductAssessmentInstrument,
  PortfolioAssessmentInstrument,
  SelfPeerAssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  AssessmentRubric,
  RubricCriterion,
  RubricScaleLevel,
  AssessmentInstrumentType,
} from '../../types';
import {
  createEmptyAssessmentPackage,
  validateAssessmentPackage,
  confirmAssessmentPackage,
} from '../../services/assessmentPackageService';
import { isK13, isMerdeka } from '../../services/curriculumRouter';

interface AssessmentPackageBuilderProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  workspace?: AdministrationWorkspace;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  assessmentCriteria?: AssessmentCriterion[];
  assessmentPlans?: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
  onSaveAssessmentPackage: (pkg: AssessmentPackage) => void;
  onDeleteAssessmentPackage?: (pkgId: string) => void;
}

export const AssessmentPackageBuilder: React.FC<AssessmentPackageBuilderProps> = ({
  school,
  profile,
  academicSetting,
  workspace,
  tp,
  k13Analysis,
  assessmentCriteria = [],
  assessmentPlans = [],
  assessmentPackages = [],
  onSaveAssessmentPackage,
  onDeleteAssessmentPackage,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    return assessmentPlans.length > 0 ? assessmentPlans[0].id : '';
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'blueprint' | 'instruments' | 'keys_rubrics' | 'validation'>('overview');
  const [activeInstType, setActiveInstType] = useState<AssessmentInstrumentType | ''>('');

  const selectedPlan = assessmentPlans.find((p) => p.id === selectedPlanId);
  const activePackage = assessmentPackages.find((pkg) => pkg.assessmentPlanId === selectedPlanId);

  // Synchronize default plan selection
  useEffect(() => {
    if (!selectedPlanId && assessmentPlans.length > 0) {
      setSelectedPlanId(assessmentPlans[0].id);
    }
  }, [assessmentPlans, selectedPlanId]);

  // Synchronize active instrument tab
  useEffect(() => {
    if (selectedPlan && selectedPlan.instruments.length > 0) {
      if (!activeInstType || !selectedPlan.instruments.some((i) => i.type === activeInstType)) {
        setActiveInstType(selectedPlan.instruments[0].type);
      }
    }
  }, [selectedPlan, activeInstType]);

  const validationContext = {
    academicSetting,
    assessmentPlan: selectedPlan,
    tp,
    k13Analysis,
    assessmentCriteria,
  };

  const validationResult = activePackage
    ? validateAssessmentPackage(activePackage, validationContext)
    : { valid: false, errors: ['Belum ada Perangkat Asesmen.'], warnings: [] };

  // Helper to handle creation of new empty package
  const handleCreatePackage = () => {
    if (!selectedPlan) return;
    const newPkg = createEmptyAssessmentPackage(selectedPlan, academicSetting.id, workspace?.id);
    onSaveAssessmentPackage(newPkg);
  };

  // Helper to update active package
  const updatePackage = (updated: AssessmentPackage) => {
    onSaveAssessmentPackage({
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // If no AssessmentPlans exist
  if (assessmentPlans.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Rencana Asesmen (Assessment Plan)</h3>
        <p className="text-slate-600 mb-6 text-sm">
          Perangkat Asesmen dibuat berdasarkan Rencana Asesmen yang telah disiapkan. Silakan atur dan konfirmasi Rencana Asesmen terlebih dahulu di tab <strong>Rencana Asesmen</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Selector Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Rencana Asesmen Induk (Parent Plan)
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
          >
            {assessmentPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.displayLabel || plan.title} [{plan.workflowStatus}]
              </option>
            ))}
          </select>
        </div>

        {activePackage && (
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                activePackage.workflowStatus === 'SIAP'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : activePackage.workflowStatus === 'PERLU_DILENGKAPI'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              Status: {activePackage.workflowStatus}
            </span>

            {activePackage.workflowStatus !== 'SIAP' && (
              <button
                onClick={() => {
                  if (!activePackage) return;
                  const res = confirmAssessmentPackage(activePackage, validationContext);
                  onSaveAssessmentPackage(res.package);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Konfirmasi & Tandai SIAP
              </button>
            )}
          </div>
        )}
      </div>

      {/* Review Reason Alert */}
      {activePackage?.needsReview && activePackage.reviewReason && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Perlu Review / Penyesuaian:</span> {activePackage.reviewReason}
          </div>
        </div>
      )}

      {/* No Package Exists State */}
      {!activePackage ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto">
          <FolderPlus className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-slate-800 mb-2">Belum Ada Perangkat Asesmen Untuk Rencana Ini</h4>
          <p className="text-slate-600 text-sm mb-6">
            Rencana Asesmen "{selectedPlan?.displayLabel || selectedPlan?.title}" belum memiliki Perangkat Asesmen (soal, kisi-kisi, rubrik).
          </p>
          <button
            onClick={handleCreatePackage}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm inline-flex items-center gap-2 shadow transition"
          >
            <Plus className="w-4 h-4" />
            Buat Perangkat Asesmen Baru
          </button>
        </div>
      ) : (
        /* Package Editor Active */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Main Navigation Tabs */}
          <div className="border-b border-slate-200 bg-slate-50 flex flex-wrap gap-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              1. Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('blueprint')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'blueprint' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              2. Kisi-Kisi Asesmen ({activePackage.blueprintItems.length})
            </button>
            <button
              onClick={() => setActiveTab('instruments')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'instruments' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              3. Instrumen ({activePackage.instruments.length})
            </button>
            <button
              onClick={() => setActiveTab('keys_rubrics')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'keys_rubrics' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              4. Kunci, Pedoman & Rubrik
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'validation' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${validationResult.valid ? 'text-emerald-600' : 'text-amber-600'}`} />
              5. Validasi Status ({validationResult.errors.length} Error)
            </button>
          </div>

          <div className="p-6">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-base font-bold text-slate-800 mb-3">Informasi Rencana Asesmen Induk</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs">Tujuan Asesmen</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.purpose}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Waktu Pelaksanaan</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.timing}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Cakupan Asesmen</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.scopeType}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Judul Perangkat Asesmen</label>
                  <input
                    type="text"
                    value={activePackage.title}
                    onChange={(e) => updatePackage({ ...activePackage, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <h5 className="text-sm font-bold text-slate-800 mb-2">Daftar Tipe Instrumen Terencana:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlan?.instruments.map((inst) => (
                      <span key={inst.id} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-lg">
                        {inst.label || inst.type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BLUEPRINT (KISI-KISI) */}
            {activeTab === 'blueprint' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-800">Kisi-Kisi Asesmen Pembelajaran</h4>
                  <button
                    onClick={() => {
                      const newBpItem: AssessmentBlueprintItem = {
                        id: `bp-${Date.now()}`,
                        objectiveRefId: '',
                        instrumentType: '',
                        instrumentItemIds: [],
                        order: activePackage.blueprintItems.length + 1,
                        assessmentIndicator: '',
                        materialOrContext: '',
                      };
                      updatePackage({
                        ...activePackage,
                        blueprintItems: [...activePackage.blueprintItems, newBpItem],
                      });
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Baris Kisi-Kisi
                  </button>
                </div>

                {activePackage.blueprintItems.length === 0 ? (
                  <p className="text-slate-500 text-sm italic py-4">Belum ada baris kisi-kisi. Klik tombol Tambah di atas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                          <th className="p-3 text-center w-12">No</th>
                          <th className="p-3 text-left">TP / KD Tujuan</th>
                          <th className="p-3 text-left">Indikator Asesmen</th>
                          <th className="p-3 text-left">Materi / Konteks</th>
                          <th className="p-3 text-left">Bentuk Instrumen</th>
                          <th className="p-3 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activePackage.blueprintItems.map((bp, idx) => (
                          <tr key={bp.id} className="hover:bg-slate-50">
                            <td className="p-3 text-center font-semibold text-slate-600">{idx + 1}</td>
                            <td className="p-3">
                              <select
                                value={bp.objectiveRefId}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, objectiveRefId: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">-- Pilih TP/KD --</option>
                                {isMerdeka(academicSetting)
                                  ? tp?.items?.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        [{item.code}] {item.statement.slice(0, 60)}...
                                      </option>
                                    ))
                                  : k13Analysis?.items?.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        [{item.code}] {item.kdStatement.slice(0, 60)}...
                                      </option>
                                    ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Indikator asesmen (ditulis guru)..."
                                value={bp.assessmentIndicator || ''}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, assessmentIndicator: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Lingkup materi/konteks..."
                                value={bp.materialOrContext || ''}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, materialOrContext: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={bp.instrumentType}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, instrumentType: e.target.value as AssessmentInstrumentType } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              >
                                <option value="">-- Pilih Bentuk Instrumen --</option>
                                {selectedPlan?.instruments.map((i) => (
                                  <option key={i.id} value={i.type}>
                                    {i.label || i.type}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => {
                                  const updated = activePackage.blueprintItems.filter((b) => b.id !== bp.id);
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INSTRUMENTS */}
            {activeTab === 'instruments' && (
              <div className="space-y-6">
                <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                  {selectedPlan?.instruments.map((instRef) => (
                    <button
                      key={instRef.id}
                      onClick={() => setActiveInstType(instRef.type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeInstType === instRef.type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {instRef.label || instRef.type}
                    </button>
                  ))}
                </div>

                {/* WRITTEN TEST EDITOR */}
                {activeInstType === 'WRITTEN_TEST' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Tes Tertulis</h4>
                      <button
                        onClick={() => {
                          let writtenInst = activePackage.instruments.find((i) => i.type === 'WRITTEN_TEST') as WrittenAssessmentInstrument | undefined;
                          const newItem: WrittenAssessmentItem = {
                            id: `item-${Date.now()}`,
                            itemType: 'MULTIPLE_CHOICE',
                            prompt: '',
                            options: [
                              { id: `opt-1-${Date.now()}`, label: 'A', text: '' },
                              { id: `opt-2-${Date.now()}`, label: 'B', text: '' },
                            ],
                            order: writtenInst ? writtenInst.items.length + 1 : 1,
                          };

                          let updatedInstruments = [...activePackage.instruments];
                          if (!writtenInst) {
                            writtenInst = {
                              id: `inst-written-${Date.now()}`,
                              type: 'WRITTEN_TEST',
                              items: [newItem],
                            };
                            updatedInstruments.push(writtenInst);
                          } else {
                            updatedInstruments = updatedInstruments.map((inst) =>
                              inst.type === 'WRITTEN_TEST'
                                ? { ...writtenInst, items: [...writtenInst.items, newItem] }
                                : inst
                            );
                          }
                          updatePackage({ ...activePackage, instruments: updatedInstruments });
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Tambah Soal Tertulis
                      </button>
                    </div>

                    {(() => {
                      const writtenInst = activePackage.instruments.find((i) => i.type === 'WRITTEN_TEST') as WrittenAssessmentInstrument | undefined;
                      if (!writtenInst || writtenInst.items.length === 0) {
                        return <p className="text-slate-500 text-sm italic">Belum ada butir soal tertulis.</p>;
                      }
                      return (
                        <div className="space-y-4">
                          {writtenInst.items.map((item, itemIdx) => (
                            <div key={item.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Soal #{itemIdx + 1}</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={item.itemType}
                                    onChange={(e) => {
                                      const updatedItems = writtenInst!.items.map((it) =>
                                        it.id === item.id ? { ...it, itemType: e.target.value as any } : it
                                      );
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      updatePackage({ ...activePackage, instruments: updatedInstruments });
                                    }}
                                    className="text-xs p-1 border border-slate-300 rounded font-semibold"
                                  >
                                    <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                                    <option value="MULTIPLE_SELECT">Pilihan Ganda Kompleks</option>
                                    <option value="ESSAY">Uraian / Isian</option>
                                  </select>

                                  <button
                                    onClick={() => {
                                      const updatedItems = writtenInst!.items.filter((it) => it.id !== item.id);
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      updatePackage({ ...activePackage, instruments: updatedInstruments });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Pertanyaan / Soal</label>
                                <textarea
                                  value={item.prompt}
                                  onChange={(e) => {
                                    const updatedItems = writtenInst!.items.map((it) =>
                                      it.id === item.id ? { ...it, prompt: e.target.value } : it
                                    );
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                                  rows={2}
                                />
                              </div>

                              {(item.itemType === 'MULTIPLE_CHOICE' || item.itemType === 'MULTIPLE_SELECT') && (
                                <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                                  <label className="block text-xs font-bold text-slate-700">Opsi Jawaban:</label>
                                  {(item.options || []).map((opt) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={opt.isCorrect || false}
                                        onChange={(e) => {
                                          const isCheck = e.target.checked;
                                          const updatedOpts = item.options?.map((o) => {
                                            if (item.itemType === 'MULTIPLE_CHOICE') {
                                              return o.id === opt.id ? { ...o, isCorrect: isCheck } : { ...o, isCorrect: false };
                                            }
                                            return o.id === opt.id ? { ...o, isCorrect: isCheck } : o;
                                          });
                                          const updatedItems = writtenInst!.items.map((it) =>
                                            it.id === item.id ? { ...it, options: updatedOpts } : it
                                          );
                                          const updatedInstruments = activePackage.instruments.map((inst) =>
                                            inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                          );
                                          updatePackage({ ...activePackage, instruments: updatedInstruments });
                                        }}
                                      />
                                      <span className="text-xs font-bold text-slate-600 w-4">{opt.label}.</span>
                                      <input
                                        type="text"
                                        value={opt.text}
                                        onChange={(e) => {
                                          const updatedOpts = item.options?.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o));
                                          const updatedItems = writtenInst!.items.map((it) =>
                                            it.id === item.id ? { ...it, options: updatedOpts } : it
                                          );
                                          const updatedInstruments = activePackage.instruments.map((inst) =>
                                            inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                          );
                                          updatePackage({ ...activePackage, instruments: updatedInstruments });
                                        }}
                                        className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                        placeholder="Teks opsi jawaban..."
                                      />
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      const newOptLabel = String.fromCharCode(65 + (item.options?.length || 0));
                                      const newOpt: WrittenAssessmentOption = {
                                        id: `opt-${Date.now()}`,
                                        label: newOptLabel,
                                        text: '',
                                      };
                                      const updatedOpts = [...(item.options || []), newOpt];
                                      const updatedItems = writtenInst!.items.map((it) =>
                                        it.id === item.id ? { ...it, options: updatedOpts } : it
                                      );
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      updatePackage({ ...activePackage, instruments: updatedInstruments });
                                    }}
                                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 mt-1"
                                  >
                                    + Opsi Jawaban
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* OBSERVATION EDITOR */}
                {activeInstType === 'OBSERVATION' && (
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-slate-800">Lembar Observasi / Pengamatan</h4>
                    <p className="text-xs text-slate-500">Tentukan aspek-aspek pengamatan yang akan dinilai oleh guru.</p>
                    <button
                      onClick={() => {
                        let obsInst = activePackage.instruments.find((i) => i.type === 'OBSERVATION') as ObservationAssessmentInstrument | undefined;
                        const newAspect = { id: `asp-${Date.now()}`, label: '', indicator: '' };

                        let updatedInstruments = [...activePackage.instruments];
                        if (!obsInst) {
                          obsInst = {
                            id: `inst-obs-${Date.now()}`,
                            type: 'OBSERVATION',
                            aspects: [newAspect],
                          };
                          updatedInstruments.push(obsInst);
                        } else {
                          updatedInstruments = updatedInstruments.map((inst) =>
                            inst.type === 'OBSERVATION' ? { ...obsInst, aspects: [...obsInst.aspects, newAspect] } : inst
                          );
                        }
                        updatePackage({ ...activePackage, instruments: updatedInstruments });
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Tambah Aspek Observasi
                    </button>

                    {(() => {
                      const obsInst = activePackage.instruments.find((i) => i.type === 'OBSERVATION') as ObservationAssessmentInstrument | undefined;
                      if (!obsInst || obsInst.aspects.length === 0) {
                        return <p className="text-slate-500 text-sm italic">Belum ada aspek observasi.</p>;
                      }
                      return (
                        <div className="space-y-2">
                          {obsInst.aspects.map((asp, aspIdx) => (
                            <div key={asp.id} className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-200 rounded">
                              <span className="text-xs font-bold text-slate-600">{aspIdx + 1}.</span>
                              <input
                                type="text"
                                value={asp.label}
                                onChange={(e) => {
                                  const updatedAspects = obsInst!.aspects.map((a) => (a.id === asp.id ? { ...a, label: e.target.value } : a));
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.type === 'OBSERVATION' ? { ...obsInst!, aspects: updatedAspects } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Label aspek (misal: Keaktifan Diskusi)..."
                                className="text-xs p-1.5 border border-slate-300 rounded flex-1"
                              />
                              <button
                                onClick={() => {
                                  const updatedAspects = obsInst!.aspects.filter((a) => a.id !== asp.id);
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.type === 'OBSERVATION' ? { ...obsInst!, aspects: updatedAspects } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* OTHER INSTRUMENTS FALLBACK EDITOR */}
                {activeInstType && activeInstType !== 'WRITTEN_TEST' && activeInstType !== 'OBSERVATION' && (
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-slate-800">Pengaturan Instrumen ({activeInstType})</h4>
                    <p className="text-xs text-slate-500">Lengkapi detail dan instruksi instrumen sesuai rencana pembelajaran.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: KEYS, PEDOMAN & RUBRIK */}
            {activeTab === 'keys_rubrics' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-bold text-slate-800 mb-2">Rubrik Penilaian & KKTP</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Tambahkan rubrik kriteria dan skala capaian penilaian.
                  </p>
                  <button
                    onClick={() => {
                      const newRubric: AssessmentRubric = {
                        id: `rubric-${Date.now()}`,
                        title: 'Rubrik Penilaian Kinerja / Produk',
                        criteria: [{ id: `crit-${Date.now()}`, label: 'Kesesuaian dengan TP/KD' }],
                        scale: [
                          { id: `scale-1-${Date.now()}`, label: 'Perlu Bimbingan', score: 1, order: 1, descriptor: '' },
                          { id: `scale-2-${Date.now()}`, label: 'Cukup', score: 2, order: 2, descriptor: '' },
                          { id: `scale-3-${Date.now()}`, label: 'Baik', score: 3, order: 3, descriptor: '' },
                          { id: `scale-4-${Date.now()}`, label: 'Sangat Baik', score: 4, order: 4, descriptor: '' },
                        ],
                      };
                      updatePackage({ ...activePackage, rubrics: [...activePackage.rubrics, newRubric] });
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Tambah Rubrik
                  </button>
                </div>

                {activePackage.rubrics.length === 0 ? (
                  <p className="text-slate-500 text-sm italic">Belum ada rubrik yang dibuat.</p>
                ) : (
                  <div className="space-y-4">
                    {activePackage.rubrics.map((rub) => (
                      <div key={rub.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={rub.title}
                            onChange={(e) => {
                              const updated = activePackage.rubrics.map((r) => (r.id === rub.id ? { ...r, title: e.target.value } : r));
                              updatePackage({ ...activePackage, rubrics: updated });
                            }}
                            className="font-bold text-sm bg-white p-1 border border-slate-300 rounded text-slate-800"
                          />
                          <button
                            onClick={() => {
                              const updated = activePackage.rubrics.filter((r) => r.id !== rub.id);
                              updatePackage({ ...activePackage, rubrics: updated });
                            }}
                            className="text-red-500 hover:text-red-700 p-1 text-xs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-xs">
                          <span className="font-bold text-slate-700">Kriteria Rubrik:</span>
                          {rub.criteria.map((crit) => (
                            <div key={crit.id} className="ml-2 my-1 flex items-center gap-2">
                              <span className="font-semibold text-slate-600">• {crit.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: VALIDATION & STATUS */}
            {activeTab === 'validation' && (
              <div className="space-y-6">
                <div
                  className={`p-4 rounded-xl border ${
                    validationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    <h4 className="font-bold text-base">
                      {validationResult.valid ? 'Perangkat Asesmen Lengkap & Valid' : 'Perangkat Asesmen Belum Lengkap'}
                    </h4>
                  </div>
                  <p className="text-sm">
                    {validationResult.valid
                      ? 'Seluruh komponen perangkat asesmen (kisi-kisi, instrumen, kunci/rubrik) telah terverifikasi valid.'
                      : 'Lengkapi seluruh item bertanda error di bawah ini agar Perangkat Asesmen dapat dikonfirmasi berstatus SIAP.'}
                  </p>
                </div>

                {validationResult.errors.length > 0 && (
                  <div>
                    <h5 className="font-bold text-sm text-red-700 mb-2">Daftar Hal Yang Wajib Perlu Ditingkatkan (Errors):</h5>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div>
                    <h5 className="font-bold text-sm text-amber-700 mb-2">Peringatan / Catatan (Warnings):</h5>
                    <ul className="list-disc list-inside space-y-1 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
