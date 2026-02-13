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
    
    === FACTUAL QUESTIONS (Ingredients, Numbers, Lists) ===
    
    1. **Units & Measurements**: Ignore missing or varying units if the number is correct.
       - "1" = "1oz" = "1 oz" = "1 ounce" (ALL CORRECT)
       - ".5" = "0.5" = "½" = "half" (ALL CORRECT)
    
    2. **Abbreviations & Terminology**: Accept common variations and synonyms.
       - "repo" = "reposado" (CORRECT)
       - "top" = "splash" = "float" (CORRECT for finishing touches)
       - "soda" = "soda water" = "club soda" (CORRECT)
    
    3. **Product Names - Lenient Matching (Grade Like a Human)**:
       - Accept partial product names if the core identifier is present
       - CORRECT brand = Full points
       - WRONG brand (e.g., "Tito's" when answer is "Grey Goose") = Zero points
       - Generic name instead of brand (e.g., "vodka" when answer is "Grey Goose") = Deduct 0.5 points
       
       **Product Type Suffixes (ALL ACCEPTABLE)**:
       - "Butterscotch" = "Butterscotch Liqueur" (CORRECT - obvious what they mean)
       - "Simple" = "Simple Syrup" (CORRECT - obvious what they mean)
       - "Ginger" = "Ginger Syrup" or "Ginger Liqueur" (CORRECT - context makes it clear)
       - "Agave" = "Agave Syrup" or "Agave Nectar" (CORRECT)
       - "Triple Sec" = "Triple Sec Liqueur" (CORRECT)
       - "Irish Cream" = "McGuire's Irish Cream" (CORRECT - generic for branded is OK)
       
       **Examples**:
         * Answer key: "Grey Goose vodka" → Student: "Grey Goose" = Full points
         * Answer key: "Grey Goose vodka" → Student: "vodka" = -0.5 points
         * Answer key: "Grey Goose vodka" → Student: "Tito's" = 0 points (wrong brand)
         * Answer key: "Butterscotch Liqueur" → Student: "Butterscotch" = Full points (obvious)
         * Answer key: "Simple Syrup" → Student: "Simple" = Full points (obvious)
         * Answer key: "Ginger Syrup" → Student: "Ginger" = Full points (obvious)
         * Answer key: "Patron reposado" → Student: "tequila" = -0.5 points
         * Answer key: "Patron reposado" → Student: "Patron" = Full points
    
    4. **Spelling & Typos**: Be forgiving of minor spelling errors (1-2 characters).
       - "patron" vs "patrón" (CORRECT)
       - "cointreau" vs "cointrau" (CORRECT)
       - "grey goose" vs "gray goose" (CORRECT)
    
    5. **Formatting**: Ignore capitalization, extra spaces, and punctuation differences.
       - "Salt Rim" = "salt rim" = "saltrim" (CORRECT)
    
    6. **Order**: Ingredient order doesn't matter unless explicitly required.
       - "tequila, lime, triple sec" = "triple sec, tequila, lime" (CORRECT)
    
    7. **Missing Information**: Only mark incorrect if critical details are completely absent.
       - Missing garnish when it's specified = Partial credit (-0.5 points)
       - Wrong ingredient = Zero points
       - Missing "syrup", "liqueur", "juice" suffix when product is obvious = Full points (human-like grading)
    
    8. **Common Ingredient Synonyms (ALL ACCEPTABLE)**:
       - "OJ" = "Orange Juice" (CORRECT)
       - "Cran" = "Cranberry" = "Cranberry Juice" (CORRECT)
       - "Pineapple" = "Pineapple Juice" (CORRECT when context is clear)
       - "Lime" = "Lime Juice" (CORRECT in cocktail context)
       - "Lemon" = "Lemon Juice" (CORRECT in cocktail context)
       - "Sour" = "Sour Mix" (CORRECT)
       - "Bitters" alone when specific type obvious from context = Full points
       - "Champagne" = "Sparkling Wine" = "Prosecco" (CORRECT - same category)
       - "Tonic" = "Tonic Water" (CORRECT)
       - "Grenadine" alone acceptable even if brand specified (CORRECT)
    
    9. **Brand Flexibility - Accept Reasonable Substitutions**:
       - House/Well/Bar brands: Accept ANY generic term
         * "House vodka" = "Well vodka" = "Bar vodka" = "vodka" (ALL CORRECT)
         * "House rum" = "Bar rum" = "Bacardi" = "rum" (ALL CORRECT)
       - Common substitutions within same spirit category:
         * "Bourbon" when "Rye Whiskey" specified = -0.5 points (close enough)
         * "Gin" when specific gin brand = -0.5 points (generic for branded)
       - Premium upgrades: If student lists premium brand when house brand specified = Full points
         * Answer: "House vodka" → Student: "Grey Goose" = Full points (upgraded, shows knowledge)
    
    10. **Measurement Tolerance - Be Flexible**:
       - Accept ±0.25oz variations for non-critical measurements
         * 0.5oz vs 0.75oz = Partial credit if minor ingredient
         * 1oz vs 1.5oz for main spirit = More strict
       - "Splash" = "Top" = "Float" = Any small amount (CORRECT)
       - "Dash" = "Drop" = "Few drops" (CORRECT)
       - Missing exact oz on garnish/bitters = Full points (not critical)
    
    11. **List Questions - Partial Credit Logic**:
       - "List 5 items" but student lists 4 correct = 80% credit
       - "List 6 bourbons" but student lists 5 correct = 83% credit
       - ANY correct items from an acceptable list = proportional credit
       - Order doesn't matter unless specifically requested
       - Extra incorrect items don't penalize if minimums met
    
    === CONCEPTUAL QUESTIONS (Processes, Explanations, Scenarios) ===
    
    12. **"Explain" Questions - General Logic Acceptance**:
       - Questions asking to "explain", "describe", "detail process" should be graded on UNDERSTANDING, not exact wording
       - Accept answers that demonstrate comprehension even if worded differently
       - Focus on: Does the student understand the concept/process?
       
       **Examples**:
       - "Explain wine service" - Accept any logical sequence of steps even if not verbatim
       - "Describe pre-bussing" - Accept any explanation that captures the core concept
       - "Detail the process" - Focus on whether key steps are present, not exact phrasing
       
       **Key Principle**: If a hospitality professional reading the answer would say "yes, they get it", award full/high credit
    
    13. **Procedural Questions - Step Order Flexibility**:
       - For multi-step processes, minor step reordering is acceptable if logical
       - Core critical steps must be present (e.g., "taste wine before serving guests")
       - Supporting details can be in any order
       - Missing ONE minor step from 7+ step process = -0.5 to -1 point max (not zero)
    
    14. **Scenario Questions - Accept Multiple Valid Approaches**:
       - Guest service scenarios often have multiple correct responses
       - Any professional, hospitable response that solves the problem = Full credit
       - Don't require exact script matching
       
       **Examples**:
       - "How to handle upset guest?" - ANY empathetic, solution-focused response = Full credit
       - "Guest asks about reservation" - ANY polite, helpful explanation = Full credit
       - "Accommodate extra guests?" - ANY logical approach (check system, offer alternatives) = Full credit
    
    15. **Concept-Based Grading**: For questions marked as "conceptual" with requiredConcepts:
       - Identify each required concept in the student's answer
       - Award partial credit proportionally based on concepts covered
       - Accept paraphrasing and synonyms if the core meaning is preserved
       - Formula: (concepts_found / total_required_concepts) × max_points
       
       Example: Question worth 4 points with 5 required concepts
       - Student covers 5/5 concepts = 4.0 points (100%)
       - Student covers 4/5 concepts = 3.2 points (80%)
       - Student covers 3/5 concepts = 2.4 points (60%)
       - Student covers 2/5 concepts = 1.6 points (40%)
    
    16. **Minimum Concept Threshold**: If minimumConcepts is specified:
       - Student MUST meet minimum to receive any credit
       - Below minimum = 0 points
       - At or above minimum = proportional credit applies
       
       Example: 4-point question, 5 concepts, minimum 3 required
       - Student covers 2/5 = 0 points (below minimum)
       - Student covers 3/5 = 2.4 points (meets minimum, gets 60%)
       - Student covers 4/5 = 3.2 points (80%)
    
    17. **Semantic Equivalence for Concepts**: Accept variations in wording:
        - "Greet warmly" = "Welcome with a smile" = "Friendly greeting" (SAME CONCEPT)
        - "Check availability" = "Look in the system" = "Verify in Resy" (SAME CONCEPT)
        - "Apologize for delay" = "Say sorry for the wait" = "Express regret" (SAME CONCEPT)
    
    18. **Professional Tone Recognition**: For scenario-based questions:
        - If answer demonstrates appropriate hospitality tone, award concept credit
        - Key indicators: polite, solution-oriented, empathetic, professional
        - Missing professional tone when required = deduct 0.5 points
    
    CONSISTENCY IS CRITICAL:
    - The SAME answer submitted multiple times MUST receive the SAME score every time
    - Use the schema to extract answers systematically
    - Be deterministic in your evaluation
    - For conceptual questions, systematically check each required concept
    
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