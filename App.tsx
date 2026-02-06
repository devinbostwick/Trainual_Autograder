import React, { useState } from 'react';
import { Header } from './components/Header';
import { ExamList } from './components/ExamList';
import { ExamGrader } from './components/ExamGrader';
import { ChatBox } from './components/ChatBox';
import { ExamDefinition, ExamResult } from './types';

const App: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState<ExamDefinition | null>(null);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        {selectedExam ? (
          <ExamGrader 
            exam={selectedExam} 
            onBack={() => setSelectedExam(null)}
            onResultReady={setExamResult}
          />
        ) : (
          <ExamList onSelectExam={setSelectedExam} />
        )}
      </main>

      <footer className="border-t border-border/40 py-8 bg-card/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-medium text-foreground">© {new Date().getFullYear()} Three Points Hospitality Group.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by <span className="text-primary font-semibold">OpsFlow Intelligence</span>
          </p>
        </div>
      </footer>

      {/* Chat Assistant - Disabled for now */}
      {/* <ChatBox examResult={examResult} /> */}
    </div>
  );
};

export default App;