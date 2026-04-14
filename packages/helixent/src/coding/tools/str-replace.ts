import z from "zod";
import { defineTool } from "@/foundation";
export const strReplaceTool = defineTool({
  name: "str_replace",
  description: "Replace occurrences of a substring in a file",
  parameters: z.object({ description: z.string(), path: z.string(), old: z.string(), new: z.string(), count: z.number().optional() }),
  invoke: async ({ path, old, new: replacement, count }) => {
    const file = Bun.file(path);
    if (!(await file.exists())) return { ok: false, error: `File ${path} does not exist` };
    const text = await file.text();
    if (!old) return { ok: false, error: "old must be non-empty" };
    const updated = count === undefined ? text.split(old).join(replacement) : text.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replacement);
    if (updated === text) return { ok: true, path, replacements: 0, changed: false };
    await file.write(updated);
    return { ok: true, path, replacements: 1, changed: true };
  },
});
