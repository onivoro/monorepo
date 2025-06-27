import { TOpenAiData } from "./open-ai-data.type";

export type TOpenAiAnswer = {
  id: string;
  question: string;
  answer: string;
  relevantInput: TOpenAiData[];
}
