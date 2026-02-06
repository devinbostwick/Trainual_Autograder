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
  let systemContext = `You are a helpful AI tutor for OpsFlow hospitality training. 
You help students understand their exam results, clarify concepts, and improve their knowledge.
Be encouraging, clear, and educational in your responses.`;

  if (examResult) {
    const incorrectQuestions = examResult.questions.filter(q => !q.isCorrect);
    systemContext += `\n\nThe student just completed the "${examResult.examTitle}" exam.
Score: ${examResult.totalScore}/${examResult.maxScore} (${examResult.percentage.toFixed(1)}%)

Questions they got wrong:
${incorrectQuestions.map(q => `
- ${q.questionText}
  Their answer: ${q.studentAnswer}
  Feedback: ${q.feedback}
`).join('\n')}`;
  }

  // Build conversation history
  const conversationText = chatHistory.map(msg => 
    `${msg.role === 'user' ? 'Student' : 'AI Tutor'}: ${msg.content}`
  ).join('\n\n');

  const fullPrompt = `${systemContext}

${conversationText ? `Previous conversation:\n${conversationText}\n\n` : ''}Student: ${message}

AI Tutor:`;

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
