import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Copy,
  Download,
  Check,
  Minus,
  Plus,
  Users,
  Upload,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { RemainderStrategy, Student, StudentGroup } from '../types';
import { playGroupCompleteSound } from '../utils/sound';

interface GroupGeneratorProps {
  students: Student[];
  groups: StudentGroup[];
  groupSize: number;
  remainderStrategy: RemainderStrategy;
  soundEnabled: boolean;
  onChangeGroupSize: (size: number) => void;
  onChangeRemainderStrategy: (strategy: RemainderStrategy) => void;
  onUpdateGroups: (groups: StudentGroup[]) => void;
  onOpenImportModal: () => void;
  onLoadSample: () => void;
}

const GROUP_TOP_BAR_COLORS = [
  '#2563EB', // Cobalt
  '#059669', // Emerald
  '#D97706', // Amber
  '#E11D48', // Rose
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#0D9488', // Teal
];

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      j = buf[0] % (i + 1);
    }
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGroupPlanSummary(
  totalCount: number,
  targetSize: number,
  strategy: RemainderStrategy
): string {
  if (totalCount === 0) return '目前沒有出席學生';
  if (totalCount <= targetSize) return `將分為 1 組（${totalCount} 人）`;

  if (strategy === 'keep_last') {
    const fullCount = Math.floor(totalCount / targetSize);
    const rem = totalCount % targetSize;
    if (rem === 0) {
      return `將分為 ${fullCount} 組，每組 ${targetSize} 人`;
    }
    return `將分為 ${fullCount + 1} 組（${fullCount} 組 ${targetSize} 人、1 組 ${rem} 人）`;
  }

  // Distribute evenly: target group count closest to totalCount / targetSize
  const numGroups = Math.max(1, Math.round(totalCount / targetSize));
  const baseSize = Math.floor(totalCount / numGroups);
  const extraCount = totalCount % numGroups;
  if (extraCount === 0) {
    return `將分為 ${numGroups} 組，每組 ${baseSize} 人`;
  }
  const regularCount = numGroups - extraCount;
  return `將分為 ${numGroups} 組（${regularCount} 組 ${baseSize} 人、${extraCount} 組 ${baseSize + 1} 人）`;
}

export const GroupGenerator: React.FC<GroupGeneratorProps> = ({
  students,
  groups,
  groupSize,
  remainderStrategy,
  soundEnabled,
  onChangeGroupSize,
  onChangeRemainderStrategy,
  onUpdateGroups,
  onOpenImportModal,
  onLoadSample,
}) => {
  const [shuffleKey, setShuffleKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [swapSelection, setSwapSelection] = useState<{
    groupId: string;
    student: Student;
  } | null>(null);

  const presentStudents = useMemo(
    () => students.filter((s) => s.present),
    [students]
  );

  const planSummary = useMemo(
    () => buildGroupPlanSummary(presentStudents.length, groupSize, remainderStrategy),
    [presentStudents.length, groupSize, remainderStrategy]
  );

  const handleGenerateGroups = () => {
    if (presentStudents.length === 0) return;

    const shuffled = fisherYatesShuffle(presentStudents);
    const result: StudentGroup[] = [];

    if (remainderStrategy === 'keep_last') {
      const totalGroups = Math.ceil(shuffled.length / groupSize);
      for (let i = 0; i < totalGroups; i++) {
        const members = shuffled.slice(i * groupSize, (i + 1) * groupSize);
        result.push({
          id: `grp_${i + 1}`,
          index: i + 1,
          name: `第 ${i + 1} 組`,
          members,
        });
      }
    } else {
      const numGroups = Math.max(1, Math.round(shuffled.length / groupSize));
      const baseSize = Math.floor(shuffled.length / numGroups);
      const extra = shuffled.length % numGroups;
      let cursor = 0;

      for (let i = 0; i < numGroups; i++) {
        const count = baseSize + (i < extra ? 1 : 0);
        const members = shuffled.slice(cursor, cursor + count);
        cursor += count;
        result.push({
          id: `grp_${i + 1}`,
          index: i + 1,
          name: `第 ${i + 1} 組`,
          members,
        });
      }
    }

    setSwapSelection(null);
    onUpdateGroups(result);
    setShuffleKey((k) => k + 1);
    if (soundEnabled) {
      playGroupCompleteSound();
    }
  };

  const handleMemberClick = (groupId: string, student: Student) => {
    if (!swapSelection) {
      setSwapSelection({ groupId, student });
      return;
    }

    if (swapSelection.student.id === student.id) {
      setSwapSelection(null);
      return;
    }

    // Swap the two students between their groups (or positions)
    const nextGroups = groups.map((grp) => {
      if (grp.id === swapSelection.groupId && grp.id === groupId) {
        return {
          ...grp,
          members: grp.members.map((m) => {
            if (m.id === swapSelection.student.id) return student;
            if (m.id === student.id) return swapSelection.student;
            return m;
          }),
        };
      }
      if (grp.id === swapSelection.groupId) {
        return {
          ...grp,
          members: grp.members.map((m) =>
            m.id === swapSelection.student.id ? student : m
          ),
        };
      }
      if (grp.id === groupId) {
        return {
          ...grp,
          members: grp.members.map((m) =>
            m.id === student.id ? swapSelection.student : m
          ),
        };
      }
      return grp;
    });

    onUpdateGroups(nextGroups);
    setSwapSelection(null);
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => `${g.name}（${g.members.length}人）：${g.members.map((m) => m.name).join('、')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const rows = ['\uFEFF組別,組內序號,座號,姓名'];
    groups.forEach((g) => {
      g.members.forEach((m, mIdx) => {
        rows.push(
          `"${g.name}","${mIdx + 1}","${m.seatNo || ''}","${m.name.replace(/"/g, '""')}"`
        );
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '課堂分組結果.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">請先匯入學生名單即可自動分組</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          匯入名單後，可自由設定每組人數並即時產生視覺化的分組座位看板，也可先載入「模擬名單」快速體驗。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            上傳 CSV / 貼上名單
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Left settings */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Group Size Stepper & Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                設定每組人數
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
                  <button
                    type="button"
                    onClick={() => onChangeGroupSize(Math.max(2, groupSize - 1))}
                    disabled={groupSize <= 2}
                    aria-label="減少每組人數"
                    className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 rounded-l-xl transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex items-center px-2">
                    <input
                      type="number"
                      min={2}
                      max={Math.max(2, presentStudents.length)}
                      value={groupSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          onChangeGroupSize(Math.min(30, Math.max(2, val)));
                        }
                      }}
                      className="w-10 text-center font-mono-num text-base font-bold text-slate-900 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 pr-1">人</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeGroupSize(Math.min(Math.max(2, presentStudents.length), groupSize + 1))
                    }
                    disabled={groupSize >= Math.max(2, presentStudents.length)}
                    aria-label="增加每組人數"
                    className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 rounded-r-xl transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChangeGroupSize(n)}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium font-mono-num transition-colors whitespace-nowrap shrink-0 ${
                        groupSize === n
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {n}人
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Remainder Strategy */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-600">
                無法整除時餘數處理
              </span>
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => onChangeRemainderStrategy('distribute')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    remainderStrategy === 'distribute'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  平均分配至各組
                </button>
                <button
                  type="button"
                  onClick={() => onChangeRemainderStrategy('keep_last')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    remainderStrategy === 'keep_last'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  最後一組保留餘數
                </button>
              </div>
            </div>
          </div>

          {/* Right Primary & Export Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={presentStudents.length === 0}
              onClick={handleGenerateGroups}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="h-4 w-4" />
              {groups.length > 0 ? '重新隨機分組' : '開始自動分組'}
            </button>

            {groups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>已複製文字</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-500" />
                      <span>複製分組結果</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>下載分組 CSV</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Group Math Summary */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              出席學生 <strong className="font-mono-num text-slate-800">{presentStudents.length}</strong> 人
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700">{planSummary}</span>
          </div>
          {groups.length > 0 && (
            <span className="text-xs text-slate-400">
              提示：依序點擊任兩位學生可手動互換組別
            </span>
          )}
        </div>
      </section>

      {/* Swap Selection Banner */}
      {swapSelection && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-900">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              已選取 <strong>{swapSelection.student.name}</strong>，請點擊另一位學生即可互換組別
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSwapSelection(null)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            取消選取
          </button>
        </div>
      )}

      {/* Visual Group Grid */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-slate-800">
            設定完成後，點擊「開始自動分組」產生分組看板
          </p>
          <p className="mt-1.5 text-sm text-slate-500">{planSummary}</p>
          <button
            type="button"
            disabled={presentStudents.length === 0}
            onClick={handleGenerateGroups}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Shuffle className="h-4 w-4" />
            立即隨機分組
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {groups.map((group, idx) => {
            const accentColor = GROUP_TOP_BAR_COLORS[idx % GROUP_TOP_BAR_COLORS.length];
            return (
              <motion.article
                key={`${group.id}-${shuffleKey}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(idx * 0.04, 0.36),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col"
              >
                {/* Clean top color indicator band */}
                <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

                {/* Group Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                  <span className="font-mono-num text-xs font-medium text-slate-500">
                    {group.members.length} 人
                  </span>
                </div>

                {/* Members List (hairline dividers, no nested cards) */}
                <ul className="divide-y divide-slate-100 flex-1">
                  {group.members.map((member, mIdx) => {
                    const isSelected = swapSelection?.student.id === member.id;
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => handleMemberClick(group.id, member)}
                          className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-900'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                              style={{ backgroundColor: accentColor }}
                            >
                              {member.name.slice(0, 1)}
                            </span>
                            <span className="font-medium truncate">{member.name}</span>
                          </div>
                          <span className="font-mono-num text-xs text-slate-400 shrink-0 ml-2">
                            {member.seatNo ? `#${member.seatNo}` : String(mIdx + 1).padStart(2, '0')}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
