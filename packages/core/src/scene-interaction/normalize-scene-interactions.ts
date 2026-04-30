import type {
	NormalizeSceneInteractionsOptions,
	SceneInteractionAction,
	SceneInteractionDefinition,
	SceneInteractionTrigger
} from '../types/interaction-types'

type InteractionRecord = Record<string, unknown>
type SceneInteractionActionInput =
	| InteractionRecord
	| SceneInteractionDefinition['actions'][number]
type SceneInteractionTriggerInput =
	| InteractionRecord
	| SceneInteractionDefinition['trigger']

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertFiniteNumber(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${label} must be a finite number`)
	}

	return value
}

/**
 * Normalizes a validated trigger record into the canonical persisted trigger shape.
 *
 * The caller is responsible for boundary shape checks so this helper can stay
 * focused on semantic normalization and invariant validation.
 */
function normalizeTrigger(
	trigger: SceneInteractionTriggerInput,
	label: string
): SceneInteractionTrigger {
	switch (trigger.type) {
		case 'viewer_ready': {
			return {
				source: 'viewer',
				type: 'viewer_ready'
			}
		}

		case 'host_scroll_progress': {
			const start = assertFiniteNumber(trigger.start, `${label}.start`)
			const end = assertFiniteNumber(trigger.end, `${label}.end`)

			if (start > end) {
				throw new Error(
					`${label}.start must be less than or equal to ${label}.end`
				)
			}

			return {
				source: 'host',
				type: 'host_scroll_progress',
				start,
				end
			}
		}

		case 'host_message': {
			if (typeof trigger.message !== 'string' || !trigger.message.trim()) {
				throw new Error(`${label}.message must be a non-empty string`)
			}

			return {
				source: 'host',
				type: 'host_message',
				message: trigger.message.trim()
			}
		}

		default:
			throw new Error(
				`${label}.type must be one of viewer_ready, host_scroll_progress, host_message`
			)
	}
}

/**
 * Normalizes a validated action record into the canonical persisted action shape.
 *
 * Camera references are resolved against the normalized camera payload so
 * persisted interactions cannot point at cameras that do not exist.
 */
function normalizeAction(
	action: SceneInteractionActionInput,
	label: string,
	availableCameraIds: ReadonlySet<string>
): SceneInteractionAction {
	switch (action.type) {
		case 'activate_camera': {
			if (typeof action.cameraId !== 'string' || !action.cameraId.trim()) {
				throw new Error(`${label}.cameraId must be a non-empty string`)
			}

			const cameraId = action.cameraId.trim()
			if (availableCameraIds.size > 0 && !availableCameraIds.has(cameraId)) {
				throw new Error(
					`${label}.cameraId references an unknown camera: ${cameraId}`
				)
			}

			return {
				type: 'activate_camera',
				cameraId
			}
		}

		case 'set_controls_enabled': {
			if (typeof action.enabled !== 'boolean') {
				throw new Error(`${label}.enabled must be a boolean`)
			}

			return {
				type: 'set_controls_enabled',
				enabled: action.enabled
			}
		}

		case 'emit_custom_event': {
			if (typeof action.eventName !== 'string' || !action.eventName.trim()) {
				throw new Error(`${label}.eventName must be a non-empty string`)
			}

			if (typeof action.payload !== 'undefined' && !isRecord(action.payload)) {
				throw new Error(`${label}.payload must be an object when provided`)
			}

			return {
				type: 'emit_custom_event',
				eventName: action.eventName.trim(),
				payload: action.payload
			}
		}

		default:
			throw new Error(
				`${label}.type must be one of activate_camera, set_controls_enabled, emit_custom_event`
			)
	}
}

/**
 * Returns a canonical interaction list suitable for persistence and hydration.
 *
 * This is intentionally strict because interaction definitions can arrive from
 * untyped JSON payloads even when the call site is statically typed.
 */
export function normalizeSceneInteractions(
	interactions?: SceneInteractionDefinition[],
	options: NormalizeSceneInteractionsOptions = {}
): SceneInteractionDefinition[] | undefined {
	if (typeof interactions === 'undefined') {
		return undefined
	}

	if (!Array.isArray(interactions)) {
		throw new Error('interactions must be an array')
	}

	const cameraIds = new Set(
		options.camera?.cameras
			?.map((entry) => entry.cameraId?.trim())
			.filter((cameraId): cameraId is string => Boolean(cameraId)) ?? []
	)
	const seenIds = new Set<string>()

	return interactions.map((interaction, index) => {
		if (!isRecord(interaction)) {
			throw new Error(`interactions[${index}] must be an object`)
		}

		const id =
			typeof interaction.id === 'string' && interaction.id.trim()
				? interaction.id.trim()
				: `interaction-${index + 1}`

		if (seenIds.has(id)) {
			throw new Error(`Duplicate interaction id found: ${id}`)
		}
		seenIds.add(id)

		const order =
			typeof interaction.order === 'number' &&
			Number.isFinite(interaction.order)
				? interaction.order
				: index + 1
		const trigger = interaction.trigger

		if (!isRecord(trigger)) {
			throw new Error(`interactions[${index}].trigger must be an object`)
		}

		if (
			!Array.isArray(interaction.actions) ||
			interaction.actions.length === 0
		) {
			throw new Error(
				`interactions[${index}].actions must be a non-empty array`
			)
		}

		const actions = interaction.actions

		return {
			id,
			order,
			enabled: interaction.enabled !== false,
			trigger: normalizeTrigger(trigger, `interactions[${index}].trigger`),
			actions: actions.map((action, actionIndex) => {
				if (!isRecord(action)) {
					throw new Error(
						`interactions[${index}].actions[${actionIndex}] must be an object`
					)
				}

				return normalizeAction(
					action,
					`interactions[${index}].actions[${actionIndex}]`,
					cameraIds
				)
			})
		}
	})
}
