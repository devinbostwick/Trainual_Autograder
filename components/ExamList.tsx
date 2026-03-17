import React, { useMemo } from 'react';
import { AVAILABLE_EXAMS } from '../data/examData';
import { ExamDefinition, TestCategory, Role } from '../types';
import { Users, Wine, Utensils, ClipboardCheck, ArrowRight, Activity, LayoutGrid, BookOpen } from 'lucide-react';

const BASE = import.meta.env.BASE_URL || '/';

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
      case Role.BARTENDER: return <Wine className="h-3.5 w-3.5" />;
      case Role.SERVER: return <Utensils className="h-3.5 w-3.5" />;
      case Role.HOST: return <Users className="h-3.5 w-3.5" />;
      case Role.SUPPLEMENTAL: return <ClipboardCheck className="h-3.5 w-3.5" />;
      default: return <ClipboardCheck className="h-3.5 w-3.5" />;
    }
  };

  const getRoleBadgeClasses = (role: Role) => {
    switch(role) {
      case Role.BARTENDER: return 'bg-amber-50 text-amber-700 ring-amber-200/60';
      case Role.SERVER: return 'bg-sky-50 text-sky-700 ring-sky-200/60';
      case Role.HOST: return 'bg-rose-50 text-rose-700 ring-rose-200/60';
      case Role.SUPPLEMENTAL: return 'bg-emerald-50 text-emerald-700 ring-emerald-200/60';
      default: return 'bg-gray-50 text-gray-700 ring-gray-200/60';
    }
  };

  const getCategoryLogo = (category: string): string | null => {
    if (category.toLowerCase().includes('oak') || category.toLowerCase().includes('american')) return `${BASE}logos/oak-logo.png`;
    if (category.toLowerCase().includes('cantina')) return `${BASE}logos/cantina-logo.png`;
    if (category.toLowerCase().includes('standard')) return `${BASE}favicon.png`;
    return null;
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      
      {/* Dashboard Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <LayoutGrid className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-widest">Assessment Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Select an Exam
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose an examination module to begin automated grading.
            </p>
          </div>
          
          {/* Status */}
          <div className="hidden md:flex gap-5 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              AI Engine Online
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-primary/60" />
              {AVAILABLE_EXAMS.length} Exams
            </div>
          </div>
        </div>
        <div className="h-px bg-border/60 mt-6"></div>
      </div>

      <div className="grid gap-10">
        {Object.entries(groupedExams).map(([category, exams]) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              {getCategoryLogo(category) ? (
                <img src={getCategoryLogo(category)!} alt={category} className="h-11 w-auto object-contain" />
              ) : (
                <div className="p-2 rounded-md bg-primary/6 text-primary/70">
                  <BookOpen className="h-5 w-5" />
                </div>
              )}
              <h3 className="text-base font-semibold text-foreground tracking-wide uppercase">{category}</h3>
              <span className="text-[10px] text-muted-foreground/70 font-medium">{(exams as ExamDefinition[]).length} exam{(exams as ExamDefinition[]).length !== 1 ? 's' : ''}</span>
              <div className="h-px flex-1 bg-border/40 ml-2"></div>
            </div>
            
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(exams as ExamDefinition[]).map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => onSelectExam(exam)}
                  className="group relative flex flex-col justify-between rounded-lg border border-border/70 bg-white hover:bg-accent/30 p-5 text-left transition-all duration-200 hover:border-primary/25 hover:shadow-[0_2px_12px_-3px_rgba(0,0,0,0.08)]"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset uppercase tracking-wider ${getRoleBadgeClasses(exam.role)}`}>
                        {getRoleIcon(exam.role)}
                        {exam.role}
                      </span>
                      {exam.subType && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-accent px-2 py-0.5 rounded-md border border-border/50">
                          {exam.subType}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {exam.title.replace(`${category}: `, '').replace(`[${exam.role}] `, '')}
                    </h4>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">
                      {exam.answerKey.length} question{exam.answerKey.length !== 1 ? 's' : ''} · {exam.answerKey.reduce((sum, q) => sum + q.points, 0)} pts
                    </span>
                    <span className="flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      Grade <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
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