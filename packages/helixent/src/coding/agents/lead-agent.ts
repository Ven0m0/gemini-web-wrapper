import { join } from "path";
import { Agent } from "@/agent";
import { createSkillsMiddleware } from "../../agent/skills/skills-middleware";
import type { Model, NonSystemMessage, FunctionTool } from "@/foundation";
import { bashTool } from "../tools/bash";
import { readFileTool } from "../tools/read-file";
import { writeFileTool } from "../tools/write-file";
import { strReplaceTool } from "../tools/str-replace";
import { listFilesTool } from "../tools/list-files";
import { globSearchTool } from "../tools/glob-search";
import { grepSearchTool } from "../tools/grep-search";
import { applyPatchTool } from "../tools/apply-patch";
import { fileInfoTool } from "../tools/file-info";
import { mkdirTool } from "../tools/mkdir";
import { movePathTool } from "../tools/move-path";

export async function createCodingAgent({
  model,
  cwd = process.cwd(),
  skillsDirs = [join(process.cwd(), ".agents/skills")],
}: {
  model: Model;
  cwd?: string;
  skillsDirs?: string[];
}) {
  const agentsFile = Bun.file(`${cwd}/AGENTS.md`);
  const messages: NonSystemMessage[] = [];
  if (await agentsFile.exists()) {
    const content = await agentsFile.text();
    messages.push({ role: "user", content: [{ type: "text", text: `The AGENTS.md file has been automatically loaded:\n\n${content}` }] });
  }
  const tools = [bashTool, fileInfoTool, listFilesTool, globSearchTool, grepSearchTool, mkdirTool, movePathTool, readFileTool, writeFileTool, strReplaceTool, applyPatchTool] as unknown as FunctionTool[];
  return new Agent({ model, prompt: "You are a coding assistant. Use the available tools to help the user.", messages, tools, middlewares: [createSkillsMiddleware(skillsDirs)] });
}
