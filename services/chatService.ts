import { GoogleGenAI } from "@google/genai";
import { ExamResult, ChatMessage } from "../types";

export const chatWithAI = async (
  message: string,
  examResult: ExamResult | null,
  chatHistory: ChatMessage[],
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY;
  
  if (!key) {
    throw new Error("API Key is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: key });

  // Build context about the exam if available
  let systemContext = `You are an AI assistant helping HR professionals and trainers with exam grading and analysis.
You provide insights, answer questions about exam results, help identify patterns, and assist with grading decisions.
Be professional, analytical, and helpful in your responses.`;

  if (examResult) {
    const incorrectQuestions = examResult.questions.filter(q => !q.isCorrect);
    const correctQuestions = examResult.questions.filter(q => q.isCorrect);
    
    systemContext += `\n\nCurrent Exam Being Reviewed: "${examResult.examTitle}"
Overall Score: ${examResult.totalScore}/${examResult.maxScore} (${examResult.percentage.toFixed(1)}%)

Correct Answers: ${correctQuestions.length}
Incorrect Answers: ${incorrectQuestions.length}

Questions marked incorrect:
${incorrectQuestions.map(q => `
- Question: ${q.questionText}
  Student's Answer: ${q.studentAnswer}
  AI Feedback: ${q.feedback}
  Score: ${q.score}/${q.maxPoints}
`).join('\n')}

Questions marked correct:
${correctQuestions.map(q => `
- Question: ${q.questionText}
  Student's Answer: ${q.studentAnswer}
  Score: ${q.score}/${q.maxPoints}
`).join('\n')}`;
  }

  // Build conversation history
  const conversationText = chatHistory.map(msg => 
    `${msg.role === 'user' ? 'HR/Grader' : 'AI Assistant'}: ${msg.content}`
  ).join('\n\n');

  const fullPrompt = `${systemContext}

${conversationText ? `Previous conversation:\n${conversationText}\n\n` : ''}HR/Grader: ${message}

AI Assistant:`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    return resultText;
  } catch (error: any) {
    console.error("Chat failed", error);
    throw new Error("Failed to get response. Please try again.");
  }
};
