import z from "zod";
import { defineTool } from "@/foundation";
import { stat } from "node:fs/promises";
export const fileInfoTool = defineTool({
  name: "file_info",
  description: "Get information about a file",
  parameters: z.object({ description: z.string(), path: z.string() }),
  invoke: async ({ path }) => {
    try {
      const info = await stat(path);
      return { path, size: info.size, isFile: info.isFile(), isDirectory: info.isDirectory(), modified: info.mtime.toISOString() };
    } catch (error) { return { ok: false, error: String(error) }; }
  },
});
