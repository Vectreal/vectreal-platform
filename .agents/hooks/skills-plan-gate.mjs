#!/usr/bin/env node
/**
 * PreToolUse(ExitPlanMode): a plan is not finished until the skill that owns
 * scoping has been read and the plan says which catalogue rows it moves.
 *
 * This is the only edit-blocking rule kept in the repo. Per-file gating was
 * tried and reverted: matching by top-level directory covered 1027 of 1109
 * tracked files, demanding a routing skill to fix a typo in a docs page while
 * leaving routes.tsx unguarded. Leaving plan mode is once per session and has
 * no false positives, so it is the one place a hard gate pays for itself.
 *
 * The work-items check exists because rows in Notion Vectreal Work Items stayed
 * open after their PR merged: nothing in the loop owned the close, so on
 * 2026-09-13 the sellable-artifact lane carried eight rows whose PRs had been on
 * main for a week. A plan that names its rows up front gives the close an owner.
 */
import { planCarriesWorkItems, skillsInvoked, readPayload } from './skills-invoked.mjs'

const REQUIRED = 'vectreal-iterative-delivery'

function deny(lines) {
	console.log(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: lines.join('\n'),
			},
		}),
	)
}

try {
	const payload = await readPayload()
	if (payload.tool_name === 'ExitPlanMode') {
		// `null` means the transcript could not be read, which is not the same as
		// "no skill invoked". Denying on it would be unescapable.
		const used = skillsInvoked(payload.transcript_path)
		if (used && !used.has(REQUIRED)) {
			deny([
				`Blocked: plans are scoped through ${REQUIRED}, which owns scoping,`,
				'the tier model that sets how much effort a change deserves, and the',
				'review loop the plan has to end in.',
				'',
				`Invoke it first: Skill(skill: "${REQUIRED}"), then present the plan.`,
			])
		} else if (planCarriesWorkItems(payload.transcript_path) === false) {
			deny([
				'Blocked: the plan has no "Work items" section. Every plan names the',
				'Notion Vectreal Work Items rows it moves, so the close has an owner',
				'once the review loop passes.',
				'',
				'Add a `## Work items` heading with one table row per catalogue row',
				'the scope implements or touches (link, status now, status after this',
				'PR), or the single line `none` when no open row matches. The Work',
				`items section of ${REQUIRED} has the query and the table shape.`,
			])
		}
	}
} catch {
	// Fail open: never let a broken hook trap someone in plan mode.
}
