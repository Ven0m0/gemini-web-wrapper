import { exists, readdir } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import type { AgentMiddleware } from "../agent-middleware";
import { readSkillFrontMatter } from "./skill-reader";

export interface SkillFrontmatter {
  path: string;
  name?: string;
  [key: string]: unknown;
}

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
        for (const folder of folders) {
          const skillPath = join(dir, folder.name, "SKILL.md");
          if (!folder.isDirectory() || seen.has(skillPath)) continue;
          if (!(await exists(skillPath))) continue;
          seen.add(skillPath);
          try { skills.push(await readSkillFrontMatter(skillPath)); } catch {}
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
          prompt: modelContext.prompt + `\n\n<skills>\n${JSON.stringify(skills, null, 2)}\n</skills>\n${requested ? `<explicit_skill>${requested.name}</explicit_skill>\n` : ""}`,
        };
      }
    },
  };
}
