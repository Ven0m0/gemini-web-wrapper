import z from "zod";
import { defineTool } from "@/foundation";
import { mkdir } from "node:fs/promises";
export const mkdirTool = defineTool({
  name: "mkdir",
  description: "Create a directory",
  parameters: z.object({ description: z.string(), path: z.string(), recursive: z.boolean().optional() }),
  invoke: async ({ path, recursive }) => {
    await mkdir(path, { recursive: recursive ?? true });
    return `Created directory ${path}`;
  },
});
