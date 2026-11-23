import { IMPORTABLE_FORMAT_LABELS } from '@vctrl/core/model-formats'
import {
	refusalFileNames,
	unreadableSelectionOf
} from '@vctrl/hooks/use-load-model'

import { MODEL_INTAKE_PATH } from '../model-intake/model-intake-shared'

import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

/**
 * Where a refusal sends someone who brought photos: the offer that turns three
 * photos into a model. Read by the publisher and the converter, so the two
 * surfaces cannot point the same visitor in different directions.
 */
export const PHOTOS_REFUSAL_LINK = {
	to: MODEL_INTAKE_PATH,
	label: 'Get a free 3D model from your photos'
} as const

/** The link a refusal carries, or `null` when it carries none. */
export function uploadLoadErrorLink(
	error: StructuredLoadError | null
): typeof PHOTOS_REFUSAL_LINK | null {
	return unreadableSelectionOf(error)?.kind === 'photos'
		? PHOTOS_REFUSAL_LINK
		: null
}

/**
 * File names as a sentence lists them: "a.png", "a.png and b.png", "a.png,
 * b.png and c.png", and past `max` the rest as a count, so a glTF missing forty
 * textures stays a sentence rather than becoming a page.
 */
export function listFileNames(names: readonly string[], max = 3): string {
	const shown = names.length > max ? names.slice(0, max) : [...names]
	const rest = names.length - shown.length
	if (rest > 0) shown.push(`${rest} more`)
	if (shown.length < 2) return shown.join('')
	return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}

/**
 * What the publisher says when a model the user just picked will not load.
 *
 * Keyed on the error code rather than the loader's raw message so the copy stays
 * actionable: every one of these tells the user what to do next.
 */
export function getUploadLoadErrorMessage(
	error: StructuredLoadError | null
): string {
	switch (error?.code) {
		case 'missing_assets': {
			const { model, missing } = refusalFileNames(error)
			/*
			  Only a model dropped from disk has a folder to bring: a model
			  opened from a URL carries no file name, and keeps the general
			  sentence.
			*/
			if (model && missing.length > 0) {
				return `${model} needs ${listFileNames(missing)}, which did not come with it. Drop the whole folder it lives in, or export it as one GLB.`
			}
			return 'Model references missing assets. Upload the full model folder (including textures/buffers) and retry.'
		}
		case 'unsupported_format': {
			const selection = unreadableSelectionOf(error)
			if (selection?.kind === 'photos') {
				return 'Photos are not a 3D model, so there is nothing here to open.'
			}
			if (selection?.kind === 'blender') {
				return `${selection.fileName} is a Blender file, which only Blender reads. In Blender, choose File > Export > glTF 2.0, save it as GLB and drop that file here.`
			}
			if (selection?.kind === 'archive') {
				return `${selection.fileName} is a zip archive, which the publisher does not open. Unzip it and drop the folder inside.`
			}
			/*
			  Read from the owner rather than written out. It named three of the
			  six formats that would have worked, so the message sent people away
			  with a file the loader reads - and `docs/guides/upload.mdx` quoted
			  it verbatim, which is how one stale sentence became two.
			*/
			return `Unsupported model format. Upload one of: ${IMPORTABLE_FORMAT_LABELS.join(', ')}.`
		}
		case 'multiple_models': {
			/*
			  Named in the owner's declaration order, which is the order the
			  loader reports them in: a glTF leads, since a folder holding one
			  beside an FBX is most often the glTF export and its source.
			*/
			const { models } = refusalFileNames(error)
			if (models.length > 1) {
				return `This selection holds ${listFileNames(models)}, and the publisher opens one model at a time. Drop ${models[0]} on its own, with its files.`
			}
			return 'Multiple models found. Upload one model at a time.'
		}
		case 'quota_exceeded':
			return 'Upload limit reached for this plan. Upgrade to continue uploading models.'
		case 'not_found':
			return 'Scene could not be found. Refresh and try again.'
		default:
			return error?.message || 'Failed to load model'
	}
}

function isStructuredLoadError(error: unknown): error is StructuredLoadError {
	if (!error || typeof error !== 'object') {
		return false
	}

	const candidate = error as Partial<StructuredLoadError>
	return (
		typeof candidate.code === 'string' &&
		typeof candidate.message === 'string' &&
		typeof candidate.source === 'string'
	)
}

/** The heading over `getDashboardSceneLoadErrorMessage` on the scene page. */
export const DASHBOARD_SCENE_LOAD_ERROR_HEADING = 'This scene did not load'

const DASHBOARD_SCENE_LOAD_FALLBACK = 'Failed to load scene.'

/**
 * What the dashboard's scene page says when the scene will not load. Only
 * mapped copy: a loader's raw message is written for a trace, not a reader,
 * and an unknown code gets the generic sentence rather than its text.
 */
export function getDashboardSceneLoadErrorMessage(error: unknown): string {
	if (isStructuredLoadError(error)) {
		switch (error.code) {
			case 'not_found':
				return 'Scene not found. It may have been removed or your access may have changed.'
			case 'quota_exceeded':
				return 'This scene cannot be loaded because your current plan limit was reached.'
			case 'server_load_failed':
				return 'Scene loading failed due to a server or network issue. Retry in a moment.'
			case 'missing_assets':
				return 'Scene assets are incomplete. Re-open this scene in Publisher and re-save to repair asset links.'
		}
	}

	return DASHBOARD_SCENE_LOAD_FALLBACK
}
