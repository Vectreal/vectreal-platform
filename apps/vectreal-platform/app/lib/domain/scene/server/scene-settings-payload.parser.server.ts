import { ApiResponse } from '@shared/utils'
import {
	normalizeSceneAnimation,
	normalizeSceneInteractions
} from '@vctrl/core'

import { parseCameraSettings } from './scene-settings-camera.parser.server'
import { normalizeHotspots } from './scene-settings-hotspots.parser.server'
import { normalizePresentationSettings } from '../scene-presentation'

import type { SceneSettings } from '@vctrl/core'

/**
 * Parses settings data from request.
 */
export function parseSettingsData(
	requestData: Record<string, unknown>
): SceneSettings | Response {
	let settings: Record<string, unknown> | undefined

	// Try 'settings' field first (current implementation)
	if (requestData.settings) {
		if (typeof requestData.settings === 'string') {
			try {
				settings = JSON.parse(requestData.settings)
			} catch (error) {
				console.warn('Failed to parse settings:', error)
				return ApiResponse.badRequest('Invalid settings data format')
			}
		} else if (
			typeof requestData.settings === 'object' &&
			requestData.settings !== null
		) {
			settings = requestData.settings as Record<string, unknown>
		}
	}

	// Fallback to 'settingsData' field
	if (!settings && requestData.settingsData) {
		if (typeof requestData.settingsData === 'string') {
			try {
				settings = JSON.parse(requestData.settingsData)
			} catch (error) {
				console.warn('Failed to parse settingsData:', error)
				return ApiResponse.badRequest('Invalid settings data format')
			}
		} else if (
			typeof requestData.settingsData === 'object' &&
			requestData.settingsData !== null
		) {
			settings = requestData.settingsData as Record<string, unknown>
		}
	}

	// Validate that we have a valid settings object
	if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
		console.warn('Invalid settings format:', settings)
		return ApiResponse.badRequest('Settings must be a valid object')
	}

	const sceneSettings = settings as SceneSettings
	const normalizedCamera = parseCameraSettings(sceneSettings.camera)
	if (normalizedCamera instanceof Response) {
		return normalizedCamera
	}

	let normalizedInteractions: SceneSettings['interactions']
	try {
		normalizedInteractions = normalizeSceneInteractions(
			sceneSettings.interactions,
			{ camera: normalizedCamera }
		)
	} catch (error) {
		return ApiResponse.badRequest(
			error instanceof Error
				? error.message
				: 'Invalid scene interactions configuration'
		)
	}

	let normalizedAnimation: SceneSettings['animation']
	try {
		normalizedAnimation = normalizeSceneAnimation(sceneSettings.animation)
	} catch (error) {
		return ApiResponse.badRequest(
			error instanceof Error
				? error.message
				: 'Invalid scene animation configuration'
		)
	}

	const normalizedHotspots = normalizeHotspots(
		sceneSettings.hotspots,
		normalizedCamera?.cameras ?? []
	)
	if (normalizedHotspots instanceof Response) {
		return normalizedHotspots
	}

	return {
		...sceneSettings,
		animation: normalizedAnimation,
		camera: normalizedCamera,
		interactions: normalizedInteractions,
		hotspots: normalizedHotspots,
		presentation: normalizePresentationSettings(sceneSettings.presentation)
	}
}
