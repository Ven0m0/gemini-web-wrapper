import z from "zod";
import { defineTool } from "@/foundation";
import { assertFileExists } from "@/foundation/utils/file";
export const readFileTool = defineTool({
  name: "read_file",
  description: "Read a file from an absolute path",
  parameters: z.object({ description: z.string(), path: z.string(), startLine: z.number().optional(), endLine: z.number().optional() }),
  invoke: async ({ path, startLine, endLine }) => {
    let file;
    try {
      file = await assertFileExists(path);
    } catch {
      return `Error: File ${path} does not exist`;
    }
    const text = await file.text();
    const lines = text.split("\n");
    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const selected = lines.slice(start, end);
    return selected.map((line, i) => `${start + i + 1}: ${line}`).join("\n");
  },
});
