import z from "zod";
import { defineTool } from "@/foundation";
import { readdir } from "node:fs/promises";
export const listFilesTool = defineTool({
  name: "list_files",
  description: "List files and directories",
  parameters: z.object({ description: z.string(), path: z.string(), recursive: z.boolean().optional(), maxDepth: z.number().optional(), limit: z.number().optional() }),
  invoke: async ({ path, recursive, maxDepth, limit }) => {
    const entries: string[] = [];
    async function walk(dir: string, depth: number, prefix: string) {
      const items = await readdir(dir, { withFileTypes: true });
      items.sort((a, b) => a.name.localeCompare(b.name));
      for (const item of items) {
        const rel = prefix ? `${prefix}/${item.name}` : item.name;
        entries.push(item.isDirectory() ? `${rel}/` : rel);
        if (item.isDirectory() && depth < (maxDepth ?? 3) && recursive) await walk(`${dir}/${item.name}`, depth + 1, rel);
      }
    }
    await walk(path, 0, "");
    const capped = entries.slice(0, limit ?? 200);
    return { path, totalEntries: entries.length, shownEntries: capped.length, entries: capped, content: capped.join("\n") };
  },
});
