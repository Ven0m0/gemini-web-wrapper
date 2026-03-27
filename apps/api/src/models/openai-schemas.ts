import { z } from 'zod';

export const FunctionDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export type FunctionDefinition = z.infer<typeof FunctionDefinitionSchema>;

export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: FunctionDefinitionSchema,
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const FunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});

export type FunctionCall = z.infer<typeof FunctionCallSchema>;

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: FunctionCallSchema,
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ChatCompletionMessageContentSchema = z.object({
  type: z.string().default('text'),
  text: z.string().optional(),
  imageUrl: z.record(z.unknown()).optional(),
});

export type ChatCompletionMessageContent = z.infer<typeof ChatCompletionMessageContentSchema>;

export const ChatCompletionMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string(),
    z.array(ChatCompletionMessageContentSchema),
    z.array(z.record(z.unknown())),
  ]).optional().nullable(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
}).passthrough();

export type ChatCompletionMessage = z.infer<typeof ChatCompletionMessageSchema>;

export const ChatCompletionRequestSchema = z.object({
  model: z.string().optional(),
  messages: z.array(ChatCompletionMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
  stream: z.boolean().default(false),
  tools: z.array(ToolDefinitionSchema).optional(),
  toolChoice: z.union([
    z.literal('none'),
    z.literal('auto'),
    z.literal('required'),
    z.record(z.unknown()),
  ]).optional().default('auto'),
  n: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  logitBias: z.record(z.number()).optional(),
  user: z.string().optional(),
  seed: z.number().optional(),
  responseFormat: z.record(z.unknown()).optional(),
  streamOptions: z.record(z.unknown()).optional(),
}).passthrough();

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

export const ChatCompletionResponseUsageSchema = z.object({
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
});

export type ChatCompletionResponseUsage = z.infer<typeof ChatCompletionResponseUsageSchema>;

export const ChatCompletionResponseChoiceSchema = z.object({
  index: z.number(),
  message: ChatCompletionMessageSchema,
  finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).default('stop'),
});

export type ChatCompletionResponseChoice = z.infer<typeof ChatCompletionResponseChoiceSchema>;

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatCompletionResponseChoiceSchema),
  usage: ChatCompletionResponseUsageSchema.optional(),
  systemFingerprint: z.string().optional(),
});

export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

export const ChatCompletionChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    delta: z.record(z.unknown()),
    finishReason: z.string().nullable(),
  })),
  usage: ChatCompletionResponseUsageSchema.optional(),
});

export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunkSchema>;
