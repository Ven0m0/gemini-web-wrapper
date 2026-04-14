/**
 * Plain text segment in a message.
 */
export interface TextContent {
  type: "text";
  text: string;
}

/**
 * Image referenced by URL, for multimodal user input.
 */
export interface ImageURLContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "high" | "low";
  };
}

/**
 * Model reasoning or chain-of-thought text.
 */
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

/**
 * Assistant-initiated tool invocation with structured arguments.
 */
export interface ToolUseContent<T extends Record<string, unknown> = Record<string, unknown>> {
  type: "tool_use";
  id: string;
  name: string;
  input: T;
}

/**
 * Result of executing a tool, linked back to a prior ToolUseContent by id.
 */
export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

/** Content allowed in a system message. */
export type SystemMessageContent = TextContent[];

/** Content allowed in a user message (text and/or images). */
export type UserMessageContent = (TextContent | ImageURLContent)[];

/** Content allowed in an assistant message. */
export type AssistantMessageContent = (TextContent | ThinkingContent | ToolUseContent)[];

/** Content allowed in a tool role message. */
export type ToolMessageContent = ToolResultContent[];
