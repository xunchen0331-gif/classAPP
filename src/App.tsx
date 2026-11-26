import { useState, useEffect, useCallback } from 'react';
import { AppTab, DrawRecord, RemainderStrategy, Student, StudentGroup } from './types';
import { createSampleRoster, createStudentId } from './utils/csvParser';
import { RandomPicker } from './components/RandomPicker';
import { GroupGenerator } from './components/GroupGenerator';
import { RosterManager } from './components/RosterManager';
import { ImportRosterModal } from './components/ImportRosterModal';

const STORAGE_KEY_STUDENTS = 'classroom_tool_students_v1';
const STORAGE_KEY_SETTINGS = 'classroom_tool_settings_v1';

interface PersistedSettings {
  allowRepeat: boolean;
  soundEnabled: boolean;
  groupSize: number;
  remainderStrategy: RemainderStrategy;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  allowRepeat: false,
  soundEnabled: true,
  groupSize: 4,
  remainderStrategy: 'distribute',
};

function loadStudentsFromStorage(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Ignore storage read errors
  }
  return [];
}

function loadSettingsFromStorage(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('picker');
  const [students, setStudents] = useState<Student[]>(() => loadStudentsFromStorage());
  const [settings, setSettings] = useState<PersistedSettings>(() => loadSettingsFromStorage());
  const [drawnHistory, setDrawnHistory] = useState<DrawRecord[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    } catch {
      // Ignore quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  }, [settings]);

  const handleImportStudents = useCallback(
    (incoming: Student[], mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        setStudents(incoming);
        setDrawnHistory([]);
        setGroups([]);
      } else {
        setStudents((prev) => [...prev, ...incoming]);
      }
    },
    []
  );

  const handleLoadSample = useCallback(() => {
    const sample = createSampleRoster();
    setStudents(sample);
    setDrawnHistory([]);
    setGroups([]);
  }, []);

  const handleAddStudent = useCallback((name: string, seatNo?: string) => {
    setStudents((prev) => [
      ...prev,
      {
        id: createStudentId(),
        name,
        seatNo,
        present: true,
      },
    ]);
  }, []);

  const handleRemoveStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setDrawnHistory((prev) => prev.filter((r) => r.studentId !== id));
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, members: g.members.filter((m) => m.id !== id) }))
        .filter((g) => g.members.length > 0)
    );
  }, []);

  const handleTogglePresent = useCallback((id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, present: !s.present } : s))
    );
  }, []);

  const handleMarkAllPresent = useCallback(() => {
    setStudents((prev) => prev.map((s) => ({ ...s, present: true })));
  }, []);

  const handleUpdateStudentName = useCallback((id: string, name: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    setDrawnHistory((prev) =>
      prev.map((r) => (r.studentId === id ? { ...r, studentName: name } : r))
    );
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        members: g.members.map((m) => (m.id === id ? { ...m, name } : m)),
      }))
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setStudents([]);
    setDrawnHistory([]);
    setGroups([]);
  }, []);

  const handleRecordDraw = useCallback((student: Student) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    setDrawnHistory((prev) => [
      {
        id: createStudentId(),
        studentId: student.id,
        studentName: student.name,
        drawnAt: timeStr,
        roundOrder: prev.length + 1,
      },
      ...prev,
    ]);
  }, []);

  const handleReturnStudentToPool = useCallback((recordId: string) => {
    setDrawnHistory((prev) => prev.filter((r) => r.id !== recordId));
  }, []);

  const handleResetRound = useCallback(() => {
    setDrawnHistory([]);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-16">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('picker');
            }}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            課堂抽籤分組
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="flex items-center gap-4 sm:gap-7 text-sm font-medium" aria-label="主要功能導覽">
            <button
              type="button"
              onClick={() => setActiveTab('picker')}
              className={`relative py-5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'picker'
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              隨機抽籤
              {activeTab === 'picker' && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`relative py-5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'groups'
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              自動分組
              {activeTab === 'groups' && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`relative py-5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'roster'
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              學生名單{students.length > 0 ? ` (${students.length})` : ''}
              {activeTab === 'roster' && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="rounded-lg bg-slate-900 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              匯入名單
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'picker' && (
          <RandomPicker
            students={students}
            allowRepeat={settings.allowRepeat}
            onChangeAllowRepeat={(allow) =>
              setSettings((prev) => ({ ...prev, allowRepeat: allow }))
            }
            soundEnabled={settings.soundEnabled}
            onToggleSound={() =>
              setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
            }
            drawnHistory={drawnHistory}
            onRecordDraw={handleRecordDraw}
            onReturnStudentToPool={handleReturnStudentToPool}
            onResetRound={handleResetRound}
            onTogglePresent={handleTogglePresent}
            onOpenImportModal={() => setIsImportOpen(true)}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'groups' && (
          <GroupGenerator
            students={students}
            groups={groups}
            groupSize={settings.groupSize}
            remainderStrategy={settings.remainderStrategy}
            soundEnabled={settings.soundEnabled}
            onChangeGroupSize={(size) =>
              setSettings((prev) => ({ ...prev, groupSize: size }))
            }
            onChangeRemainderStrategy={(strategy) =>
              setSettings((prev) => ({ ...prev, remainderStrategy: strategy }))
            }
            onUpdateGroups={setGroups}
            onOpenImportModal={() => setIsImportOpen(true)}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'roster' && (
          <RosterManager
            students={students}
            onAddStudent={handleAddStudent}
            onRemoveStudent={handleRemoveStudent}
            onTogglePresent={handleTogglePresent}
            onUpdateStudentName={handleUpdateStudentName}
            onClearAll={handleClearAll}
            onLoadSample={handleLoadSample}
            onOpenImportModal={() => setIsImportOpen(true)}
            onMarkAllPresent={handleMarkAllPresent}
          />
        )}
      </main>

      {/* Import Modal */}
      <ImportRosterModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingCount={students.length}
        onImport={handleImportStudents}
        onLoadSample={handleLoadSample}
      />
    </div>
  );
}
