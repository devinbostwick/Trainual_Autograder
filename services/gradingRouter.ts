import { ExamDefinition, ExamResult } from "../types";
import { gradeSubmission } from "./geminiService";
import { gradeSubmissionWithClaude } from "./claudeService";

/**
 * Exams routed to Claude (conceptual/scenario-heavy):
 * - Server Standardized (9q, ~60% conceptual)
 * - Host Standardized (15q, ~70% conceptual) 
 * - OAK Server (10q, ~50% conceptual)
 * - OAK Host (6q, ~50% conceptual)
 * - OAK Bartender (10q, beer/wine knowledge questions)
 * - Beer & Wine Knowledge (9q, supplemental)
 * - Cantina Host (5q, ~50% conceptual)
 * - Cantina Server (7q, ~50% conceptual)
 * 
 * Everything else → Gemini Flash (factual/ingredient-heavy)
 */
const CLAUDE_EXAM_IDS = new Set([
  "std-server",
  "std-host",
  "oak-server",
  "oak-host",
  "oak-bartender",
  "beer-wine-knowledge",
  "cantina-host",
  "cantina-server",
]);

/**
 * Routes exam grading to the appropriate AI service.
 * - Conceptual/scenario exams → Claude (better nuance)
 * - Factual/ingredient exams → Gemini Flash (fast + cheap)
 * 
 * Falls back to Gemini if Claude API key is not configured.
 */
export const gradeExam = async (
  exam: ExamDefinition,
  studentText: string
): Promise<ExamResult & { gradedBy: "gemini" | "claude" }> => {
  const shouldUseClaude = CLAUDE_EXAM_IDS.has(exam.id);
  const hasClaudeKey = !!process.env.CLAUDE_API_KEY;

  if (shouldUseClaude && hasClaudeKey) {
    try {
      const result = await gradeSubmissionWithClaude(exam, studentText);
      return { ...result, gradedBy: "claude" };
    } catch (error: any) {
      // If Claude fails, fall back to Gemini
      console.warn("Claude grading failed, falling back to Gemini:", error.message);
      const result = await gradeSubmission(exam, studentText);
      return { ...result, gradedBy: "gemini" };
    }
  }

  // Default: use Gemini
  const result = await gradeSubmission(exam, studentText);
  return { ...result, gradedBy: "gemini" };
};

/**
 * Check which AI service would be used for a given exam.
 */
export const getGradingEngine = (examId: string): "gemini" | "claude" => {
  const hasClaudeKey = !!process.env.CLAUDE_API_KEY;
  if (CLAUDE_EXAM_IDS.has(examId) && hasClaudeKey) return "claude";
  return "gemini";
};
