import { assertFileExists } from "@/foundation/utils/file";

export async function readSkillFrontMatter(path: string): Promise<any> {
  const file = await assertFileExists(path);
  const content = await file.text();
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return { path, name: path.split("/").pop() };
  const yaml = match[1] ?? "";
  const data: Record<string, unknown> = {};
  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      data[key] = val;
    }
  }
  return { ...data, path };
}
