import { GoogleGenAI, Type } from "@google/genai";
import { ExamDefinition, ExamResult, GradedQuestion } from "../types";

const parseScore = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
}

export const gradeSubmission = async (
  exam: ExamDefinition,
  studentText: string
): Promise<ExamResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    You are an expert hospitality training grader for OpsFlow.
    
    TASK:
    Compare the STUDENT SUBMISSION against the ANSWER KEY.
    
    RULES:
    1. **Lax Parsing**: You must be tolerant of typos, misspellings, and minor grammatical errors. 
    2. **Semantic Matching**: If the student uses different words but conveys the correct meaning, mark it as Correct.
    3. **Extraction**: The student submission might be a raw copy-paste. You need to identify which part of their text corresponds to which question in the key.
    4. **Scoring**: Award points based on the 'points' field in the key.
    
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
        temperature: 0.1, // Low temperature for consistent grading
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