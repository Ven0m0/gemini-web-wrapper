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

    let updated = text;
    let replacements = 0;

    if (count === undefined) {
      const parts = text.split(old);
      replacements = parts.length - 1;
      updated = parts.join(replacement);
    } else {
      const maxReplacements = Math.max(0, Math.trunc(count));
      let startIndex = 0;
      let result = "";

      while (replacements < maxReplacements) {
        const matchIndex = text.indexOf(old, startIndex);
        if (matchIndex === -1) break;

        result += text.slice(startIndex, matchIndex) + replacement;
        startIndex = matchIndex + old.length;
        replacements += 1;
      }

      if (replacements > 0) {
        updated = result + text.slice(startIndex);
      }
    }

    if (updated === text) return { ok: true, path, replacements: 0, changed: false };
    await file.write(updated);
    return { ok: true, path, replacements, changed: true };
  },
});
