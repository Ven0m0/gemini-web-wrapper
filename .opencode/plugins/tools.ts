import type { Plugin } from "@opencode-ai/plugin"
import fastEditTool from "../tools/fastedit.ts"
import hashlineEditTool from "../tools/hashline_edit.ts"
import interactiveBashTool from "../tools/interactive_bash.ts"
import jsonRepairTool from "../tools/json_repair.ts"
import { read as hashlineRead, grep as hashlineGrep } from "../tools/hashline_rg.ts"
import { search as astGrepSearch, replace as astGrepReplace } from "../tools/ast_grep.ts"

const ToolsPlugin: Plugin = async () => ({
  tool: {
    fastedit: fastEditTool,
    hashline_edit: hashlineEditTool,
    interactive_bash: interactiveBashTool,
    json_repair: jsonRepairTool,
    hashline_read: hashlineRead,
    hashline_grep: hashlineGrep,
    ast_grep_search: astGrepSearch,
    ast_grep_replace: astGrepReplace,
  },
})

export default ToolsPlugin
