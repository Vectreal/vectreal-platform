#!/usr/bin/env node
/**
 * UserPromptSubmit: name the skills this session has not used yet.
 *
 * CLAUDE.md carries the same table, but it is injected once at session start
 * and then competes with a growing context, which is exactly when agents drift
 * off it. This restates only what is still missing, so it shrinks as skills get
 * invoked and goes silent once all three have run. An unconditional version of
 * this cost roughly 46k tokens over a 200-turn session.
 *
 * Fails open and silent: a hook that cannot run must never block or nag.
 */
import { SKILLS, skillsInvoked, readPayload } from './skills-invoked.mjs'

try {
	const payload = await readPayload()
	const missing = Object.entries(SKILLS).filter(
		([name]) => !skillsInvoked(payload.transcript_path).has(name),
	)
	if (missing.length) {
		const rows = missing.map(([name, when]) => `| ${name} | ${when} |`).join('\n')
		console.log(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: 'UserPromptSubmit',
					additionalContext: [
						'Vectreal skills are mandatory, not advisory. Invoke the matching skill',
						'BEFORE planning or editing, including in plan mode, where scoping is the work.',
						'',
						'| Not yet used this session | When to invoke |',
						'| --- | --- |',
						rows,
						'',
						'Leaving plan mode requires vectreal-iterative-delivery. Rows disappear as',
						'skills are invoked.',
					].join('\n'),
				},
			}),
		)
	}
} catch {
	// intentionally silent
}
