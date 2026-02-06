import { GoogleGenAI, Type } from "@google/genai";
import { ExamDefinition, ExamResult, GradedQuestion } from "../types";

const parseScore = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
}

export const gradeSubmission = async (
  exam: ExamDefinition,
  studentText: string,
  apiKey?: string
): Promise<ExamResult> => {
  // Use provided API key, or fallback to environment variable
  const key = apiKey || process.env.API_KEY;
  
  if (!key) {
    throw new Error("API Key is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: key });

  // Define the schema for structured output to ensure reliable parsing
  const gradingSchema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING, description: "The ID of the question from the provided key." },
            studentAnswer: { type: Type.STRING, description: "The text extracted from student submission that corresponds to this question." },
            isCorrect: { type: Type.BOOLEAN, description: "True if the answer is semantically correct." },
            score: { type: Type.NUMBER, description: "Points awarded. Can be partial." },
            feedback: { type: Type.STRING, description: "Brief explanation of why it is correct or incorrect." },
          },
          required: ["questionId", "isCorrect", "score"],
        },
      },
      generalFeedback: { type: Type.STRING, description: "Overall feedback on the student's performance." }
    },
    required: ["questions"]
  };

  const prompt = `
    You are an expert hospitality exam grader. Your goal is to provide CONSISTENT grading across multiple submissions.
    
    TASK:
    Compare the STUDENT SUBMISSION against the ANSWER KEY.
    
    GRADING RULES (Apply consistently):
    
    1. **Units & Measurements**: Ignore missing or varying units if the number is correct.
       - "1" = "1oz" = "1 oz" = "1 ounce" (ALL CORRECT)
       - ".5" = "0.5" = "½" = "half" (ALL CORRECT)
    
    2. **Abbreviations & Terminology**: Accept common variations and synonyms.
       - "repo" = "reposado" (CORRECT)
       - "top" = "splash" = "float" (CORRECT for finishing touches)
       - "soda" = "soda water" = "club soda" (CORRECT)
    
    3. **Spelling & Typos**: Be forgiving of minor spelling errors (1-2 characters).
       - "patron" vs "patrón" (CORRECT)
       - "cointreau" vs "cointrau" (CORRECT)
    
    4. **Formatting**: Ignore capitalization, extra spaces, and punctuation differences.
       - "Salt Rim" = "salt rim" = "saltrim" (CORRECT)
    
    5. **Order**: Ingredient order doesn't matter unless explicitly required.
       - "tequila, lime, triple sec" = "triple sec, tequila, lime" (CORRECT)
    
    6. **Missing Information**: Only mark incorrect if critical details are completely absent.
       - Missing garnish when it's specified = Partial credit
       - Wrong ingredient = Zero points
    
    CONSISTENCY IS CRITICAL:
    - The SAME answer submitted multiple times MUST receive the SAME score every time
    - Use the schema to extract answers systematically
    - Be deterministic in your evaluation
    
    ANSWER KEY JSON:
    ${JSON.stringify(exam.answerKey)}
    
    STUDENT SUBMISSION TEXT:
    ${studentText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: gradingSchema,
        temperature: 0, // Zero temperature for maximum consistency
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    const parsedResult = JSON.parse(resultText);
    
    // Map AI results back to our strict TypeScript interfaces
    const gradedQuestions: GradedQuestion[] = exam.answerKey.map((key) => {
      const aiGraded = parsedResult.questions.find((q: any) => q.questionId === key.id);
      
      return {
        questionId: key.id,
        questionText: key.questionText, // Populate from key
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
      rawFeedback: parsedResult.generalFeedback
    };

  } catch (error: any) {
    console.error("Grading failed", error);
    let msg = "Failed to grade the submission. Please try again.";
    
    // Provide more specific error messages if possible
    if (error.message?.includes('API key')) msg = "Invalid API Key configuration.";
    if (error.status === 429) msg = "System is busy (Quota Exceeded). Please try again in a minute.";
    
    throw new Error(msg);
  }
};