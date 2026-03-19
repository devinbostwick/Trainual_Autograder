import React from 'react';
import { Header } from './components/Header';
import TestAssigner from './components/TestAssigner';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      <Header />
      <main className="flex-1 overflow-hidden">
        <TestAssigner />
      </main>
    </div>
  );
};

export default App;