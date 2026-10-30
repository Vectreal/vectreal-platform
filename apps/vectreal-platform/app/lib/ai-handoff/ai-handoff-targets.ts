import { markdownTwinPath } from '../markdown/markdown-twin'
import { SITE_URL } from '../seo'

/**
 * Where a reader can take a page or a prompt: a chat, or a coding agent that
 * works in their own project.
 *
 * Every link carries a short prompt that points at a URL, never a page body.
 * The targets cap their links at different, partly undocumented lengths (Cursor
 * 10,000 characters, Claude about 14,000), and a prompt naming the page's
 * markdown twin stays a few hundred characters whatever the page weighs, so the
 * model fetches the clean version itself.
 */
export type AiHandoffKind = 'chat' | 'agent'

export interface AiHandoffTarget {
	id: 'chatgpt' | 'claude' | 'cursor' | 'claude-code'
	label: string
	kind: AiHandoffKind
	buildUrl: (prompt: string) => string
}

const twinUrl = (htmlPath: string) => `${SITE_URL}${markdownTwinPath(htmlPath)}`

const withParam = (base: string, name: string, prompt: string) =>
	`${base}?${name}=${encodeURIComponent(prompt)}`

export const AI_HANDOFF_TARGETS: readonly AiHandoffTarget[] = [
	{
		id: 'chatgpt',
		label: 'ChatGPT',
		kind: 'chat',
		// Undocumented by OpenAI, and it may send the prompt without a click.
		buildUrl: (prompt) => withParam('https://chatgpt.com/', 'q', prompt)
	},
	{
		id: 'claude',
		label: 'Claude',
		kind: 'chat',
		buildUrl: (prompt) => withParam('https://claude.ai/new', 'q', prompt)
	},
	{
		id: 'cursor',
		label: 'Cursor',
		kind: 'agent',
		// Documented. The web page hands off to the app and never runs the prompt.
		buildUrl: (prompt) =>
			withParam('https://cursor.com/link/prompt', 'text', prompt)
	},
	{
		id: 'claude-code',
		label: 'Claude Code',
		kind: 'agent',
		// Documented for the desktop app; there is no web page to fall back to.
		buildUrl: (prompt) => withParam('claude://code/new', 'q', prompt)
	}
]

/**
 * The prompt that hands a page over. Always on `SITE_URL`, never the current
 * origin, so a link built on localhost or staging still names a page the
 * model can fetch.
 */
export function buildPagePrompt(
	kind: AiHandoffKind,
	htmlPath: string,
	title: string
): string {
	const url = twinUrl(htmlPath)
	return kind === 'chat'
		? `Read ${url} so I can ask you questions about "${title}" on Vectreal.`
		: `Read ${url} ("${title}" on Vectreal) and help me apply it in this project.`
}

/**
 * The prompt that hands over an article's next step, `task`, rather than the
 * article itself. A coding agent does it in the reader's project; a chat walks
 * them through it, for a reader who wants to understand it before doing it.
 */
export function buildTaskPrompt(
	kind: AiHandoffKind,
	htmlPath: string,
	title: string,
	task: string
): string {
	const read = `Read ${twinUrl(htmlPath)} ("${title}" on Vectreal)`
	return kind === 'chat'
		? `${read}, then walk me through this: ${task}`
		: `${read}, then do this in this project: ${task}`
}
