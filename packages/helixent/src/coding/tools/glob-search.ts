import z from "zod";
import { defineTool } from "@/foundation";
export const globSearchTool = defineTool({
  name: "glob_search",
  description: "Find files matching a glob pattern",
  parameters: z.object({ description: z.string(), path: z.string(), pattern: z.string(), limit: z.number().optional() }),
  invoke: async ({ path, pattern, limit }) => {
    const matches: string[] = [];
    try {
      const globber = new Bun.Glob(pattern);
      for await (const entry of globber.scan({ cwd: path, absolute: true })) {
        matches.push(entry);
        if (matches.length >= (limit ?? 200)) break;
      }
    } catch (error) { return { ok: false, error: String(error) }; }
    return { path, pattern, matchCount: matches.length, matches, content: matches.join("\n") };
  },
});
