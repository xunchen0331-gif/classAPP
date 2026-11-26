import React, { useState } from 'react';
import {
  UserPlus,
  Trash2,
  Download,
  Upload,
  Users,
  CheckCircle2,
  UserX,
  RotateCcw,
} from 'lucide-react';
import { Student } from '../types';
import { createStudentId } from '../utils/csvParser';

interface RosterManagerProps {
  students: Student[];
  onAddStudent: (name: string, seatNo?: string) => void;
  onRemoveStudent: (id: string) => void;
  onTogglePresent: (id: string) => void;
  onUpdateStudentName: (id: string, name: string) => void;
  onClearAll: () => void;
  onLoadSample: () => void;
  onOpenImportModal: () => void;
  onMarkAllPresent: () => void;
}

export const RosterManager: React.FC<RosterManagerProps> = ({
  students,
  onAddStudent,
  onRemoveStudent,
  onTogglePresent,
  onUpdateStudentName,
  onClearAll,
  onLoadSample,
  onOpenImportModal,
  onMarkAllPresent,
}) => {
  const [newName, setNewName] = useState('');
  const [newSeatNo, setNewSeatNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const presentCount = students.filter((s) => s.present).length;
  const absentCount = students.length - presentCount;

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.seatNo && s.seatNo.toLowerCase().includes(q))
    );
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddStudent(trimmed, newSeatNo.trim() || undefined);
    setNewName('');
    setNewSeatNo('');
  };

  const handleExportCsv = () => {
    if (students.length === 0) return;
    const rows = ['\uFEFF座號,姓名,出席狀態'];
    students.forEach((s, idx) => {
      const seat = s.seatNo || String(idx + 1).padStart(2, '0');
      const status = s.present ? '出席' : '缺席';
      rows.push(`"${seat}","${s.name.replace(/"/g, '""')}","${status}"`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '班級學生名單.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (stu: Student) => {
    setEditingId(stu.id);
    setEditingValue(stu.name);
  };

  const commitEdit = (id: string) => {
    const trimmed = editingValue.trim();
    if (trimmed) {
      onUpdateStudentName(id, trimmed);
    }
    setEditingId(null);
  };

  // Suppress unused import warning if createStudentId isn't directly needed here
  void createStudentId;

  return (
    <div className="space-y-6">
      {/* Top Toolbar & Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">班級學生名單</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                共 <strong className="font-mono-num text-slate-800">{students.length}</strong> 位學生
              </span>
              <span aria-hidden="true">·</span>
              <span>
                出席 <strong className="font-mono-num text-emerald-700">{presentCount}</strong> 位
              </span>
              {absentCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    請假缺席 <strong className="font-mono-num text-amber-700">{absentCount}</strong> 位
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4" />
              上傳 CSV / 貼上名單
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="h-4 w-4 text-blue-600" />
              載入模擬名單（24 人）
            </button>
            {students.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  匯出 CSV
                </button>
                {absentCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllPresent}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 text-slate-500" />
                    全部設為出席
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  清空名單
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Add Form */}
        <form
          onSubmit={handleAddSubmit}
          className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={newSeatNo}
            onChange={(e) => setNewSeatNo(e.target.value)}
            placeholder="座號（選填）"
            className="sm:w-32 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入學生姓名，例如：王小明"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            新增學生
          </button>
        </form>
      </div>

      {/* Roster Table or Empty State */}
      {students.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">目前尚未建立學生名單</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
            您可以上傳班級 CSV 檔案、直接貼上學生姓名，或先載入「模擬名單」快速體驗抽籤與自動分組功能。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              匯入學生名單
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Users className="h-4 w-4 text-blue-600" />
              載入模擬名單（24 人）
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <p className="text-xs text-slate-500">
              雙擊學生姓名可快速修改；設為「請假缺席」的學生將暫時不參與抽籤與分組。
            </p>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名或座號..."
              className="sm:w-60 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 pl-6 pr-3 w-20">序號</th>
                  <th className="py-3 px-3 w-24">座號</th>
                  <th className="py-3 px-3">學生姓名</th>
                  <th className="py-3 px-3 w-40">出席狀態</th>
                  <th className="py-3 pl-3 pr-6 w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((stu, idx) => (
                  <tr
                    key={stu.id}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      !stu.present ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-2.5 pl-6 pr-3 font-mono-num text-xs text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-xs text-slate-500">
                      {stu.seatNo || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingId === stu.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => commitEdit(stu.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(stu.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full max-w-xs rounded-md border border-blue-500 bg-white px-2.5 py-1 text-sm font-medium text-slate-900 focus:outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onDoubleClick={() => startEdit(stu)}
                          onClick={() => startEdit(stu)}
                          title="點擊修改姓名"
                          className={`text-left font-medium hover:text-blue-600 transition-colors ${
                            stu.present ? 'text-slate-900' : 'text-slate-400 line-through'
                          }`}
                        >
                          {stu.name}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onTogglePresent(stu.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          stu.present
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        {stu.present ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>出席</span>
                          </>
                        ) : (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            <span>請假缺席</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveStudent(stu.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        aria-label={`移除 ${stu.name}`}
                        title="移除此學生"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
