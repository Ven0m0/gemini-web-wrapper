import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'model']),
  content: z.string().min(1),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatReqSchema = z.object({
  prompt: z.string().min(1).max(50000),
  system: z.string().max(10000).optional(),
});

export type ChatReq = z.infer<typeof ChatReqSchema>;

export const ChatbotReqSchema = z.object({
  message: z.string().min(1).max(50000),
  history: z.array(ChatMessageSchema).max(50).default([]),
  system: z.string().max(10000).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type ChatbotReq = z.infer<typeof ChatbotReqSchema>;

export const CodeReqSchema = z.object({
  code: z.string().min(1).max(100000),
  instruction: z.string().min(1).max(10000),
});

export type CodeReq = z.infer<typeof CodeReqSchema>;

export const SessionQueryReqSchema = z.object({
  userId: z.string().min(1),
});

export type SessionQueryReq = z.infer<typeof SessionQueryReqSchema>;

export const CookieItemSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  domain: z.string().min(1),
  path: z.string().default('/'),
  expires: z.number().optional(),
  secure: z.boolean().default(true),
  httpOnly: z.boolean().default(true),
});

export type CookieItem = z.infer<typeof CookieItemSchema>;

export const ProfileCreateReqSchema = z.object({
  name: z.string().min(1),
  cookies: z.array(CookieItemSchema).min(1),
});

export type ProfileCreateReq = z.infer<typeof ProfileCreateReqSchema>;

export const ProfileSwitchReqSchema = z.object({
  name: z.string().min(1),
});

export type ProfileSwitchReq = z.infer<typeof ProfileSwitchReqSchema>;

export const GeminiChatReqSchema = z.object({
  message: z.string().min(1).max(50000),
  conversationId: z.string().optional(),
  profile: z.string().optional(),
});

export type GeminiChatReq = z.infer<typeof GeminiChatReqSchema>;

export const GitHubConfigSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  token: z.string().optional(),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export const GitHubFileReadReqSchema = z.object({
  config: GitHubConfigSchema,
  path: z.string().min(1),
});

export type GitHubFileReadReq = z.infer<typeof GitHubFileReadReqSchema>;

export const GitHubFileWriteReqSchema = z.object({
  config: GitHubConfigSchema,
  path: z.string().min(1),
  content: z.string(),
  message: z.string().min(1),
  sha: z.string().optional(),
});

export type GitHubFileWriteReq = z.infer<typeof GitHubFileWriteReqSchema>;

export const GitHubListReqSchema = z.object({
  config: GitHubConfigSchema,
  path: z.string().default(''),
});

export type GitHubListReq = z.infer<typeof GitHubListReqSchema>;

export const GitHubBranchesReqSchema = z.object({
  config: GitHubConfigSchema,
});

export type GitHubBranchesReq = z.infer<typeof GitHubBranchesReqSchema>;

export const GenResponseSchema = z.object({
  text: z.string(),
});

export type GenResponse = z.infer<typeof GenResponseSchema>;
