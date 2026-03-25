---
description: "Memory Bank system for maintaining project context across AI sessions"
applyTo: "**"
---

# Memory Bank

<HighLevelDetails>

Memory resets between sessions. The Memory Bank is the only link to previous work. Read ALL memory bank files at the start of EVERY task.

</HighLevelDetails>

## File Hierarchy

```
projectbrief.md     -> Foundation (core requirements, goals)
productContext.md   -> Why it exists, user experience goals
systemPatterns.md   -> Architecture, design patterns, decisions
techContext.md      -> Technologies, setup, constraints, deps
activeContext.md    -> Current focus, recent changes, next steps
progress.md         -> What works, what's left, known issues
tasks/              -> Individual task files + _index.md
```

<Standards>

**Core Files** (required): projectbrief.md, productContext.md, activeContext.md, systemPatterns.md, techContext.md, progress.md, tasks/

**Update Triggers**: New patterns discovered, significant changes implemented, user requests "update memory bank", context needs clarification

**Task Files**: `tasks/TASKID-taskname.md` with status, original request, thought process, implementation plan, progress log, subtask table

**Task Index**: `tasks/_index.md` sorted by status (In Progress, Pending, Completed, Abandoned)

</Standards>

## Workflows

**Plan Mode**: Read Memory Bank -> Check completeness -> Verify context -> Develop strategy -> Present approach

**Act Mode**: Check Memory Bank -> Update docs -> Update instructions if needed -> Execute task -> Document changes

**Task Management**: Create task file -> Document thought process -> Create plan -> Update \_index.md -> Execute -> Log progress -> Update status

## Task Commands

| Command                    | Action                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `add task` / `create task` | New task file with ID, plan, status, update \_index.md              |
| `update task [ID]`         | Add progress log entry, update status, update \_index.md            |
| `show tasks [filter]`      | Display filtered list (all/active/pending/completed/blocked/recent) |

<Goals>

- Precision and clarity in all documentation
- Update both subtask table AND progress log
- Task files preserve complete thought process and history
- After memory reset, quickly understand exact state of each task

</Goals>
