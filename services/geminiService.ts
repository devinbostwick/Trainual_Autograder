import { GoogleGenAI, Type } from "@google/genai";
import { ExamDefinition, ExamResult, GradedQuestion } from "../types";

const parseScore = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
}

// Helper function to implement timeout for API calls
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`)), timeoutMs)
    ),
  ]);
};

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
       - **Partial Understanding = Substantial Credit**: If student demonstrates they understand the core concept but misses minor details, award most/all points
       
       **Examples**:
       - "Explain wine service" - Accept any logical sequence of steps even if not verbatim
       - "Describe pre-bussing" - Accept any explanation that captures the core concept
       - "Detail the process" - Focus on whether key steps are present, not exact phrasing
       - "What does 'Up' mean?" - Answer: "Shaken/Stirred with ice" shows understanding of chilled serving = FULL POINTS (they know ice is involved in prep, just not exact final presentation)
       
       **Key Principle**: If a hospitality professional reading the answer would say "yes, they get it" OR "they're close enough", award full/high credit. Only deduct if fundamentally wrong.
    
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
    
    === BEER & WINE KNOWLEDGE EXAM - SPECIFIC GUIDELINES ===
    
    For Beer & Wine Knowledge exams AND OAK Bartender exams, apply these additional LENIENT guidelines:
    
    **BEER NAME ALIASES (ALWAYS ACCEPT THESE)**:
    - "Dry Wrought" = "Austin" = "Austin Cider" = "Dry Wrought Mulled" (ALL CORRECT - same product)
    - "Strawberry Orange Mimosa" = "South Beach Mimosa" = "SB Mimosa" (ALL CORRECT - same product)
    - Accept ANY combination or variation of these names
    
    **BEER STYLE DESCRIPTIONS (Question 1-type)**:
    - Accept ANY semantically correct beer style names and variations
    - IPA = India Pale Ale = Indian Pale Ale = I.P.A. (ALL CORRECT)
    - Pilsner = Pils = Pilz = Czech Pilsner = German Pils (ALL CORRECT)
    - Hefeweizen = Hefe = Weiss = Weizen = Wit = Wheat Beer (ALL CORRECT)
    - Accept typos: Heffewisen, Pilzner, Portter, Ambor (ALL ACCEPTABLE)
    - Flavor descriptors: Accept ANY that semantically match the style
      * For IPAs: hoppy, bitter, citrus, citrusy, orange, grapefruit, pine, tropical, fruity
      * For Dark beers: dark, black, roasted, coffee, chocolate, cocoa, creamy, rich
      * For Wheat: banana, clove, bubblegum, yeasty, cloudy, hazy, spicy
      * For Lagers: crisp, clean, refreshing, light, golden, smooth, sessionable
    - Body/mouthfeel: light-bodied = light = thin = crisp (ALL SAME)
    - ABV: Accept approximations ("around 5%" = "5-6%" = "moderate")
    - Award 2 points per style (1 for name, 1 for description with detail)
    
    **GLUTEN-FREE PRODUCTS (Question 2-type)**:
    - Accept product name alone without category label ("Black Widow" without "(Cider)" = FULL CREDIT)
    - "Dry Wrought" = "Austin" = "Austin Cider" (ALL CORRECT - same product, accept any name)
    - "Strawberry Orange Mimosa" = "South Beach Mimosa" (ALL CORRECT - same product)
    - Brand abbreviations: "High Noon" without flavor = CORRECT (we only have one)
    - Typos: Originl Sin, Dry Wrout, Hi Noon, Longdrink, Austen (ALL ACCEPTABLE)
    - Partial credit: Generic "cider" without brand = 0.5 points
    - Award 1 point per correct item (max based on question points)
    
    **FLORIDA BEERS (Question 3-type)**:
    - "First Mag" = First Magnitude (CORRECT abbrev iation)
    - "C&G" = "C and G" = "Cypress & Grove" = "Cypress and Grove" (ALL CORRECT)
    - Accept ampersand variations: "&" vs "and" vs "+" (ALL CORRECT)
    - Brewery alone: "First Magnitude" without specific beer = 0.5 points (partial)
    - Award 1 point per correct item (max 4 points)
    
    **WINE VARIETALS (Question 4, 6, 7 types)**:
    - "Cab" = "Cab Sav" = Cabernet Sauvignon (CORRECT)
    - "Chard" = Chardonnay (CORRECT)
    - "Pinot Gris" = Pinot Grigio (CORRECT - same grape)
    - "PG" = Pinot Grigio, "PN" = Pinot Noir (CORRECT)
    - "Sauv Blanc" = "SB" = Sauvignon Blanc (CORRECT)
    - Typos: Cabarnet, Shadonay, Pinot Greegio, Malbeck (ALL ACCEPTABLE)
    - Missing brand but correct varietal = 0.75 points (they know the wine type)
    - Wrong brand but correct varietal = 0.75 points
    - Both brand + varietal correct = FULL points
    
    **HAPPY HOUR WINES vs BY-THE-GLASS WINES (PARTIAL CREDIT RULE)**:
    For questions asking "List the RED wines we serve by the glass" (bw-6, ob-4 red portion) or "List the WHITE wines we serve by the glass" (bw-7, ob-4 white portion):
    - The CORRECT answers are the by-the-glass wines (e.g., Don Genaro, Latitude 38, Romulo, Ferro 13 for reds; Villa Marin, Ponga, Echo Bay for whites).
    - If a student lists a HAPPY HOUR wine instead (Impero Cabernet Sauvignon, Impero Merlot for reds; Albertoni Chardonnay, Albertoni Pinot Grigio for whites), award 0.5 points per Happy Hour wine listed.
    - In the feedback, explicitly note: "Partial credit given — you listed a Happy Hour wine, not a by-the-glass wine."
    - If a student mixes correct by-the-glass wines WITH Happy Hour wines, give FULL credit for the correct ones and 0.5 points for each Happy Hour wine.
    - This rule also applies to ob-4 ("List all wines red & white we serve by the glass") — same partial credit for any Happy Hour wine listed in place of a by-the-glass wine.
    
    **WINE POUR SIZE (Question 5-type)**:
    - Accept: "6", "6oz", "6 oz", "6 ounces", "5-6", "About 6", "Six" (ALL CORRECT)
    - Partial credit: "5 ounces" = 0.5 points (close enough)
    - "4-6 ounces" = 0.5 points (range too wide but shows understanding)
    
    **ABV DEFINITION (Question 8-type)**:
    - Only accept "Alcohol By Volume" or minor typo "Alchohol By Volume"
    - "Alcohol content by volume" with extra word = CORRECT
    - Wrong answers: "Alcohol percentage", "Alcohol proof" = 0 points
    
    **CORE DRAFT BEERS (Question 9-type)**:
    - Accept brand abbreviations: "OBP" = Orange Blossom Pilsner (CORRECT)
    - Beer name alone implies style if obvious: "Big Nose" = Big Nose IPA (CORRECT)
    - Style variations: "Hazy IPA" = "Hazy" = "NEIPA" = "IPA" (ALL ACCEPTABLE)
    - "Red Ale" = "Irish Red" = "Amber" (ACCEPTABLE for Reel Slo)
    - Missing style detail: Award 1 point for brand, 1 point for style (2 per beer, 10 total)
    - Including brewery name: "Swamp Head Big Nose" = CORRECT (bonus knowledge)
    - Typos in brand names: Orang Blossom, Freedive, BigNose, Honee Bee (ALL ACCEPTABLE)
    
    **OVERALL BEER & WINE PHILOSOPHY**:
    - Grade like a bar manager during shift, not a professor grading written exam
    - Accept semantic correctness, synonyms, abbreviations, casual terminology
    - If a bartender would understand what the employee means = mark CORRECT
    - Partial credit is encouraged - reward knowledge even if incomplete
    - Do NOT penalize missing suffixes when product is obvious ("Butterscotch" = "Butterscotch Liqueur")
    - List questions: Proportional credit (4/5 correct = 80% of points)
    
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
    // Set a 60-second timeout for the API call
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: gradingSchema,
          temperature: 0, // Zero temperature for maximum consistency
        }
      }),
      60000 // 60 second timeout
    );

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI - empty response received");

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
    
    // Provide more specific error messages
    if (error.message?.includes('timed out')) {
      msg = "Request timed out after 60 seconds. The AI service may be experiencing delays. Please try again.";
    } else if (error.message?.includes('API key')) {
      msg = "Invalid API Key configuration. Please check your API key.";
    } else if (error.message?.includes('empty response')) {
      msg = "Received empty response from AI service. Please try again.";
    } else if (error.status === 429) {
      msg = "System is busy (Rate limit exceeded). Please wait a minute and try again.";
    } else if (error.status === 503 || error.status === 500) {
      msg = "AI service is temporarily unavailable. Please try again in a moment.";
    } else if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
      msg = "Network connection error. Please check your internet connection and try again.";
    } else if (error.message?.includes('JSON')) {
      msg = "Received invalid response format from AI. Please try again.";
    } else if (error.message) {
      // Include the actual error message if it's informative
      msg = `Error: ${error.message}`;
    }
    
    throw new Error(msg);
  }
};