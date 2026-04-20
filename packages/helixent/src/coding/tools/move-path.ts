import z from "zod";
import { defineTool } from "@/foundation";
import { rename } from "node:fs/promises";
export const movePathTool = defineTool({
  name: "move_path",
  description: "Move or rename a file or directory",
  parameters: z.object({ description: z.string(), source: z.string(), destination: z.string() }),
  invoke: async ({ source, destination }) => {
    await rename(source, destination);
    return `Moved ${source} to ${destination}`;
  },
});
