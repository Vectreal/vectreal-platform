import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	planCarriesWorkItems,
	skillsInvoked
} from '../../../.agents/hooks/skills-invoked.mjs'

/**
 * The plan-mode gate reads the session transcript, so its parser is the whole
 * hook. Each case writes a transcript in the shape Claude Code records: one
 * JSON record per line, tool calls as `tool_use` blocks on assistant turns and
 * their outcome as `tool_result` blocks on the next user turn.
 */

type Block = Record<string, unknown>

function record(role: 'assistant' | 'user', content: Block[] | string) {
	return JSON.stringify({ type: role, message: { role, content } })
}

let counter = 0
function toolUse(name: string, input: Record<string, unknown>) {
	const id = `toolu_${++counter}`
	return { block: { type: 'tool_use', id, name, input }, id }
}

function rejected(id: string) {
	return record('user', [
		{ type: 'tool_result', tool_use_id: id, is_error: true }
	])
}

function transcript(lines: string[]) {
	const dir = mkdtempSync(join(tmpdir(), 'agent-hooks-'))
	const path = join(dir, 'transcript.jsonl')
	writeFileSync(path, lines.join('\n') + '\n')
	return path
}

const PLAN = '/home/someone/.claude/plans/quiet-otter.md'
const HEADED_PLAN = '# Plan\n\nSteps.\n\n## Work items\n\nnone\n'

describe('planCarriesWorkItems', () => {
	it('cannot tell without a transcript', () => {
		expect(planCarriesWorkItems(undefined)).toBeNull()
		expect(planCarriesWorkItems('/nowhere/transcript.jsonl')).toBeNull()
	})

	it('cannot tell when nothing under a plans directory was written', () => {
		const write = toolUse('Write', {
			file_path: '/repo/docs/notes.md',
			content: '# Notes\n\nno work items heading here'
		})
		expect(
			planCarriesWorkItems(transcript([record('assistant', [write.block])]))
		).toBeNull()
	})

	it('refuses a plan written without the section', () => {
		const write = toolUse('Write', {
			file_path: PLAN,
			content: '# Plan\n\nSteps only.\n'
		})
		expect(
			planCarriesWorkItems(transcript([record('assistant', [write.block])]))
		).toBe(false)
	})

	it('accepts a plan written with the section', () => {
		const write = toolUse('Write', { file_path: PLAN, content: HEADED_PLAN })
		expect(
			planCarriesWorkItems(transcript([record('assistant', [write.block])]))
		).toBe(true)
	})

	it('accepts the section when a later Edit appends it', () => {
		const write = toolUse('Write', {
			file_path: PLAN,
			content: '# Plan\n\nSteps.\n'
		})
		const edit = toolUse('Edit', {
			file_path: PLAN,
			old_string: 'Steps.\n',
			new_string: 'Steps.\n\n### Work items\n\n| Row | Now | After |\n'
		})
		const path = transcript([
			record('assistant', [write.block]),
			record('assistant', [edit.block])
		])
		expect(planCarriesWorkItems(path)).toBe(true)
	})

	it('refuses when a rewrite drops the section', () => {
		const first = toolUse('Write', { file_path: PLAN, content: HEADED_PLAN })
		const rewrite = toolUse('Write', {
			file_path: PLAN,
			content: '# Plan v2\n\nSteps.\n'
		})
		const path = transcript([
			record('assistant', [first.block]),
			record('assistant', [rewrite.block])
		])
		expect(planCarriesWorkItems(path)).toBe(false)
	})

	it('ignores an Edit the user rejected', () => {
		const write = toolUse('Write', {
			file_path: PLAN,
			content: '# Plan\n\nSteps.\n'
		})
		const edit = toolUse('Edit', {
			file_path: PLAN,
			old_string: 'Steps.',
			new_string: '## Work items\nnone'
		})
		const path = transcript([
			record('assistant', [write.block]),
			record('assistant', [edit.block]),
			rejected(edit.id)
		])
		expect(planCarriesWorkItems(path)).toBe(false)
	})

	it('does not read the heading out of prose', () => {
		const write = toolUse('Write', {
			file_path: PLAN,
			content: '# Plan\n\nThe work items table is filled in later.\n'
		})
		expect(
			planCarriesWorkItems(transcript([record('assistant', [write.block])]))
		).toBe(false)
	})
})

describe('skillsInvoked', () => {
	it('counts a Skill call once its result is not an error', () => {
		const ok = toolUse('Skill', { skill: 'vectreal-iterative-delivery' })
		const denied = toolUse('Skill', { skill: 'vectreal-brand-ux-design' })
		const path = transcript([
			record('assistant', [ok.block]),
			record('assistant', [denied.block]),
			rejected(denied.id),
			record(
				'user',
				'<command-name>/vectreal-extension-architecture</command-name>'
			)
		])
		expect(skillsInvoked(path)).toEqual(
			new Set([
				'vectreal-iterative-delivery',
				'vectreal-extension-architecture'
			])
		)
	})
})
