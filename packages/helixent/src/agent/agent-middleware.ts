import type { ModelContext } from "@/foundation";

export interface AgentMiddleware {
  beforeAgentRun?: () => Promise<Record<string, unknown>>;
  beforeModel?: (context: { modelContext: ModelContext; agentContext: Record<string, unknown> }) => Promise<Partial<ModelContext> | undefined>;
}
