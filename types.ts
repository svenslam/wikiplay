
export enum Category {
  HISTORY = 'Geschiedenis',
  SCIENCE = 'Wetenschap',
  NATURE = 'Natuur',
  SPORTS = 'Sport',
  ART = 'Kunst',
  TECH = 'Technologie',
  GEOGRAPHY = 'Geografie',
  ENTERTAINMENT = 'Entertainment',
}

export interface RadioStation {
  name: string;
  genre: string;
  url: string;
}

export interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface TopicContent {
  fact: string;
  quiz: QuizData;
}

export enum GameState {
  IDLE = 'IDLE',
  SPINNING = 'SPINNING',
  THROWN = 'THROWN',
  FETCHING = 'FETCHING',
  SHOWING_CONTENT = 'SHOWING_CONTENT',
}

export interface DartCoordinates {
  x: number;
  y: number;
  rotation: number;
}

export type ScoreBoard = Record<Category, { correct: number; wrong: number }>;
