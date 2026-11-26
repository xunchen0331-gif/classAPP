import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shuffle,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Users,
  Undo2,
  Trash2,
  Check,
} from 'lucide-react';
import { DrawRecord, Student } from '../types';
import { playRollTick, playWinnerChime } from '../utils/sound';

interface RandomPickerProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (allow: boolean) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  drawnHistory: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onReturnStudentToPool: (recordId: string) => void;
  onResetRound: () => void;
  onTogglePresent: (studentId: string) => void;
  onOpenImportModal: () => void;
  onLoadSample: () => void;
}

const CONFETTI_PARTICLES = [
  { angle: -155, distance: 118, color: '#2563EB', size: 8, shape: 'circle' },
  { angle: -130, distance: 138, color: '#059669', size: 7, shape: 'square' },
  { angle: -102, distance: 126, color: '#D97706', size: 8, shape: 'circle' },
  { angle: -78, distance: 132, color: '#2563EB', size: 7, shape: 'square' },
  { angle: -50, distance: 140, color: '#E11D48', size: 8, shape: 'circle' },
  { angle: -25, distance: 120, color: '#059669', size: 7, shape: 'square' },
  { angle: 25, distance: 124, color: '#D97706', size: 8, shape: 'circle' },
  { angle: 55, distance: 136, color: '#2563EB', size: 7, shape: 'square' },
  { angle: 125, distance: 134, color: '#E11D48', size: 8, shape: 'circle' },
  { angle: 155, distance: 118, color: '#059669', size: 7, shape: 'square' },
];

export const RandomPicker: React.FC<RandomPickerProps> = ({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  soundEnabled,
  onToggleSound,
  drawnHistory,
  onRecordDraw,
  onReturnStudentToPool,
  onResetRound,
  onTogglePresent,
  onOpenImportModal,
  onLoadSample,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [rollingIndex, setRollingIndex] = useState(0);
  const [rollingDisplayList, setRollingDisplayList] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [showPoolList, setShowPoolList] = useState(false);

  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const presentStudents = students.filter((s) => s.present);
  const drawnIdsSet = new Set(drawnHistory.map((r) => r.studentId));
  const availablePool = allowRepeat
    ? presentStudents
    : presentStudents.filter((s) => !drawnIdsSet.has(s.id));

  const isPoolExhausted = presentStudents.length > 0 && !allowRepeat && availablePool.length === 0;

  const startDraw = useCallback(() => {
    if (isRolling || availablePool.length === 0) return;

    // Pick true random winner upfront using crypto if available
    let randomIdx = Math.floor(Math.random() * availablePool.length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      randomIdx = arr[0] % availablePool.length;
    }
    const winner = availablePool[randomIdx];

    // If only 1 candidate left, reveal swiftly with a crisp single tick + chime
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || availablePool.length === 1) {
      setSelectedStudent(winner);
      setRevealKey((k) => k + 1);
      onRecordDraw(winner);
      if (soundEnabled) {
        playWinnerChime();
      }
      return;
    }

    // Build a smooth rolling sequence ending on winner
    const totalSteps = 22;
    const sequence: Student[] = [];
    for (let i = 0; i < totalSteps - 1; i++) {
      // Avoid consecutive duplicates for cleaner visual rolling
      const prev = sequence[i - 1];
      let candidate = availablePool[Math.floor(Math.random() * availablePool.length)];
      if (availablePool.length > 1 && prev && candidate.id === prev.id) {
        const alt = availablePool.filter((s) => s.id !== prev.id);
        candidate = alt[Math.floor(Math.random() * alt.length)];
      }
      sequence.push(candidate);
    }
    sequence.push(winner);

    setIsRolling(true);
    setSelectedStudent(null);
    setRollingDisplayList(sequence);
    setRollingIndex(0);

    let currentStep = 0;

    const tick = () => {
      if (!isMountedRef.current) return;

      const progress = currentStep / (totalSteps - 1);
      setRollingIndex(currentStep);

      if (soundEnabled) {
        playRollTick(progress);
      }

      if (currentStep >= totalSteps - 1) {
        // Finished rolling! Pause briefly on the final tick then celebrate
        timerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          setIsRolling(false);
          setSelectedStudent(winner);
          setRevealKey((k) => k + 1);
          onRecordDraw(winner);
          if (soundEnabled) {
            playWinnerChime();
          }
        }, 140);
        return;
      }

      currentStep += 1;
      // Cubic ease-out delay: starts around 42ms, slows down smoothly to ~230ms
      const nextProgress = currentStep / (totalSteps - 1);
      const delay = Math.round(42 + Math.pow(nextProgress, 2.6) * 195);
      timerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }, [availablePool, isRolling, onRecordDraw, soundEnabled]);

  // Keyboard shortcut: Spacebar to draw
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Don't hijack space if a modal dialog is open
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      startDraw();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startDraw]);

  const currentRollingStudent = rollingDisplayList[rollingIndex] || availablePool[0];
  const prevRollingStudent =
    rollingIndex > 0 ? rollingDisplayList[rollingIndex - 1] : null;

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">請先匯入學生名單即可開始抽籤</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          支援上傳 CSV 檔案或直接貼上學生姓名，也可以先載入「模擬名單」立即體驗動畫與音效抽籤。
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Main Spotlight Stage */}
      <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 flex flex-col justify-between min-h-[480px]">
        {/* Top unboxed status metadata */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
            <span>
              出席名單{' '}
              <strong className="font-mono-num text-slate-800">{presentStudents.length}</strong> 人
            </span>
            <span aria-hidden="true">·</span>
            <span>
              待抽候選{' '}
              <strong className="font-mono-num text-blue-700">{availablePool.length}</strong> 人
            </span>
            <span aria-hidden="true">·</span>
            <span>
              本輪已抽 <strong className="font-mono-num text-slate-800">{drawnHistory.length}</strong>{' '}
              次
            </span>
            <span aria-hidden="true">·</span>
            <span>{allowRepeat ? '允許重複抽取' : '不重複抽取'}</span>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                <span>音效開啟</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                <span>已靜音</span>
              </>
            )}
          </button>
        </div>

        {/* Center Focal Spotlight */}
        <div className="relative my-8 flex flex-1 flex-col items-center justify-center py-6 text-center select-none">
          {presentStudents.length === 0 ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-700">目前沒有標記為出席的學生</p>
              <p className="text-sm text-slate-500">請在右側或「學生名單」頁面恢復學生出席狀態。</p>
            </div>
          ) : isRolling && currentRollingStudent ? (
            <div className="w-full max-w-lg space-y-4">
              <p className="text-xs font-medium tracking-wide text-blue-600">正在隨機抽選中</p>
              <div className="relative mx-auto flex h-36 sm:h-44 flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-50/90 px-6">
                {prevRollingStudent && (
                  <div className="text-base font-medium text-slate-300 transition-opacity duration-75 truncate max-w-full">
                    {prevRollingStudent.name}
                  </div>
                )}
                <motion.div
                  key={`${currentRollingStudent.id}-${rollingIndex}`}
                  initial={{ y: 18, opacity: 0.4, scale: 0.94 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.08, ease: 'easeOut' }}
                  className="my-1 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900"
                >
                  {currentRollingStudent.name}
                </motion.div>
                {currentRollingStudent.seatNo && (
                  <div className="font-mono-num text-xs text-slate-400">
                    座號 {currentRollingStudent.seatNo}
                  </div>
                )}
              </div>
            </div>
          ) : selectedStudent ? (
            <div className="relative w-full max-w-lg py-4">
              {/* Celebratory particle burst */}
              <div
                key={`burst-${revealKey}`}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                {CONFETTI_PARTICLES.map((p, idx) => {
                  const rad = (p.angle * Math.PI) / 180;
                  const tx = Math.cos(rad) * p.distance;
                  const ty = Math.sin(rad) * p.distance;
                  return (
                    <motion.span
                      key={idx}
                      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                      animate={{ x: tx, y: ty, scale: [0, 1.2, 0.7], opacity: [1, 1, 0] }}
                      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: p.shape === 'circle' ? '9999px' : '2px',
                      }}
                      className="absolute block"
                    />
                  );
                })}
              </div>

              <motion.div
                key={`winner-${revealKey}`}
                initial={{ scale: 0.86, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                className="relative space-y-3"
              >
                <p className="text-sm font-semibold text-blue-600">中選學生</p>
                <div
                  className="font-display font-extrabold tracking-tight text-slate-900 leading-tight"
                  style={{ fontSize: 'clamp(2.75rem, 6vw, 4.75rem)' }}
                >
                  {selectedStudent.name}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  {selectedStudent.seatNo && (
                    <>
                      <span className="font-mono-num">座號 {selectedStudent.seatNo}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="font-mono-num">第 {drawnHistory.length} 次抽出</span>
                </div>
              </motion.div>
            </div>
          ) : isPoolExhausted ? (
            <div className="space-y-3 max-w-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">本輪全班學生皆已抽完</h2>
              <p className="text-sm text-slate-500">
                目前設定為「不重複抽取」，您可以重設本輪紀錄重新開始，或切換為「允許重複抽取」。
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <p className="text-sm font-medium text-slate-500">準備就緒</p>
              <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-800">
                點擊下方按鈕開始抽籤
              </div>
              <p className="text-sm text-slate-400">
                可搭配鍵盤空白鍵（Space）快速啟動
              </p>
            </div>
          )}
        </div>

        {/* Bottom Primary CTA Controls */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
          {isPoolExhausted ? (
            <button
              type="button"
              onClick={() => {
                setSelectedStudent(null);
                onResetRound();
              }}
              className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-5 w-5" />
              重新開始本輪抽籤
            </button>
          ) : (
            <button
              type="button"
              disabled={isRolling || availablePool.length === 0}
              onClick={startDraw}
              className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-9 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
            >
              <Shuffle className={`h-5 w-5 ${isRolling ? 'animate-spin' : ''}`} />
              {isRolling
                ? '抽籤進行中...'
                : selectedStudent
                ? '再抽下一位'
                : '開始隨機抽籤'}
            </button>
          )}

          {!allowRepeat && drawnHistory.length > 0 && !isPoolExhausted && (
            <button
              type="button"
              disabled={isRolling}
              onClick={() => {
                setSelectedStudent(null);
                onResetRound();
              }}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              重設本輪
            </button>
          )}
        </div>
      </section>

      {/* Right: Control & History Deck */}
      <aside className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        {/* Mode Settings */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">抽籤規則設定</h2>
            <p className="text-xs text-slate-500 mt-0.5">控制已抽中的學生是否會再次被抽出</p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              disabled={isRolling}
              onClick={() => onChangeAllowRepeat(false)}
              className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                !allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              不重複抽取
            </button>
            <button
              type="button"
              disabled={isRolling}
              onClick={() => onChangeAllowRepeat(true)}
              className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              允許重複抽取
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowPoolList((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showPoolList ? '收合待抽候選名單' : `查看待抽名單（${availablePool.length} 人）`}
            </button>

            {soundEnabled && (
              <button
                type="button"
                onClick={() => playWinnerChime()}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                試聽音效
              </button>
            )}
          </div>

          {showPoolList && (
            <div className="max-h-48 overflow-y-auto border-t border-slate-100 pt-3">
              <p className="mb-2 text-[11px] text-slate-400">
                點擊學生姓名可切換出席／請假狀態
              </p>
              <div className="flex flex-wrap gap-1.5">
                {students.map((stu) => {
                  const isDrawn = !allowRepeat && drawnIdsSet.has(stu.id);
                  return (
                    <button
                      key={stu.id}
                      type="button"
                      disabled={isRolling}
                      onClick={() => onTogglePresent(stu.id)}
                      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                        !stu.present
                          ? 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                          : isDrawn
                          ? 'border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {stu.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Drawn History */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              本輪已抽出名單{' '}
              <span className="font-mono-num font-medium text-slate-500">
                ({drawnHistory.length})
              </span>
            </h2>
            {drawnHistory.length > 0 && (
              <button
                type="button"
                disabled={isRolling}
                onClick={() => {
                  setSelectedStudent(null);
                  onResetRound();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清除紀錄
              </button>
            )}
          </div>

          {drawnHistory.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              尚未抽出學生，抽籤結果將會依序記錄於此。
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {drawnHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono-num text-xs text-slate-400 w-6 shrink-0">
                      {String(record.roundOrder).padStart(2, '0')}
                    </span>
                    <span className="font-semibold text-slate-800 truncate">
                      {record.studentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num text-xs text-slate-400">
                      {record.drawnAt}
                    </span>
                    {!allowRepeat && (
                      <button
                        type="button"
                        disabled={isRolling}
                        onClick={() => onReturnStudentToPool(record.id)}
                        title="將此學生放回待抽名單"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
