import type { Model, ModelContext, NonSystemMessage, FunctionTool, Tool } from "@/foundation";
import type { AgentMiddleware } from "./agent-middleware";
export type { AgentMiddleware };

export interface SkillFrontmatter {
  path: string;
  name?: string;
  [key: string]: unknown;
}

export interface AgentContext {
  skills?: SkillFrontmatter[];
  requestedSkillName?: string;
  [key: string]: unknown;
}

export interface AgentOptions {
  model: Model;
  prompt?: string;
  messages?: NonSystemMessage[];
  tools?: FunctionTool[];
  middlewares?: AgentMiddleware[];
}

export type AgentEvent =
  | { type: "message"; message: any }
  | { type: "progress"; subtype: "thinking" | "tool" | "result"; data: any };

export type AgentEventType = AgentEvent["type"];
export type AgentProgressSubtype = "thinking" | "tool" | "result";
export type AgentMessageEvent = Extract<AgentEvent, { type: "message" }>;
export type AgentProgressThinkingEvent = Extract<AgentEvent, { subtype: "thinking" }>;
export type AgentProgressToolEvent = Extract<AgentEvent, { subtype: "tool" }>;
export type AgentProgressEvent = Extract<AgentEvent, { type: "progress" }>;

export function formatToolResultForMessage(toolName: string, result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result);
}

export class Agent {
  readonly model: Model;
  readonly prompt: string;
  readonly messages: NonSystemMessage[];
  readonly tools: FunctionTool[];
  readonly middlewares: AgentMiddleware[];
  private _context: AgentContext = {};

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.prompt = options.prompt ?? "";
    this.messages = options.messages ?? [];
    this.tools = options.tools ?? [];
    this.middlewares = options.middlewares ?? [];
  }

  async run(input?: string): Promise<any> {
    const middlewareResults: Record<string, unknown> = {};
    for (const mw of this.middlewares) {
      if (mw.beforeAgentRun) {
        const result = await mw.beforeAgentRun();
        Object.assign(middlewareResults, result);
      }
    }
    this._context = { ...this._context, ...middlewareResults };

    const modelContext: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools as unknown as Tool[],
    };

    for (const mw of this.middlewares) {
      if (mw.beforeModel) {
        const result = await mw.beforeModel({ modelContext, agentContext: this._context });
        if (result) {
          if (result.prompt !== undefined) modelContext.prompt = result.prompt;
          if (result.messages !== undefined) modelContext.messages = result.messages;
          if (result.tools !== undefined) modelContext.tools = result.tools;
        }
      }
    }

    return this.model.invoke(modelContext);
  }

  async *runStream(input?: string): AsyncGenerator<any> {
    const middlewareResults: Record<string, unknown> = {};
    for (const mw of this.middlewares) {
      if (mw.beforeAgentRun) {
        const result = await mw.beforeAgentRun();
        Object.assign(middlewareResults, result);
      }
    }
    this._context = { ...this._context, ...middlewareResults };

    const modelContext: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools as unknown as Tool[],
    };

    for (const mw of this.middlewares) {
      if (mw.beforeModel) {
        const result = await mw.beforeModel({ modelContext, agentContext: this._context });
        if (result) {
          if (result.prompt !== undefined) modelContext.prompt = result.prompt;
          if (result.messages !== undefined) modelContext.messages = result.messages;
          if (result.tools !== undefined) modelContext.tools = result.tools;
        }
      }
    }

    yield* this.model.stream(modelContext);
  }

  get context(): AgentContext {
    return this._context;
  }
}
