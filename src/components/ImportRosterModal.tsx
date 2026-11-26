import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  X,
  Check,
  AlertCircle,
  Download,
  AlertTriangle,
  Sparkles,
  Users,
} from 'lucide-react';
import { Student } from '../types';
import {
  analyzeCsvTable,
  createStudentId,
  decodeCsvFile,
  ParsedCsvTable,
  parsePastedNames,
} from '../utils/csvParser';

interface ImportRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCount: number;
  onImport: (students: Student[], mode: 'replace' | 'append') => void;
  onLoadSample: () => void;
}

type ImportTab = 'csv' | 'paste';

interface PreviewEntry {
  student: Student;
  isDuplicateOccurrence: boolean; // 2nd+ occurrence of the same name
  hasAnyDuplicate: boolean; // name appears >= 2 times in the list
}

function analyzeDuplicates(students: Student[]): {
  entries: PreviewEntry[];
  duplicateCount: number;
  uniqueStudents: Student[];
} {
  const counts = new Map<string, number>();
  for (const stu of students) {
    const key = stu.name.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const seen = new Set<string>();
  const uniqueStudents: Student[] = [];
  let duplicateCount = 0;

  const entries: PreviewEntry[] = students.map((stu) => {
    const key = stu.name.trim();
    const total = counts.get(key) || 1;
    const isDuplicateOccurrence = seen.has(key);
    if (isDuplicateOccurrence) {
      duplicateCount += 1;
    } else {
      seen.add(key);
      uniqueStudents.push(stu);
    }
    return {
      student: stu,
      isDuplicateOccurrence,
      hasAnyDuplicate: total > 1,
    };
  });

  return { entries, duplicateCount, uniqueStudents };
}

export const ImportRosterModal: React.FC<ImportRosterModalProps> = ({
  isOpen,
  onClose,
  existingCount,
  onImport,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('csv');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // CSV state
  const [fileName, setFileName] = useState<string>('');
  const [csvTable, setCsvTable] = useState<ParsedCsvTable | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [nameCol, setNameCol] = useState<number>(0);
  const [seatCol, setSeatCol] = useState<number | null>(null);
  const [treatFirstAsHeader, setTreatFirstAsHeader] = useState<boolean>(true);
  const [csvDedupApplied, setCsvDedupApplied] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Paste state
  const [pastedText, setPastedText] = useState<string>('');

  const csvRawStudents = useMemo<Student[]>(() => {
    if (!csvTable) return [];
    const results: Student[] = [];
    for (const row of csvTable.rows) {
      const rawName = (row[nameCol] || '').trim();
      if (!rawName) continue;
      const rawSeat = seatCol !== null ? (row[seatCol] || '').trim() : undefined;
      results.push({
        id: createStudentId(),
        name: rawName,
        seatNo: rawSeat || undefined,
        present: true,
      });
    }
    return results;
  }, [csvTable, nameCol, seatCol]);

  const csvStudents = useMemo<Student[]>(() => {
    if (!csvDedupApplied) return csvRawStudents;
    return analyzeDuplicates(csvRawStudents).uniqueStudents;
  }, [csvRawStudents, csvDedupApplied]);

  const pastedStudents = useMemo<Student[]>(() => parsePastedNames(pastedText), [pastedText]);

  const activeStudents = activeTab === 'csv' ? csvStudents : pastedStudents;
  const activeAnalysis = useMemo(() => analyzeDuplicates(activeStudents), [activeStudents]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setCsvError('');
    setCsvDedupApplied(false);
    try {
      const text = await decodeCsvFile(file);
      const analyzed = analyzeCsvTable(text);
      if (analyzed.rows.length === 0 && analyzed.headers.length === 0) {
        setCsvError('檔案內容為空或無法辨識名單，請確認檔案格式。');
        setCsvTable(null);
        return;
      }
      setFileName(file.name);
      setRawCsvText(text);
      setCsvTable(analyzed);
      setNameCol(analyzed.suggestedNameCol);
      setSeatCol(analyzed.suggestedSeatCol);
      setTreatFirstAsHeader(analyzed.hasHeaderRow);
    } catch {
      setCsvError('讀取檔案時發生錯誤，請確認檔案是否為有效的 CSV 或純文字檔。');
    }
  };

  const handleToggleHeader = (checked: boolean) => {
    setTreatFirstAsHeader(checked);
    setCsvDedupApplied(false);
    if (!rawCsvText) return;
    const analyzed = analyzeCsvTable(rawCsvText);
    if (checked && !analyzed.hasHeaderRow) {
      setCsvTable({
        ...analyzed,
        headers: analyzed.rows[0]?.map((h, i) => h || `第 ${i + 1} 欄`) || analyzed.headers,
        rows: analyzed.rows.slice(1),
        hasHeaderRow: true,
      });
    } else if (!checked && analyzed.hasHeaderRow) {
      const fullRows = [analyzed.headers, ...analyzed.rows];
      setCsvTable({
        ...analyzed,
        headers: fullRows[0].map((_, i) => `第 ${i + 1} 欄`),
        rows: fullRows,
        hasHeaderRow: false,
      });
    } else {
      setCsvTable(analyzed);
    }
  };

  const handleRemoveDuplicates = () => {
    if (activeAnalysis.duplicateCount === 0) return;
    if (activeTab === 'csv') {
      setCsvDedupApplied(true);
    } else {
      const uniqueNames = activeAnalysis.uniqueStudents.map((s) => s.name);
      setPastedText(uniqueNames.join('\n'));
    }
  };

  const handleConfirmImport = () => {
    if (activeStudents.length === 0) return;
    onImport(activeStudents, importMode);
    setPastedText('');
    setCsvTable(null);
    setFileName('');
    setRawCsvText('');
    setCsvDedupApplied(false);
    onClose();
  };

  const handleUseSampleRoster = () => {
    onLoadSample();
    onClose();
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      '\uFEFF座號,姓名\n01,陳柏宇\n02,林子晴\n03,黃品睿\n04,張語桐\n05,李承翰\n06,王宥希\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '班級名單範例.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="import-modal-title" className="text-lg font-bold text-slate-900">
              匯入學生名單
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              支援上傳 CSV 檔案（UTF-8 與 Big5）、貼上學生姓名，或載入模擬名單快速體驗
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="關閉視窗"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 pt-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'csv'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              上傳 CSV 檔案
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'paste'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardPaste className="h-4 w-4" />
              貼上學生姓名
            </button>
          </div>

          <button
            type="button"
            onClick={handleUseSampleRoster}
            className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            載入模擬名單（24 人）
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'csv' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                    e.target.value = '';
                  }}
                />
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {fileName ? `已選擇檔案：${fileName}` : '點擊選擇 CSV 檔案，或將檔案拖曳至此處'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  支援 .csv 與 .txt 格式 · 自動偵測姓名欄位與中文字元編碼
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>提示：可直接從 Google 試算表或 Excel 另存為 CSV 後上傳。</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  下載範例 CSV
                </button>
              </div>

              {csvError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {csvTable && csvTable.rows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      姓名欄位
                    </label>
                    <select
                      value={nameCol}
                      onChange={(e) => {
                        setNameCol(Number(e.target.value));
                        setCsvDedupApplied(false);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {csvTable.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      座號／編號欄位（選填）
                    </label>
                    <select
                      value={seatCol === null ? '' : String(seatCol)}
                      onChange={(e) =>
                        setSeatCol(e.target.value === '' ? null : Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">不匯入座號</option>
                      {csvTable.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={treatFirstAsHeader}
                        onChange={(e) => handleToggleHeader(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>第一列為標題列</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="paste-names-textarea" className="text-sm font-medium text-slate-700">
                  貼上或輸入學生姓名
                </label>
                <span className="text-xs text-slate-500 font-mono-num">
                  已辨識 {pastedStudents.length} 位學生
                </span>
              </div>
              <textarea
                id="paste-names-textarea"
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'請貼上學生名單，每行一位學生，或使用逗號、頓號分隔。\n例如：\n陳柏宇\n林子晴\n黃品睿\n張語桐'}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
              <p className="text-xs text-slate-500">
                可直接從 Excel、Word 或 LINE 群組複製姓名清單貼上，系統會自動過濾空白列。
              </p>
            </div>
          )}

          {/* Unified Preview List with Duplicate Detection */}
          {activeStudents.length > 0 && (
            <div className="space-y-3 pt-1">
              {activeAnalysis.duplicateCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      預覽名單發現{' '}
                      <strong className="font-mono-num">{activeAnalysis.duplicateCount}</strong>{' '}
                      筆重複的學生姓名
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveDuplicates}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    一鍵移除重複姓名
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600 flex items-center justify-between border-b border-slate-200">
                  <span>預覽匯入名單</span>
                  <div className="flex items-center gap-2 font-mono-num text-slate-700">
                    <span>共 {activeStudents.length} 筆</span>
                    {activeAnalysis.duplicateCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 font-semibold">
                          重複 {activeAnalysis.duplicateCount} 筆
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {activeAnalysis.entries.map((entry, idx) => (
                        <tr
                          key={entry.student.id}
                          className={
                            entry.hasAnyDuplicate ? 'bg-amber-50/70' : 'bg-white'
                          }
                        >
                          <td className="px-4 py-2 w-14 text-xs text-slate-400 font-mono-num">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          {activeTab === 'csv' && seatCol !== null && (
                            <td className="px-3 py-2 w-20 text-xs text-slate-500 font-mono-num">
                              {entry.student.seatNo || '—'}
                            </td>
                          )}
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {entry.student.name}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {entry.isDuplicateOccurrence ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                重複姓名
                              </span>
                            ) : entry.hasAnyDuplicate ? (
                              <span className="text-xs font-medium text-amber-700/80">
                                首次出現（有重複）
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Mode when existing roster is non-empty */}
          {existingCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
              <span className="text-xs font-medium text-slate-700">
                目前名單已有 <span className="font-mono-num font-semibold">{existingCount}</span> 位學生
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    importMode === 'replace'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  取代現有名單
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    importMode === 'append'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  加入現有名單
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            取消
          </button>
          <button
            type="button"
            disabled={activeStudents.length === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Check className="h-4 w-4" />
            確認匯入{activeStudents.length > 0 ? `（${activeStudents.length} 人）` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
