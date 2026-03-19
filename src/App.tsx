import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ExamList } from './components/ExamList';
import { ExamGrader } from './components/ExamGrader';
import { ChatBox } from './components/ChatBox';
import TestAssigner from './components/TestAssigner';
import { ExamDefinition, ExamResult } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'grader' | 'assigner'>('grader');
  const [selectedExam, setSelectedExam] = useState<ExamDefinition | null>(null);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSelectExam = useCallback((exam: ExamDefinition) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedExam(exam);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const handleBack = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedExam(null);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const handleNavigate = useCallback((page: 'grader' | 'assigner') => {
    if (page === currentPage) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setSelectedExam(null);
      setIsTransitioning(false);
    }, 150);
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      <Header currentPage={currentPage} onNavigate={handleNavigate} />
      
      {currentPage === 'grader' ? (
        <main className={`flex-1 container mx-auto px-4 py-8 md:py-12 transition-all duration-150 ${isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
          {selectedExam ? (
            <ExamGrader 
              exam={selectedExam} 
              onBack={handleBack}
              onResultReady={setExamResult}
            />
          ) : (
            <ExamList onSelectExam={handleSelectExam} />
          )}
        </main>
      ) : (
        <main className={`flex-1 transition-all duration-150 ${isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <TestAssigner />
        </main>
      )}

      <footer className="border-t border-border/40 py-6 bg-white/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">© {new Date().getFullYear()} Three Points Hospitality Group</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Powered by <span className="text-primary font-medium">OpsFlow</span>
          </p>
        </div>
      </footer>

      {/* Chat Assistant - Disabled for now */}
      {/* <ChatBox examResult={examResult} /> */}
    </div>
  );
};

export default App;