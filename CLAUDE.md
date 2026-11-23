# CLAUDE.md

@AGENTS.md

## Claude Code only

`.claude/skills/` symlinks the skills in `.agents/skills/`. Two hooks in
`.agents/hooks/`, wired from `.claude/settings.json`, keep the skills table in
front of you: `skills-remind.mjs` lists the skills this session has not used
yet, and `skills-plan-gate.mjs` refuses `ExitPlanMode` until
`vectreal-iterative-delivery` has run and the plan carries a `## Work items`
table naming the Notion **Vectreal Work Items** rows it moves (the skill's Work
items section has the query and the table shape). Neither can block on an
error: an unreadable transcript or a bad payload lets work continue.
