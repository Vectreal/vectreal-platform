/**
 * The wire contract for every dashboard create/rename/move/delete.
 *
 * One request shape and one response shape replace what used to be four
 * transports with three response shapes, two of which hand-rolled an identical
 * `{ summary, results }` independently.
 *
 * Pure and client-safe: the hook serializes with `serializeDashboardMutationRequest`
 * and the endpoint parses with `parseDashboardMutationRequest`, so the two ends
 * cannot disagree about field names or encodings.
 */

import type { DashboardEntityType } from './dashboard-operations'

export type DashboardMutationVerb =
	'create-folder' | 'rename' | 'move' | 'delete'

export interface DashboardMutationTarget {
	type: DashboardEntityType
	id: string
}

/**
 * Where a move lands.
 *
 * An explicit tagged union rather than the `undefined` / `''` / uuid
 * three-state the publisher encodes in string emptiness, where "leave it alone"
 * and "move to root" are one typo apart.
 */
export type MoveTarget = { kind: 'root' } | { kind: 'folder'; folderId: string }

export type DashboardMutationRequest =
	| {
			verb: 'create-folder'
			projectId: string
			name: string
			description: string | null
			parentFolderId: string | null
	  }
	| { verb: 'rename'; target: DashboardMutationTarget; name: string }
	| {
			verb: 'move'
			targets: DashboardMutationTarget[]
			moveTarget: MoveTarget
	  }
	| {
			verb: 'delete'
			targets: DashboardMutationTarget[]
			confirmationText: string | null
	  }

export type DashboardMutationErrorCode =
	'not-found' | 'forbidden' | 'invalid-target' | 'conflict' | 'failed'

export interface DashboardMutationResult {
	type: DashboardEntityType
	id: string
	success: boolean
	error?: string
	code?: DashboardMutationErrorCode
}

export interface DashboardMutationSummary {
	total: number
	succeeded: number
	failed: number
}

/**
 * Note what `success` does *not* appear on: the envelope's `success` (added by
 * `ApiResponse.success`) means the request was understood, and per-item outcome
 * lives only in `results`/`summary`. The predecessor conflated the two, which
 * is why its client had to check two different fields both called `success`.
 */
export interface DashboardMutationResponse {
	verb: DashboardMutationVerb
	results: DashboardMutationResult[]
	summary: DashboardMutationSummary
	createdFolder?: { id: string; name: string }
}

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ENTITY_TYPES: readonly DashboardEntityType[] = [
	'project',
	'folder',
	'scene'
]

const MAX_TARGETS = 200

export type ParseResult<T> =
	{ ok: true; value: T } | { ok: false; error: string }

function readString(source: Record<string, unknown>, key: string): string {
	const raw = source[key]
	return typeof raw === 'string' ? raw.trim() : ''
}

function parseTargets(raw: unknown): ParseResult<DashboardMutationTarget[]> {
	if (typeof raw !== 'string' || !raw.trim()) {
		return { ok: false, error: 'targets is required' }
	}

	let decoded: unknown
	try {
		decoded = JSON.parse(raw)
	} catch {
		return { ok: false, error: 'targets must be valid JSON' }
	}

	if (!Array.isArray(decoded) || decoded.length === 0) {
		return { ok: false, error: 'targets must be a non-empty array' }
	}

	if (decoded.length > MAX_TARGETS) {
		return {
			ok: false,
			error: `targets may not exceed ${MAX_TARGETS} items`
		}
	}

	const targets: DashboardMutationTarget[] = []
	for (const entry of decoded) {
		if (typeof entry !== 'object' || entry === null) {
			return { ok: false, error: 'each target must be an object' }
		}

		const { type, id } = entry as { type?: unknown; id?: unknown }
		if (
			typeof type !== 'string' ||
			!ENTITY_TYPES.includes(type as DashboardEntityType)
		) {
			return { ok: false, error: `unknown target type: ${String(type)}` }
		}
		if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
			return { ok: false, error: 'each target id must be a UUID' }
		}

		targets.push({ type: type as DashboardEntityType, id })
	}

	return { ok: true, value: targets }
}

function parseMoveTarget(raw: unknown): ParseResult<MoveTarget> {
	if (typeof raw !== 'string' || !raw.trim()) {
		return { ok: false, error: 'moveTarget is required for a move' }
	}

	let decoded: unknown
	try {
		decoded = JSON.parse(raw)
	} catch {
		return { ok: false, error: 'moveTarget must be valid JSON' }
	}

	if (typeof decoded !== 'object' || decoded === null) {
		return { ok: false, error: 'moveTarget must be an object' }
	}

	const { kind, folderId } = decoded as { kind?: unknown; folderId?: unknown }

	if (kind === 'root') {
		return { ok: true, value: { kind: 'root' } }
	}

	if (kind === 'folder') {
		if (typeof folderId !== 'string' || !UUID_PATTERN.test(folderId)) {
			return { ok: false, error: 'moveTarget.folderId must be a UUID' }
		}
		return { ok: true, value: { kind: 'folder', folderId } }
	}

	return { ok: false, error: `unknown moveTarget kind: ${String(kind)}` }
}

export function parseDashboardMutationRequest(
	source: Record<string, unknown>
): ParseResult<DashboardMutationRequest> {
	const verb = readString(source, 'verb')

	if (verb === 'create-folder') {
		const projectId = readString(source, 'projectId')
		if (!UUID_PATTERN.test(projectId)) {
			return { ok: false, error: 'projectId must be a UUID' }
		}

		const name = readString(source, 'name')
		if (!name) {
			return { ok: false, error: 'name is required' }
		}

		const parentFolderIdRaw = readString(source, 'parentFolderId')
		if (parentFolderIdRaw && !UUID_PATTERN.test(parentFolderIdRaw)) {
			return { ok: false, error: 'parentFolderId must be a UUID' }
		}

		const description = readString(source, 'description')

		return {
			ok: true,
			value: {
				verb: 'create-folder',
				projectId,
				name,
				description: description || null,
				parentFolderId: parentFolderIdRaw || null
			}
		}
	}

	if (verb === 'rename') {
		const parsed = parseTargets(source.targets)
		if (!parsed.ok) {
			return parsed
		}

		// One name cannot meaningfully apply to many rows. The predecessor
		// allowed it and would have renamed an entire selection identically.
		if (parsed.value.length !== 1) {
			return { ok: false, error: 'rename accepts exactly one target' }
		}

		const name = readString(source, 'name')
		if (!name) {
			return { ok: false, error: 'name is required' }
		}

		return {
			ok: true,
			value: { verb: 'rename', target: parsed.value[0], name }
		}
	}

	if (verb === 'move') {
		const parsed = parseTargets(source.targets)
		if (!parsed.ok) {
			return parsed
		}

		if (parsed.value.some((target) => target.type === 'project')) {
			return { ok: false, error: 'projects cannot be moved' }
		}

		const moveTarget = parseMoveTarget(source.moveTarget)
		if (!moveTarget.ok) {
			return moveTarget
		}

		return {
			ok: true,
			value: {
				verb: 'move',
				targets: parsed.value,
				moveTarget: moveTarget.value
			}
		}
	}

	if (verb === 'delete') {
		const parsed = parseTargets(source.targets)
		if (!parsed.ok) {
			return parsed
		}

		// Read untrimmed: the server owns the trim so that a client sending
		// whitespace cannot be told it matched when it did not.
		const rawConfirmation = source.confirmationText
		const confirmationText =
			typeof rawConfirmation === 'string' ? rawConfirmation : null

		return {
			ok: true,
			value: { verb: 'delete', targets: parsed.value, confirmationText }
		}
	}

	return { ok: false, error: `unknown verb: ${verb || '(missing)'}` }
}

/**
 * Renders a request as flat form fields for `fetcher.submit`.
 *
 * The CSRF token is added by the caller, which is the only party that has it.
 */
export function serializeDashboardMutationRequest(
	request: DashboardMutationRequest
): Record<string, string> {
	switch (request.verb) {
		case 'create-folder': {
			const fields: Record<string, string> = {
				verb: request.verb,
				projectId: request.projectId,
				name: request.name
			}
			if (request.description) {
				fields.description = request.description
			}
			if (request.parentFolderId) {
				fields.parentFolderId = request.parentFolderId
			}
			return fields
		}
		case 'rename':
			return {
				verb: request.verb,
				targets: JSON.stringify([request.target]),
				name: request.name
			}
		case 'move':
			return {
				verb: request.verb,
				targets: JSON.stringify(request.targets),
				moveTarget: JSON.stringify(request.moveTarget)
			}
		case 'delete': {
			const fields: Record<string, string> = {
				verb: request.verb,
				targets: JSON.stringify(request.targets)
			}
			if (request.confirmationText !== null) {
				fields.confirmationText = request.confirmationText
			}
			return fields
		}
	}
}

export function summarize(
	results: readonly DashboardMutationResult[]
): DashboardMutationSummary {
	const succeeded = results.filter((result) => result.success).length
	return {
		total: results.length,
		succeeded,
		failed: results.length - succeeded
	}
}
