import { exists, readdir } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import type { AgentMiddleware } from "../agent-middleware";
import type { SkillFrontmatter } from "../index";
import { readSkillFrontMatter } from "./skill-reader";

export function createSkillsMiddleware(skillsDirs: string[] = [join(process.cwd(), ".agents/skills")]): AgentMiddleware {
  return {
    beforeAgentRun: async () => {
      const skills: SkillFrontmatter[] = [];
      const seen = new Set<string>();
      for (let dir of skillsDirs) {
        if (dir.startsWith("~")) dir = join(os.homedir(), dir.slice(1));
        if (!(await exists(dir))) continue;
        let folders: any[];
        try { folders = await readdir(dir, { withFileTypes: true }); } catch { continue; }
        const folderPromises = folders.map(async (folder) => {
          const skillPath = join(dir, folder.name, "SKILL.md");
          if (!folder.isDirectory() || seen.has(skillPath)) return null;
          seen.add(skillPath);
          if (!(await exists(skillPath))) return null;
          try { return await readSkillFrontMatter(skillPath); } catch { return null; }
        });
        const results = await Promise.all(folderPromises);
        for (const res of results) {
          if (res) skills.push(res);
        }
      }
      return { skills };
    },
    beforeModel: async ({ modelContext, agentContext }) => {
      const skills = agentContext.skills as SkillFrontmatter[] | undefined;
      if (skills && skills.length > 0) {
        const requested = agentContext.requestedSkillName
          ? skills.find((s) => (s.name ?? "").toLowerCase() === (agentContext.requestedSkillName as string).toLowerCase())
          : null;
        return {
          prompt: `${modelContext.prompt}\n\n<skills>\n${JSON.stringify(skills, null, 2)}\n</skills>\n${requested ? `<explicit_skill>${requested.name}</explicit_skill>\n` : ""}`,
        };
      }
    },
  };
}
