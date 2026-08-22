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

// `/vectreal-iterative-delivery` loads the skill without ever producing a Skill
// tool_use, so counting only tool calls denied people who had read it.
const SLASH_COMMAND = /<command-name>\/?(vectreal-[a-z-]+)<\/command-name>/g

function collectSlashCommands(text, into) {
	if (typeof text !== 'string') return
	for (const [, name] of text.matchAll(SLASH_COMMAND)) {
		if (Object.hasOwn(SKILLS, name)) into.add(name)
	}
}

/**
 * @returns a Set of skill names, or `null` when the transcript cannot be read.
 * `null` means "cannot tell", which callers must not treat as "none invoked":
 * an unreadable transcript would otherwise deny forever, and invoking the skill
 * could never clear it because the deny does not depend on the skill.
 */
export function skillsInvoked(transcriptPath) {
	if (!transcriptPath) return null
	let raw
	try {
		raw = readFileSync(transcriptPath, 'utf8')
	} catch {
		return null
	}

	// A tool_use block is written before the tool runs; failure shows up later as
	// a separate tool_result with is_error. Pair them, or a Skill call the user
	// rejected would satisfy the gate.
	const attempted = new Map()
	const failed = new Set()
	const used = new Set()

	for (const line of raw.split('\n')) {
		// Cheap reject before parsing; transcripts reach megabytes. `is_error`
		// has to survive it, or the tool_result that marks a Skill call failed
		// is skipped and a rejected call still satisfies the gate.
		if (
			!line.includes('"Skill"') &&
			!line.includes('<command-name>') &&
			!line.includes('is_error')
		) {
			continue
		}
		let record
		try {
			record = JSON.parse(line)
		} catch {
			continue
		}
		const content = record.message?.content
		if (typeof content === 'string') {
			collectSlashCommands(content, used)
			continue
		}
		if (!Array.isArray(content)) continue
		for (const block of content) {
			if (!block || typeof block !== 'object') continue
			if (block.type === 'tool_use' && block.name === 'Skill') {
				// Exact match on the bare name. Taking the last `:` segment would
				// have let any plugin shipping `anything:vectreal-…` satisfy this.
				const skill = block.input?.skill
				if (typeof skill === 'string' && Object.hasOwn(SKILLS, skill)) {
					attempted.set(block.id, skill)
				}
			} else if (block.type === 'tool_result' && block.is_error) {
				failed.add(block.tool_use_id)
			} else if (block.type === 'text') {
				collectSlashCommands(block.text, used)
			}
		}
	}

	for (const [id, skill] of attempted) if (!failed.has(id)) used.add(skill)
	return used
}

/** Read one JSON payload from stdin. */
export async function readPayload() {
	let data = ''
	for await (const chunk of process.stdin) data += chunk
	return JSON.parse(data)
}
