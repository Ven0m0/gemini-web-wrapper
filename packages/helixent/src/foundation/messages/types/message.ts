import type { AssistantMessageContent, SystemMessageContent, ToolMessageContent, UserMessageContent } from "./content";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface SystemMessage {
  role: "system";
  content: SystemMessageContent;
}

export interface UserMessage {
  role: "user";
  content: UserMessageContent;
}

export interface AssistantMessage {
  role: "assistant";
  content: AssistantMessageContent;
  usage?: TokenUsage;
  streaming?: boolean;
}

export interface ToolMessage {
  role: "tool";
  content: ToolMessageContent;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type NonSystemMessage = UserMessage | AssistantMessage | ToolMessage;
export type Message = SystemMessage | NonSystemMessage;
