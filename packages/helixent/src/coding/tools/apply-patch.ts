import z from "zod";
import { defineTool } from "@/foundation";
export const applyPatchTool = defineTool({
  name: "apply_patch",
  description: "Apply a unified diff patch",
  parameters: z.object({ description: z.string(), patch: z.string() }),
  invoke: async ({ patch }) => {
    try {
      const proc = Bun.spawn({ cmd: ["patch", "-p1"], stdin: "pipe", stdout: "pipe", stderr: "pipe" });
      proc.stdin.write(patch);
      proc.stdin.end();
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) { const stderr = await new Response(proc.stderr).text(); return { ok: false, error: stderr || stdout }; }
      return { ok: true, summary: "Patch applied successfully", output: stdout };
    } catch (error) { return { ok: false, error: String(error) }; }
  },
});
