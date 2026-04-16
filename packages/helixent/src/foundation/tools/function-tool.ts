import type { z } from "zod";

export interface FunctionTool<
  P extends z.ZodSchema<Record<string, unknown>> = z.ZodSchema<Record<string, unknown>>,
  R = unknown,
> {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>, signal?: AbortSignal) => Promise<R>;
}

export function defineTool<P extends z.ZodSchema<Record<string, unknown>>, R>({
  name,
  description,
  parameters,
  invoke,
}: {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>, signal?: AbortSignal) => Promise<R>;
}): FunctionTool<P, R> {
  return { name, description, parameters, invoke } as FunctionTool<P, R>;
}
