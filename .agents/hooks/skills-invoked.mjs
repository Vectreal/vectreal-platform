/**
 * Which Vectreal skills have actually run in this session.
 *
 * Read from the transcript rather than a state file. State on disk was the
 * source of every serious defect in the first version of these hooks: an
 * unwritable directory wedged the gate into a deny loop it could never satisfy,
 * ids collided after sanitizing, and files accumulated with no cleanup. The
 * transcript is already there, is ground truth about what executed rather than
 * what was typed, and costs nothing extra to read.
 *
 * Node, not jq: package.json requires node >=22.22.0, so it is the one
 * interpreter every contributor is guaranteed to have.
 */
import { readFileSync } from 'node:fs'

export const SKILLS = {
	'vectreal-extension-architecture':
		'routes, loaders, actions, domain modules, repositories, services, permissions, Drizzle, the client/server boundary',
	'vectreal-brand-ux-design':
		'anything a user can see: styling, layout, tokens, type, elevation, motion, empty/loading/error states, responsive, a11y',
	'vectreal-iterative-delivery':
		'scoping ambiguous or cross-cutting work, and shipping any PR (owns the review loop)',
}

export function skillsInvoked(transcriptPath) {
	const used = new Set()
	if (!transcriptPath) return used
	let raw
	try {
		raw = readFileSync(transcriptPath, 'utf8')
	} catch {
		return used // no transcript yet: treat as nothing invoked
	}
	for (const line of raw.split('\n')) {
		// Cheap reject before parsing; transcripts reach megabytes.
		if (!line.includes('"Skill"')) continue
		let record
		try {
			record = JSON.parse(line)
		} catch {
			continue
		}
		for (const block of record.message?.content ?? []) {
			if (block.type !== 'tool_use' || block.name !== 'Skill') continue
			// Plugin skills arrive as `plugin:skill`; compare the bare name so a
			// glob can never match a neighbour like vectreal-marketing.
			const name = String(block.input?.skill ?? '').split(':').pop()
			if (name in SKILLS) used.add(name)
		}
	}
	return used
}

/** Read one JSON payload from stdin. */
export async function readPayload() {
	let data = ''
	for await (const chunk of process.stdin) data += chunk
	return JSON.parse(data)
}
