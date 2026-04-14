import type { NonSystemMessage, Tool } from "../messages";

export interface ModelContext {
  prompt: string;
  messages: NonSystemMessage[];
  tools?: Tool[];
  signal?: AbortSignal;
}
