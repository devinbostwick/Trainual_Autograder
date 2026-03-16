import Anthropic from "@anthropic-ai/sdk";
import { ExamDefinition, ExamResult, GradedQuestion } from "../types";

const parseScore = (value: any): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return 0;
};

// Helper function to implement timeout for API calls
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`)),
        timeoutMs
      )
    ),
  ]);
};

export const gradeSubmissionWithClaude = async (
  exam: ExamDefinition,
  studentText: string,
  apiKey?: string
): Promise<ExamResult> => {
  const key = apiKey || process.env.CLAUDE_API_KEY;

  if (!key) {
    throw new Error("Claude API Key is missing. Add CLAUDE_API_KEY to your .env file.");
  }

  const anthropic = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });

  const systemPrompt = `You are an expert hospitality exam grader for Three Points Hospitality Group. You specialize in grading conceptual, scenario-based, and short-answer questions with nuance.

GRADING PHILOSOPHY:
- Grade like a thoughtful restaurant manager, not a strict professor
- Reward employees who demonstrate understanding of hospitality principles
- Give substantial credit for answers that show "they get it" even if wording differs from the key
- Be generous with partial credit — these are hospitality workers, not academics

GRADING RULES FOR CONCEPTUAL/SCENARIO QUESTIONS:

1. **Understanding Over Wording**: If the student's answer demonstrates they understand the concept, award full or near-full credit even if their exact words differ from the answer key.

2. **Scenario Questions — Multiple Valid Approaches**: Guest service scenarios often have several correct responses. ANY professional, hospitable, solution-oriented response = Full credit. Don't require exact script matching.
   - "How to handle upset guest?" → ANY empathetic + solution-focused answer = Full credit
   - "How to upsell?" → ANY approach showing initiative to increase check = Full credit
   - "Explain a process" → Key steps present in any logical order = Full credit

3. **Partial Credit is Encouraged**: 
   - Covers most key points but misses 1-2 minor details → 80-90% credit
   - Shows understanding of core concept but incomplete → 50-75% credit  
   - Fundamentally wrong or off-topic → 0 credit
   - Missing professional tone when situation calls for it → -0.5 points max

4. **Professional Tone Recognition**: For scenario-based questions, if the answer demonstrates appropriate hospitality tone (polite, empathetic, solution-oriented), that alone is worth consideration.

5. **Step-by-Step Processes**: 
   - Minor step reordering is fine if the logic holds
   - Missing ONE minor step from 5+ step process = -0.5 to -1 point max
   - Core critical steps must be present
   - Extra relevant steps = no penalty (shows initiative)

6. **Factual Sub-Components in Conceptual Questions**:
   - Some conceptual questions have factual elements (prices, times, specific items)
   - Wrong specific facts = deduct for that component only, not the whole answer
   - Example: "What are Ladies Night specials?" — right concept of the promotion but wrong price = partial credit

7. **Dress Code / Policy Questions**:
   - Accept any answer that captures the key requirements
   - Exact wording not needed — spirit of the policy is what matters
   - Missing 1 item from a list of 5+ = still high credit

8. **Spelling & Grammar**: Do NOT penalize for spelling, grammar, or formatting. Focus purely on content and understanding.

FACTUAL QUESTIONS (when they appear in conceptual exams):

9. **Units & Measurements**: "1" = "1oz" = "1 oz" = "1 ounce"
10. **Abbreviations**: Accept common hospitality abbreviations
11. **Product Names**: Accept partial names if core identifier is clear
12. **Lists**: Proportional credit (4/5 correct = 80% of points)

CONSISTENCY: The SAME answer submitted multiple times MUST receive the SAME score.

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "questionId": "string (the ID from the answer key)",
      "studentAnswer": "string (what the student wrote for this question)",
      "isCorrect": true/false,
      "score": number (points awarded, can be partial like 1.5),
      "feedback": "string (brief explanation of grading decision)"
    }
  ],
  "generalFeedback": "string (overall performance summary)"
}`;

  const userPrompt = `Grade this student submission against the answer key.

ANSWER KEY JSON:
${JSON.stringify(exam.answerKey)}

STUDENT SUBMISSION TEXT:
${studentText}

Return ONLY the JSON response, no other text.`;

  try {
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      60000 // 60 second timeout
    );

    // Extract text from Claude's response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    let resultText = textBlock.text.trim();

    // Strip markdown code fences if present
    if (resultText.startsWith("```")) {
      resultText = resultText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsedResult = JSON.parse(resultText);

    // Map AI results back to our strict TypeScript interfaces
    const gradedQuestions: GradedQuestion[] = exam.answerKey.map((key) => {
      const aiGraded = parsedResult.questions.find(
        (q: any) => q.questionId === key.id
      );

      return {
        questionId: key.id,
        questionText: key.questionText,
        studentAnswer: aiGraded?.studentAnswer || "(Not Found)",
        isCorrect: aiGraded?.isCorrect || false,
        score: parseScore(aiGraded?.score),
        maxPoints: key.points,
        feedback: aiGraded?.feedback || "No answer provided.",
      };
    });

    const totalScore = gradedQuestions.reduce((acc, q) => acc + q.score, 0);
    const maxScore = gradedQuestions.reduce((acc, q) => acc + q.maxPoints, 0);

    return {
      examId: exam.id,
      examTitle: exam.title,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      questions: gradedQuestions,
      rawFeedback: parsedResult.generalFeedback,
    };
  } catch (error: any) {
    console.error("Claude grading failed", error);
    let msg = "Failed to grade the submission. Please try again.";

    if (error.message?.includes("timed out")) {
      msg = "Request timed out after 60 seconds. The AI service may be experiencing delays. Please try again.";
    } else if (error.message?.includes("api_key") || error.message?.includes("authentication")) {
      msg = "Invalid Claude API Key. Please check your CLAUDE_API_KEY in .env.";
    } else if (error.message?.includes("JSON")) {
      msg = "Received invalid response format from Claude. Please try again.";
    } else if (error.status === 429) {
      msg = "Claude rate limit exceeded. Please wait a minute and try again.";
    } else if (error.status === 529 || error.status === 500) {
      msg = "Claude service is temporarily unavailable. Please try again in a moment.";
    } else if (error.message?.includes("Failed to fetch") || error.message?.includes("network")) {
      msg = "Network connection error. Please check your internet connection and try again.";
    } else if (error.message) {
      msg = `Error: ${error.message}`;
    }

    throw new Error(msg);
  }
};
