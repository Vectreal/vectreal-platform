/**
 * What this session has actually done, read from the transcript.
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

// Plan mode writes the plan through the Write tool into the plans directory,
// `~/.claude/plans/` unless `plansDirectory` moves it. Anything else under a
// `plans/` directory is treated the same, which is the one false positive this
// accepts: it is rare, and the section it asks for costs one line.
const PLAN_FILE = /\/plans\/[^/]+\.md$/

export const WORK_ITEMS_HEADING = /^#{1,6}[ \t]+work items\b/im

function collectSlashCommands(text, into) {
	if (typeof text !== 'string') return
	for (const [, name] of text.matchAll(SLASH_COMMAND)) {
		if (Object.hasOwn(SKILLS, name)) into.add(name)
	}
}

/**
 * @returns the transcript's lines, or `null` when it cannot be read. `null`
 * means "cannot tell", which callers must not treat as "nothing happened": an
 * unreadable transcript would otherwise deny forever, and nothing the agent
 * does could clear it because the deny does not depend on the agent.
 */
function transcriptLines(transcriptPath) {
	if (!transcriptPath) return null
	try {
		return readFileSync(transcriptPath, 'utf8').split('\n')
	} catch {
		return null
	}
}

function parseRecord(line) {
	try {
		return JSON.parse(line)
	} catch {
		return null
	}
}

/**
 * Every content block in transcript order, from the lines that pass `keep`.
 * The cheap reject matters: transcripts reach megabytes, and the hooks that
 * call this run on every prompt.
 */
function* contentBlocks(lines, keep) {
	for (const line of lines) {
		if (!keep(line)) continue
		const content = parseRecord(line)?.message?.content
		if (typeof content === 'string') {
			yield { type: 'text', text: content }
			continue
		}
		if (!Array.isArray(content)) continue
		for (const block of content) {
			if (block && typeof block === 'object') yield block
		}
	}
}

/**
 * @returns a Set of skill names, or `null` when the transcript cannot be read.
 */
export function skillsInvoked(transcriptPath) {
	const lines = transcriptLines(transcriptPath)
	if (!lines) return null

	// A tool_use block is written before the tool runs; failure shows up later as
	// a separate tool_result with is_error. Pair them, or a Skill call the user
	// rejected would satisfy the gate. `is_error` has to survive the cheap
	// reject for the same reason.
	const attempted = new Map()
	const failed = new Set()
	const used = new Set()

	const blocks = contentBlocks(
		lines,
		(line) =>
			line.includes('"Skill"') ||
			line.includes('<command-name>') ||
			line.includes('is_error'),
	)
	for (const block of blocks) {
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

	for (const [id, skill] of attempted) if (!failed.has(id)) used.add(skill)
	return used
}

/**
 * Whether the plan written this session carries a "Work items" section.
 *
 * Reconstructs the plan file from its Write and Edit calls, since the file
 * itself lives outside the repository and its path is not in the hook payload.
 * A Write replaces the text and an Edit appends what it inserted, so a section
 * added after the first draft counts and one dropped by a rewrite does not.
 *
 * @returns `true` or `false` for the plan file written last, or `null` when no
 * plan file write was found: no plan yet, an unreadable transcript, or a plans
 * directory this cannot recognise. `null` is "cannot tell" and must not deny.
 */
export function planCarriesWorkItems(transcriptPath) {
	const lines = transcriptLines(transcriptPath)
	if (!lines) return null

	const written = new Map()
	const failed = new Set()
	let latest = null

	const blocks = contentBlocks(
		lines,
		(line) => line.includes('"file_path"') || line.includes('is_error'),
	)
	for (const block of blocks) {
		if (block.type === 'tool_result' && block.is_error) {
			failed.add(block.tool_use_id)
			continue
		}
		if (block.type !== 'tool_use') continue
		const path = block.input?.file_path
		if (typeof path !== 'string' || !PLAN_FILE.test(path)) continue
		if (block.name === 'Write' && typeof block.input.content === 'string') {
			written.set(path, [{ id: block.id, text: block.input.content }])
			latest = path
		} else if (block.name === 'Edit' && typeof block.input.new_string === 'string') {
			written.get(path)?.push({ id: block.id, text: block.input.new_string })
			latest = path
		}
	}

	if (!latest) return null
	const text = written
		.get(latest)
		.filter((piece) => !failed.has(piece.id))
		.map((piece) => piece.text)
		.join('\n')
	return WORK_ITEMS_HEADING.test(text)
}

/** Read one JSON payload from stdin. */
export async function readPayload() {
	let data = ''
	for await (const chunk of process.stdin) data += chunk
	return JSON.parse(data)
}
