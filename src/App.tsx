import React, { useState } from 'react';
import { Sidebar, AppPage } from './components/Sidebar';
import TestAssigner from './components/TestAssigner';
import { ExamList } from './components/ExamList';
import { ExamGrader } from './components/ExamGrader';
import { SettingsPanel } from './components/SettingsPanel';
import { ExamDefinition } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>('staff');
  const [selectedExam, setSelectedExam] = useState<ExamDefinition | null>(null);

  return (
    <div className="h-screen bg-background text-foreground flex font-sans selection:bg-primary/20 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={(page) => { setCurrentPage(page); setSelectedExam(null); }} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Manage Staff — filter/browse employees, open user profile */}
        {currentPage === 'staff' && <TestAssigner mode="directory" />}

        {/* Test Assigner — assign/unassign curricula */}
        {currentPage === 'assign' && <TestAssigner mode="assign" />}

        {/* Grade Exam */}
        {currentPage === 'grade' && (
          <div className="flex-1 overflow-y-auto">
            {selectedExam ? (
              <div className="max-w-3xl mx-auto px-6 py-8">
                <ExamGrader
                  exam={selectedExam}
                  onBack={() => setSelectedExam(null)}
                />
              </div>
            ) : (
              <div className="max-w-5xl mx-auto px-6 py-8">
                <ExamList onSelectExam={setSelectedExam} />
              </div>
            )}
          </div>
        )}

        {currentPage === 'admin' && <SettingsPanel />}
      </main>
    </div>
  );
};

export default App;