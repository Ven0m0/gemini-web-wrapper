import z from "zod";
import { defineTool } from "@/foundation";
export const bashTool = defineTool({
  name: "bash",
  description: "Execute a bash command",
  parameters: z.object({ description: z.string(), command: z.string() }),
  invoke: async ({ command }, signal) => {
    const proc = Bun.spawn({ cmd: ["bash", "-c", command], stdout: "pipe", stderr: "pipe" });
    if (signal) { const onAbort = () => proc.kill(); signal.addEventListener("abort", onAbort, { once: true }); void proc.exited.then(() => signal.removeEventListener("abort", onAbort)); }
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) { const stderr = await new Response(proc.stderr).text(); return `Error: Command failed with exit code ${exitCode}: ${stderr}`; }
    return output;
  },
});
