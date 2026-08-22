#!/usr/bin/env node
/**
 * PreToolUse(ExitPlanMode): a plan is not finished until the skill that owns
 * scoping has been read.
 *
 * This is the only edit-blocking rule kept in the repo. Per-file gating was
 * tried and reverted: matching by top-level directory covered 1027 of 1109
 * tracked files, demanding a routing skill to fix a typo in a docs page while
 * leaving routes.tsx unguarded. Leaving plan mode is once per session and has
 * no false positives, so it is the one place a hard gate pays for itself.
 */
import { skillsInvoked, readPayload } from './skills-invoked.mjs'

const REQUIRED = 'vectreal-iterative-delivery'

try {
	const payload = await readPayload()
	if (payload.tool_name === 'ExitPlanMode' &&
		!skillsInvoked(payload.transcript_path).has(REQUIRED)) {
		console.log(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: [
						`Blocked: plans are scoped through ${REQUIRED}, which owns scoping,`,
						'the tier model that sets how much effort a change deserves, and the',
						'review loop the plan has to end in.',
						'',
						`Invoke it first: Skill(skill: "${REQUIRED}"), then present the plan.`,
					].join('\n'),
				},
			}),
		)
	}
} catch {
	// Fail open: never let a broken hook trap someone in plan mode.
}
