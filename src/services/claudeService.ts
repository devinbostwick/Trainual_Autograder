import Anthropic from "@anthropic-ai/sdk";
import { ExamDefinition, ExamResult, GradedQuestion } from "../types";
import { preprocessSubmission } from "./preprocessSubmission";

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

  // Clean up raw Trainual paste before sending to AI
  const cleanedText = preprocessSubmission(studentText, exam.answerKey.length);

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

HUMAN ERROR TOLERANCE — "I KNOW WHAT YOU MEANT" GRADING:

These patterns ALWAYS get full credit if the intent is clear:
- Phonetic spelling: "vodca"→vodka, "wisky"→whiskey, "champayne"→champagne, "tequilla"→tequila
- Missing vowels / text-speak: "chardny"→chardonnay, "sauv blanc"→sauvignon blanc, "cab sav"→cabernet sauvignon
- Abbreviations: "OJ"→orange juice, "CB"→club soda, "PG"→pinot grigio, "PN"→pinot noir, "sauv"→sauvignon
- Dropped words that are obvious: "syrup" dropped from "simple syrup", "juice" dropped from "lime juice"
- Mixed case / all caps / all lowercase — always ignore
- Extra filler words: "I think it's...", "something like...", "I believe..." — grade the substance, ignore the hedge
- Reversed order in lists — never penalize
- Numbers written as words: "five"→5, "half"→0.5, "a quarter"→0.25

ANSWER EXTRACTION INSTRUCTIONS:
- The submission has been pre-parsed into "Q<n>: answer" format
- Match Q1 to the 1st question in the answer key, Q2 to the 2nd, etc. (by position, not by ID string)
- If a student clearly attempts an answer even with major errors, extract what they wrote and grade it
- Never mark "(Not Found)" if there's ANY text for that question number

FACTUAL QUESTIONS (when they appear in conceptual exams):

9. **Units & Measurements**: Cocktail measurements must be EXACT. "1oz" ≠ "1.5oz" = 0 credit for that ingredient. Missing measurement = 0 credit.
10. **Abbreviations**: Accept common hospitality abbreviations
11. **Product Names / Brand Rules (applies to ALL exams including brunch/food)**:
    - Brand implies category = FULL credit (e.g., "Evan Williams" without "Bourbon", "Engine" without "Gin", "Buffalo Trace" without "Bourbon" = all FULL credit)
    - Generic category without brand (e.g., "Vodka" instead of "E11even Vodka") = HALF credit ONLY when measurement is 100% correct, otherwise 0
    - "Bourbon" alone for "Pecan-Infused Buffalo Trace Bourbon" = 0 credit (no identifying information)
    - Wrong brand = 0 credit
    - "Sherry" for "Amontillado Sherry" = FULL credit
    - "4-Spice Syrup" or "Pecan Syrup" for "4-Spice Pecan Syrup" = FULL credit
    - "Martini Glass" for "Chilled Martini Glass" = FULL credit
    - Glassware: "Rocks Glass" = "Double Rocks Glass" = "Old Fashioned Glass"; "Mason Jar" = "Ball Jar" = "Southern Jar"
    - Garnish extras NOT required: "on rim", "slice", "REAL", "Gentleman's Cube", "Dehydrated", "Float", "Smoked"
    - "Lime Wheel" or "Lime" = FULL credit for "Float Dehydrated Lime Wheel"
    - **GLUTEN-FREE BEER**: "South Beach Mimosa" = "Strawberry Orange Mimosa" = GLUTEN FREE — award full credit when listed as a gluten-free option. Do NOT mark it as containing gluten.
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

STUDENT SUBMISSION (pre-parsed from Trainual, format is "Q<n>: <student answer>"):
${cleanedText}

ANSWER EXTRACTION RULES:
- Each line is "Q<number>: <answer>" — map Q1→first answer key question, Q2→second, etc.
- If a line is missing, that question was left blank — mark as "(No answer provided)"
- Student answers may have: typos, abbreviations, comma-separated lists, casual phrasing
- "I know what they meant" grading — if it's recognizably correct, credit it
- Do NOT penalize for spelling errors, capitalization, missing punctuation
- Short answers like "5" or "ABV" or "yes" are valid — don't expect full sentences

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
