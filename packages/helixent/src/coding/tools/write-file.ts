import z from "zod";
import { defineTool } from "@/foundation";
export const writeFileTool = defineTool({
  name: "write_file",
  description: "Write to a file at an absolute path",
  parameters: z.object({ description: z.string(), path: z.string(), content: z.string() }),
  invoke: async ({ path, content }) => {
    const file = Bun.file(path);
    await file.write(content);
    return `Successfully wrote ${content.length} bytes to ${path}`;
  },
});
