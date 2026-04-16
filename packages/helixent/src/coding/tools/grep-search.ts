import z from "zod";
import { defineTool } from "@/foundation";
export const grepSearchTool = defineTool({
  name: "grep_search",
  description: "Search file contents with ripgrep",
  parameters: z.object({ description: z.string(), path: z.string(), pattern: z.string(), glob: z.string().optional(), caseSensitive: z.boolean().optional(), limit: z.number().optional() }),
  invoke: async ({ path, pattern, glob, caseSensitive, limit }, signal) => {
    const cmd = ["rg", "--line-number", "--no-heading"];
    if (!caseSensitive) cmd.push("--ignore-case");
    if (glob) cmd.push("--glob", glob);
    cmd.push(pattern, path);
    try {
      const proc = Bun.spawn({ cmd, stdout: "pipe", stderr: "pipe" });
      if (signal) { const onAbort = () => proc.kill(); signal.addEventListener("abort", onAbort, { once: true }); void proc.exited.then(() => signal.removeEventListener("abort", onAbort)); }
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0 && exitCode !== 1) return { ok: false, error: `rg failed with exit code ${exitCode}` };
      const lines = stdout.split("\n").filter(Boolean);
      const capped = lines.slice(0, limit ?? 200);
      return { path, pattern, totalMatches: lines.length, shownMatches: capped.length, matches: capped, content: capped.join("\n") };
    } catch (error) { return { ok: false, error: String(error) }; }
  },
});
