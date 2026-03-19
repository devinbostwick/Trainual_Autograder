import React, { useState, useRef } from 'react';
import { ExamDefinition, ExamResult } from '../types';
import { gradeExam, getGradingEngine } from '../services/gradingRouter';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, ChevronLeft, Award, Download, Printer, Cpu } from 'lucide-react';

interface ExamGraderProps {
  exam: ExamDefinition;
  onBack: () => void;
  onResultReady?: (result: ExamResult | null) => void;
  initialStudentName?: string; // Pre-fill when launched from a user profile
  hideBackButton?: boolean;    // Hide when embedded inside a tab
}

export const ExamGrader: React.FC<ExamGraderProps> = ({ exam, onBack, onResultReady, initialStudentName = '', hideBackButton = false }) => {
  const [textInput, setTextInput] = useState('');
  const [studentName, setStudentName] = useState(initialStudentName);
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gradedBy, setGradedBy] = useState<'gemini' | 'claude' | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  const totalPoints = exam.answerKey.reduce((sum, q) => sum + q.points, 0);
  const questionCount = exam.answerKey.length;

  // Determine question status: correct, partially correct (>=50%), or incorrect
  const getQuestionStatus = (q: { score: number; maxPoints: number; isCorrect: boolean }) => {
    if (q.isCorrect || q.score >= q.maxPoints) return 'correct';
    if (q.score >= q.maxPoints * 0.5) return 'partial';
    return 'incorrect';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTextInput(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleGrade = async () => {
    if (!textInput.trim()) {
      setError("Please enter student answers or upload a file.");
      return;
    }

    if (!process.env.API_KEY) {
      setError("API Key is missing from environment variables.");
      return;
    }

    setIsGrading(true);
    setError(null);
    setElapsedTime(0);
    
    // Start elapsed time counter
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    try {
      const gradingResult = await gradeExam(exam, textInput);
      setGradedBy(gradingResult.gradedBy);
      setResult(gradingResult);
      onResultReady?.(gradingResult); // Notify parent component
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGrading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    
    const currentDate = new Date().toLocaleString();
    const lines = [
      `THREE POINTS HOSPITALITY GROUP - AUTOGRADE REPORT`,
      `================================================`,
      ...(studentName ? [`Student: ${studentName}`] : []),
      `Exam: ${result.examTitle}`,
      `Date: ${currentDate}`,
      `Score: ${result.totalScore} / ${result.maxScore} (${result.percentage.toFixed(1)}%)`,
      ...(gradedBy ? [`Graded by: ${gradedBy === 'claude' ? 'Claude AI (Conceptual)' : 'Gemini AI (Factual)'}`] : []),
      `\nSUMMARY:`,
      `${result.rawFeedback || 'N/A'}`,
      `\n------------------------`,
      `DETAILED BREAKDOWN`,
      `------------------------\n`
    ];

    result.questions.forEach((q, i) => {
      const status = getQuestionStatus(q);
      const statusLabel = status === 'correct' ? 'CORRECT' : status === 'partial' ? 'PARTIALLY CORRECT' : 'INCORRECT';
      lines.push(`Q${q.questionId}: ${q.questionText}`);
      lines.push(`Status: ${statusLabel} (${q.score}/${q.maxPoints} pts)`);
      lines.push(`Student Answer: ${q.studentAnswer}`);
      lines.push(`Feedback: ${q.feedback}`);
      lines.push(`\n---\n`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.examTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-report');
    if (!printContent) return;

    // Create a new window for printing to guarantee isolation
    const printWindow = window.open('', '_blank', 'height=800,width=900');
    if (!printWindow) return;

    // Write the full HTML document with styles
    printWindow.document.write('<html><head><title>Exam Report</title>');
    
    // Inject Tailwind
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    
    // Inject Config
    printWindow.document.write(`
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: "oklch(0.44 0.10 230)", 
                secondary: "oklch(0.92 0.02 230)",
                muted: "oklch(0.965 0.005 230)",
                background: "oklch(0.98 0.005 230)",
                foreground: "oklch(0.15 0.02 230)",
                border: "oklch(0.91 0.01 230)",
                card: "oklch(1 0 0)",
                "muted-foreground": "oklch(0.50 0.02 230)",
              },
              fontFamily: {
                sans: ['Inter', 'sans-serif'],
              },
            },
          },
        };
      </script>
    `);

    // Additional Print CSS
    printWindow.document.write(`
      <style>
        body { 
          font-family: 'Inter', sans-serif; 
          padding: 40px; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        .no-print { display: none !important; }
      </style>
    `);
    
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent.outerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus(); // Necessary for some browsers
    
    // Wait slightly for scripts/styles to parse before triggering print
    setTimeout(() => {
      printWindow.print();
      // Optional: close after print. Some browsers block this, so often better to leave open or close on focus loss.
      // printWindow.close(); 
    }, 800);
  };

  const reset = () => {
    setResult(null);
    setTextInput('');
    setStudentName('');
    setError(null);
    setGradedBy(null);
    setElapsedTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  if (result) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        {!hideBackButton && (
          <button onClick={reset} className="mb-6 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors no-print">
            <ChevronLeft className="mr-1 h-4 w-4" /> Grade another student
          </button>
        )}

        {/* This ID 'printable-report' is targeted by the handlePrint function */}
        <div id="printable-report" className="bg-white border border-border/70 rounded-lg shadow-sm overflow-hidden mb-12">
          <div className="p-6 md:p-8 border-b border-border/60 print:bg-white print:p-0 print:border-none">
             {/* Student Name & Date */}
             {studentName && (
               <div className="mb-3 text-xs text-muted-foreground">
                 <div className="font-medium text-foreground text-sm">Student: {studentName}</div>
                 <div>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
               </div>
             )}
             
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h2 className="text-xl font-semibold text-foreground mb-0.5">{result.examTitle}</h2>
                  <p className="text-sm text-muted-foreground">Automated Grading Report</p>
                  {gradedBy && (
                    <div className="mt-2 no-print">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        gradedBy === 'claude' 
                          ? 'bg-orange-50 text-orange-600 border border-orange-200/60' 
                          : 'bg-sky-50 text-sky-600 border border-sky-200/60'
                      }`}>
                        <Cpu className="w-3 h-3" />
                        {gradedBy === 'claude' ? 'Claude AI' : 'Gemini AI'}
                      </span>
                    </div>
                  )}
               </div>
               
               {/* Score & Actions */}
               <div className="flex flex-col-reverse md:flex-row items-end md:items-center gap-5 w-full md:w-auto">
                 {/* Action Buttons */}
                 <div className="flex gap-3 no-print">
                   <button 
                     onClick={handleDownloadReport}
                     className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-border bg-white hover:bg-accent/50 text-foreground rounded-md transition-all"
                   >
                     <Download className="w-3.5 h-3.5 text-muted-foreground" /> 
                     Download
                   </button>
                   <button 
                     onClick={handlePrint}
                     className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-white hover:bg-primary/90 rounded-md transition-all"
                   >
                     <Printer className="w-3.5 h-3.5" /> 
                     Print
                   </button>
                 </div>

                 {/* Score Display */}
                 <div className="flex items-center gap-3">
                   <div className="text-right">
                     <div className="text-2xl font-semibold text-foreground">{result.totalScore} <span className="text-base text-muted-foreground font-normal">/ {result.maxScore}</span></div>
                     <div className={`text-xs font-medium ${result.percentage >= 80 ? 'text-emerald-600' : result.percentage >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                       {result.percentage.toFixed(1)}%
                     </div>
                   </div>
                   <div className={`p-2 rounded-lg print:hidden ${result.percentage >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      <Award className="h-6 w-6" />
                   </div>
                 </div>
               </div>
             </div>
             {result.rawFeedback && (
               <div className="mt-5 p-3 bg-accent/50 rounded-md border border-border/50 text-sm text-foreground print:bg-gray-50 print:border-gray-200">
                 <span className="font-medium text-foreground block mb-0.5 text-xs uppercase tracking-wider">Summary</span>
                 <span className="text-muted-foreground text-sm">{result.rawFeedback}</span>
               </div>
             )}

             {/* Score breakdown bar */}
             {(() => {
               const correct = result.questions.filter(q => getQuestionStatus(q) === 'correct').length;
               const partial = result.questions.filter(q => getQuestionStatus(q) === 'partial').length;
               const incorrect = result.questions.filter(q => getQuestionStatus(q) === 'incorrect').length;
               const total = result.questions.length;
               return (
                 <div className="mt-4">
                   <div className="flex items-center gap-4 mb-1.5">
                     <span className="text-[11px] text-muted-foreground flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500"></span> {correct} correct</span>
                     <span className="text-[11px] text-muted-foreground flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400"></span> {partial} partial</span>
                     <span className="text-[11px] text-muted-foreground flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400"></span> {incorrect} incorrect</span>
                   </div>
                   <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden flex">
                     {correct > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(correct/total)*100}%` }}></div>}
                     {partial > 0 && <div className="bg-amber-400 h-full transition-all" style={{ width: `${(partial/total)*100}%` }}></div>}
                     {incorrect > 0 && <div className="bg-red-400 h-full transition-all" style={{ width: `${(incorrect/total)*100}%` }}></div>}
                   </div>
                 </div>
               );
             })()}
          </div>

          <div className="divide-y divide-border/60">
            {result.questions.map((q) => {
              const status = getQuestionStatus(q);
              return (
              <div key={q.questionId} className={`p-5 md:p-6 transition-colors print:p-4 print:break-inside-avoid ${
                status === 'correct' ? 'bg-white hover:bg-emerald-50/20' :
                status === 'partial' ? 'bg-amber-50/10 hover:bg-amber-50/20' :
                'bg-red-50/10 hover:bg-red-50/20'
              }`}>
                <div className="flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/50">
                                    Q{q.questionId}
                                </span>
                                {status === 'correct' ? (
                                  <span className="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Correct
                                  </span>
                                ) : status === 'partial' ? (
                                  <span className="inline-flex items-center text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                                    <AlertTriangle className="w-3 h-3 mr-0.5" /> Partial
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[11px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200/60">
                                    <AlertCircle className="w-3 h-3 mr-0.5" /> Incorrect
                                  </span>
                                )}
                            </div>
                            <h3 className="text-sm font-medium text-foreground leading-snug">
                                {q.questionText}
                            </h3>
                        </div>
                        
                        <div className="flex-shrink-0 text-right md:pl-4">
                            <div className="text-lg font-semibold text-foreground">{q.score} <span className="text-xs text-muted-foreground font-normal">/ {q.maxPoints}</span></div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="grid md:grid-cols-2 gap-3 mt-1">
                       <div className="bg-accent/40 border border-border/40 rounded-md p-2.5 print:border-gray-300">
                         <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Student Answer</span>
                         <p className="text-xs text-foreground whitespace-pre-wrap">
                           {q.studentAnswer}
                         </p>
                       </div>
                       <div className={`rounded-md p-2.5 border ${
                         status === 'correct' ? 'bg-emerald-50/40 border-emerald-100/60 print:bg-green-50 print:border-green-100' :
                         status === 'partial' ? 'bg-amber-50/40 border-amber-100/60 print:bg-orange-50 print:border-orange-100' :
                         'bg-red-50/40 border-red-100/60 print:bg-red-50 print:border-red-100'
                       }`}>
                         <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Feedback</span>
                         <p className="text-xs text-muted-foreground italic">
                           {q.feedback}
                         </p>
                       </div>
                     </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {!hideBackButton && (
        <button onClick={onBack} className="mb-6 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to assessments
        </button>
      )}

      <div className="mx-auto mb-8 max-w-3xl">
        <div className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide mb-4">
          <FileText className="h-3 w-3" />
          Grading Interface
        </div>
        <h2 className="text-xl md:text-2xl font-semibold mb-2 tracking-tight text-foreground">
          {exam.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste the student's submission or upload a file. The AI will parse answers even with typos.
        </p>
        <div className="flex gap-3 mt-3">
          <span className="text-[11px] text-muted-foreground/70 bg-accent/60 px-2 py-0.5 rounded-md border border-border/40">{questionCount} questions</span>
          <span className="text-[11px] text-muted-foreground/70 bg-accent/60 px-2 py-0.5 rounded-md border border-border/40">{totalPoints} total points</span>
        </div>
      </div>

      <div className="bg-white border border-border/70 rounded-lg shadow-sm p-5 md:p-6">
        <div className="mb-5">
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Student Name <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full p-2.5 rounded-md border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none"
            placeholder="Enter student's name..."
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Student Submission
          </label>
          <div 
            className={`relative rounded-md border-2 border-dashed transition-colors ${isDragOver ? 'border-primary/40 bg-primary/5' : 'border-transparent'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && (file.name.endsWith('.txt') || file.name.endsWith('.md'))) {
                const reader = new FileReader();
                reader.onload = (event) => { if (event.target?.result) setTextInput(event.target.result as string); };
                reader.readAsText(file);
              }
            }}
          >
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && textInput.trim() && !isGrading) {
                  handleGrade();
                }
              }}
              className="w-full h-56 p-3 rounded-md border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none font-mono outline-none"
              placeholder="Paste the full test content here or drag & drop a .txt file..."
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-accent hover:bg-accent/80 text-muted-foreground text-[11px] font-medium rounded-md transition-colors border border-border/50"
              >
                <UploadCloud className="w-3 h-3" /> Upload
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex justify-between">
            <span>Supported: Plain text, .txt files, or drag & drop</span>
            {textInput.length > 0 && <span className="text-muted-foreground/50 font-mono">{textInput.length.toLocaleString()} chars</span>}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2.5 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {isGrading && (
          <div className="mb-5 p-3 bg-sky-50 border border-sky-200 rounded-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-sky-700">Processing submission...</span>
              <span className="text-[11px] text-sky-600 font-mono">{elapsedTime}s</span>
            </div>
            <div className="w-full bg-sky-200 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <p className="text-[11px] text-sky-600 mt-1.5">
              {elapsedTime < 10 && "Analyzing student responses..."}
              {elapsedTime >= 10 && elapsedTime < 30 && "Comparing against answer key..."}
              {elapsedTime >= 30 && elapsedTime < 45 && "Calculating scores and feedback..."}
              {elapsedTime >= 45 && "Almost done, finalizing report..."}
            </p>
          </div>
        )}

        <button
          onClick={handleGrade}
          disabled={isGrading || !textInput.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-primary hover:bg-primary/90 text-white text-sm font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isGrading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing & Grading...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Grade Submission
              <kbd className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">⌘↵</kbd>
            </>
          )}
        </button>
        {/* Engine indicator */}
        <div className="text-center mt-2">
          <span className={`inline-flex items-center gap-1 text-[11px] ${
            getGradingEngine(exam.id) === 'claude' ? 'text-orange-500' : 'text-sky-500'
          }`}>
            <Cpu className="w-3 h-3" />
            {getGradingEngine(exam.id) === 'claude' ? 'Claude AI — Scenario questions' : 'Gemini AI — Factual questions'}
          </span>
        </div>
      </div>
    </div>
  );
};