import React, { useState, useRef } from 'react';
import { ExamDefinition, ExamResult } from '../types';
import { gradeSubmission } from '../services/geminiService';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, Award, Download, Printer } from 'lucide-react';

interface ExamGraderProps {
  exam: ExamDefinition;
  onBack: () => void;
  onResultReady?: (result: ExamResult | null) => void;
}

export const ExamGrader: React.FC<ExamGraderProps> = ({ exam, onBack, onResultReady }) => {
  const [textInput, setTextInput] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const gradingResult = await gradeSubmission(exam, textInput);
      setResult(gradingResult);
      onResultReady?.(gradingResult); // Notify parent component
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    
    const lines = [
      `THREE POINTS HOSPITALITY GROUP - AUTOGRADE REPORT`,
      `================================================`,
      `Exam: ${result.examTitle}`,
      `Date: ${new Date().toLocaleString()}`,
      `Score: ${result.totalScore} / ${result.maxScore} (${result.percentage.toFixed(1)}%)`,
      `\nSUMMARY:`,
      `${result.rawFeedback || 'N/A'}`,
      `\n------------------------`,
      `DETAILED BREAKDOWN`,
      `------------------------\n`
    ];

    result.questions.forEach((q, i) => {
      lines.push(`Q${q.questionId}: ${q.questionText}`);
      lines.push(`Status: ${q.isCorrect ? 'CORRECT' : 'INCORRECT'} (${q.score}/${q.maxPoints} pts)`);
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
                primary: "oklch(0.45 0.14 255)", 
                secondary: "oklch(0.92 0.04 255)",
                muted: "oklch(0.96 0.01 260)",
                background: "oklch(0.985 0 0)",
                foreground: "oklch(0.20 0.02 260)",
                border: "oklch(0.90 0.02 260)",
                card: "oklch(1 0 0)",
                "muted-foreground": "oklch(0.55 0.04 260)",
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
    setError(null);
  };

  if (result) {
    return (
      <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <button onClick={reset} className="mb-6 flex items-center text-sm text-muted-foreground hover:text-primary transition-colors no-print">
          <ChevronLeft className="mr-1 h-4 w-4" /> Grade another student
        </button>

        {/* This ID 'printable-report' is targeted by the handlePrint function */}
        <div id="printable-report" className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden mb-12">
          <div className="p-8 border-b border-border bg-gradient-to-r from-card to-background print:bg-white print:p-0 print:border-none">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">{result.examTitle}</h2>
                  <p className="text-muted-foreground">Automated Grading Report</p>
               </div>
               
               {/* Score & Actions */}
               <div className="flex flex-col-reverse md:flex-row items-end md:items-center gap-6 w-full md:w-auto">
                 {/* Action Buttons (Hidden in Print) */}
                 <div className="flex gap-4 no-print">
                   <button 
                     onClick={handleDownloadReport}
                     className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold border border-border bg-white hover:bg-gray-50 text-foreground rounded-lg transition-all shadow-sm hover:shadow-md active:translate-y-0.5"
                   >
                     <Download className="w-4 h-4 text-primary" /> 
                     Text File
                   </button>
                   <button 
                     onClick={handlePrint}
                     className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-primary text-white hover:bg-primary/90 rounded-lg transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                   >
                     <Printer className="w-4 h-4 text-white" /> 
                     Print PDF
                   </button>
                 </div>

                 {/* Score Display */}
                 <div className="flex items-center gap-4">
                   <div className="text-right">
                     <div className="text-3xl font-bold text-primary">{result.totalScore} <span className="text-lg text-muted-foreground">/ {result.maxScore}</span></div>
                     <div className={`text-sm font-medium ${result.percentage >= 80 ? 'text-green-600' : result.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                       {result.percentage.toFixed(1)}% Score
                     </div>
                   </div>
                   <div className={`p-3 rounded-full print:hidden ${result.percentage >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      <Award className="h-8 w-8" />
                   </div>
                 </div>
               </div>
             </div>
             {result.rawFeedback && (
               <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm text-foreground print:bg-gray-50 print:border-gray-200">
                 <span className="font-semibold text-primary block mb-1">Summary:</span>
                 {result.rawFeedback}
               </div>
             )}
          </div>

          <div className="divide-y divide-border">
            {result.questions.map((q) => (
              <div key={q.questionId} className={`p-6 transition-colors print:p-4 print:break-inside-avoid ${q.isCorrect ? 'bg-background hover:bg-green-50/30' : 'bg-red-50/10 hover:bg-red-50/20'}`}>
                <div className="flex flex-col gap-4">
                    {/* Header: ID, Question Text, Score */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground bg-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider border border-secondary/20">
                                    Q {q.questionId}
                                </span>
                                {q.isCorrect ? (
                                  <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Correct
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                                    <AlertCircle className="w-3 h-3 mr-1" /> Incorrect
                                  </span>
                                )}
                            </div>
                            <h3 className="text-lg font-medium text-foreground leading-snug">
                                {q.questionText}
                            </h3>
                        </div>
                        
                        <div className="flex-shrink-0 text-right md:pl-4">
                            <div className="text-xl font-bold text-foreground">{q.score} <span className="text-sm text-muted-foreground font-normal">/ {q.maxPoints} pts</span></div>
                        </div>
                    </div>

                    {/* Content: Answer & Feedback */}
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                       <div className="bg-background/80 border border-border/60 rounded-lg p-3 shadow-sm print:border-gray-300 print:shadow-none">
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Student Answer</span>
                         <p className="text-sm text-foreground font-medium whitespace-pre-wrap">
                           {q.studentAnswer}
                         </p>
                       </div>
                       <div className={`rounded-lg p-3 border shadow-sm print:shadow-none ${q.isCorrect ? 'bg-green-50/50 border-green-100/50 print:bg-green-50 print:border-green-100' : 'bg-red-50/50 border-red-100/50 print:bg-red-50 print:border-red-100'}`}>
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Feedback</span>
                         <p className="text-sm text-muted-foreground italic">
                           {q.feedback}
                         </p>
                       </div>
                     </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-6 flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to assessments
      </button>

      <div className="mx-auto mb-12 max-w-3xl text-center">
        <div className="clerk-badge bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm mb-6">
          <FileText className="h-4 w-4 mr-2" />
          Grading Interface
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-foreground">
          {exam.title}
        </h2>
        <p className="text-lg text-muted-foreground">
          Paste the student's full submission text or upload a file. The AI will parse answers even with typos.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Student Submission
          </label>
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full h-64 p-4 rounded-lg border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none font-mono text-sm"
              placeholder="Paste the full test content here..."
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary text-xs font-medium rounded-md transition-colors backdrop-blur-sm"
              >
                <UploadCloud className="w-3 h-3" /> Upload File
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: Plain text copy-paste or .txt files.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <button
          onClick={handleGrade}
          disabled={isGrading || !textInput.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isGrading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Analyizing & Grading...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Grade Submission
            </>
          )}
        </button>
      </div>
    </div>
  );
};