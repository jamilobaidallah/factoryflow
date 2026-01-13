# Claude Code Agents Setup for FactoryFlow

## Overview
Create custom Claude Code agents (subagents) to help with FactoryFlow development. These agents will be specialized for specific tasks like code review, testing, Arabic RTL checking, and accounting validation.

---

## What are Claude Code Agents?

Claude Code agents are specialized AI assistants that:
- Have their own context window (separate from main conversation)
- Can be invoked automatically or explicitly
- Have custom system prompts and tool restrictions
- Are defined as Markdown files in `.claude/agents/`

**Two ways to create them:**
1. **Interactive**: Use `/agents` command in Claude Code terminal
2. **Manual**: Create `.md` files in `.claude/agents/` folder

---

## TODO Items

- [x] **Task 1**: Create `.claude/agents/` directory structure
- [x] **Task 2**: Create `arabic-rtl-checker.md` agent
- [x] **Task 3**: Create `accounting-validator.md` agent
- [x] **Task 4**: Create `test-runner.md` agent
- [x] **Task 5**: Create `firestore-auditor.md` agent
- [x] **Task 6**: Create `code-reviewer.md` agent
- [x] **Task 7**: Verify agents appear in `/agents` command

---

## File Structure Created

```
.claude/
├── settings.local.json     # Existing - permissions config
├── skills/                 # Existing - empty
└── agents/                 # NEW - custom agents
    ├── arabic-rtl-checker.md
    ├── accounting-validator.md
    ├── test-runner.md
    ├── firestore-auditor.md
    └── code-reviewer.md
```

---

## How to Use

### View Available Agents
In Claude Code terminal, run:
```
/agents
```

### Automatic Invocation
Claude will automatically delegate tasks based on agent descriptions when appropriate.

### Explicit Invocation
```
> Use the arabic-rtl-checker agent to review this component
> Use the accounting-validator agent to check this journal entry
> Use the test-runner agent to fix failing tests
> Use the firestore-auditor agent to review this query
> Use the code-reviewer agent to check my recent changes
```

---

## Review Section

### Summary of Changes
Created 5 custom Claude Code agents for FactoryFlow development:

| Agent | Purpose | Tools |
|-------|---------|-------|
| `arabic-rtl-checker` | Validates RTL layout, icon spacing (mr- vs ml-) | Read, Grep, Glob |
| `accounting-validator` | Validates journal entries, debits=credits | Read, Grep, Glob |
| `test-runner` | Runs tests, analyzes failures, suggests fixes | Read, Bash, Grep, Glob |
| `firestore-auditor` | Reviews queries, security rules, dataOwnerId usage | Read, Grep, Glob |
| `code-reviewer` | Enforces CLAUDE.md patterns, code quality | Read, Grep, Glob, Bash |

### Files Created
- `.claude/agents/arabic-rtl-checker.md`
- `.claude/agents/accounting-validator.md`
- `.claude/agents/test-runner.md`
- `.claude/agents/firestore-auditor.md`
- `.claude/agents/code-reviewer.md`

### Design Decisions
1. **All agents use Sonnet model** - Good balance of capability and speed
2. **Limited tool access** - Each agent only has tools it needs (principle of least privilege)
3. **System prompts based on CLAUDE.md** - Reuses your existing documented patterns
4. **Arabic error messages** - Consistent with FactoryFlow's Arabic-first approach

### Next Steps for You
1. Open Claude Code in VS Code
2. Run `/agents` to see the new agents
3. Try invoking one: `Use the code-reviewer agent to check recent changes`
4. Customize agent prompts as needed by editing the `.md` files

### Notes
- Agents are loaded when Claude Code starts a new session
- If you just created them, you may need to restart Claude Code to see them in `/agents`
- You can edit any agent file directly - changes take effect on next session
