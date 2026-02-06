export enum TestCategory {
  STANDARDIZED = 'Standardized',
  OAK = 'Original American Kitchen',
  CANTINA = 'Cantina Añejo'
}

export enum Role {
  BARTENDER = 'Bartender',
  SERVER = 'Server',
  HOST = 'Host'
}

export interface QuestionKey {
  id: string;
  questionText: string;
  correctAnswer: string;
  points: number;
}

export interface ExamDefinition {
  id: string;
  title: string;
  category: TestCategory;
  role: Role;
  subType?: string; // e.g., "Speciality Cocktails"
  answerKey: QuestionKey[]; // In a real app, this might be fetched securely
}

export interface GradedQuestion {
  questionId: string;
  questionText: string; // Added field for display
  studentAnswer: string;
  isCorrect: boolean;
  score: number;
  maxPoints: number;
  feedback: string;
}

export interface ExamResult {
  examId: string;
  examTitle: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questions: GradedQuestion[];
  rawFeedback?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}