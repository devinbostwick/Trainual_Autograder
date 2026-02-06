import React, { useMemo } from 'react';
import { AVAILABLE_EXAMS } from '../data/examData';
import { ExamDefinition, TestCategory, Role } from '../types';
import { MapPin, Users, Wine, Utensils, ClipboardCheck, ArrowRight, Activity, LayoutDashboard } from 'lucide-react';

interface ExamListProps {
  onSelectExam: (exam: ExamDefinition) => void;
}

export const ExamList: React.FC<ExamListProps> = ({ onSelectExam }) => {
  
  const groupedExams = useMemo<Record<string, ExamDefinition[]>>(() => {
    const groups: Record<string, ExamDefinition[]> = {};
    AVAILABLE_EXAMS.forEach(exam => {
      if (!groups[exam.category]) groups[exam.category] = [];
      groups[exam.category].push(exam);
    });
    return groups;
  }, []);

  const getRoleIcon = (role: Role) => {
    switch(role) {
      case Role.BARTENDER: return <Wine className="h-4 w-4" />;
      case Role.SERVER: return <Utensils className="h-4 w-4" />;
      case Role.HOST: return <Users className="h-4 w-4" />;
      default: return <ClipboardCheck className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* OpsFlow Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-widest">OpsFlow Assessment Hub</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Assessment Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Select an active examination module to begin the automated grading process.
          </p>
        </div>
        
        {/* System Status Indicators */}
        <div className="hidden md:flex gap-6 text-xs font-medium text-muted-foreground mt-4 md:mt-0 bg-card/50 p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            AI Grading Engine: <span className="text-foreground">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Active Exams: <span className="text-foreground">{AVAILABLE_EXAMS.length}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-10">
        {Object.entries(groupedExams).map(([category, exams]) => (
          <div key={category} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                 <MapPin className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-foreground font-display tracking-wide uppercase">{category}</h3>
              <div className="h-px flex-1 bg-border/60 ml-4"></div>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {(exams as ExamDefinition[]).map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => onSelectExam(exam)}
                  className="group relative flex flex-col justify-between rounded-xl border border-border bg-card hover:bg-card/80 p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg overflow-hidden"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between relative z-10">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset uppercase tracking-wider ${
                        exam.role === Role.BARTENDER ? 'bg-purple-50 text-purple-700 ring-purple-600/20' :
                        exam.role === Role.SERVER ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                        'bg-orange-50 text-orange-700 ring-orange-600/20'
                      }`}>
                        {getRoleIcon(exam.role)}
                        {exam.role}
                      </span>
                      {exam.subType && (
                        <span className="text-[10px] text-muted-foreground font-semibold bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20 uppercase">
                          {exam.subType}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-lg text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors relative z-10">
                      {exam.title.replace(`${category}: `, '').replace(`[${exam.role}] `, '')}
                    </h4>
                  </div>
                  
                  <div className="mt-6 flex items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors relative z-10">
                    Initialize Grader <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};