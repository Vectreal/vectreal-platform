import { isPairedHotspotCamera, isSceneCamera } from './scene-camera'

import type { SceneSettings } from '@vctrl/core'

/**
 * The single owner of "what scene settings may an external embed see?".
 *
 * Filtering the `hotspots` array is not enough. A hotspot carries a
 * `linkedCameraId` pointing at an entry in `camera.cameras` with
 * `kind: 'hotspot'`, and that entry holds the viewpoint's full pose and name.
 * Dropping the hotspot while keeping its camera leaves the "hidden" viewpoint
 * readable in the manifest JSON *and* reachable at runtime: `@vctrl/embed`
 * exposes `activateCamera(cameraId)`, so any third-party page could fly an
 * anonymous visitor straight to it. `internalOnly` is a visibility contract
 * (see `SceneSettings.hotspots` in `@vctrl/core`), so it has to hold across
 * every field that can resurrect the hotspot, not just the array it lives in.
 *
 * Pure - no database import and no `.server` suffix - so the rule is testable
 * on its own rather than only through a route.
 */

/**
 * Removes everything an embed must not see from a scene's settings.
 *
 * - `internalOnly` hotspots, and any hotspot camera no surviving hotspot links
 *   to. A camera counts as a hotspot camera when it is tagged `kind: 'hotspot'`
 *   or carries a publisher-minted paired-camera id - see the comment on
 *   `isVisibleCamera`. Orphans go too: a hotspot camera whose hotspot was
 *   deleted is a viewpoint nothing on the published surface can reach.
 * - Interactions that would activate a removed camera, and the active-camera
 *   selection if it pointed at one.
 * - A `shadows.baked` pointer the asset gate would refuse. `bakeAssetId` is the
 *   id `selectEmbedServableAssets` authorized; anything else is a stale or
 *   tampered reference whose bytes the embed cannot fetch anyway, so shipping
 *   the id would leak an internal identifier for nothing.
 */
export function redactSettingsForEmbed(
	settings: SceneSettings,
	{ bakeAssetId }: { bakeAssetId: string | null }
): SceneSettings {
	const visibleHotspots = settings.hotspots?.filter(
		(hotspot) => !hotspot.internalOnly
	)

	const linkedCameraIds = (hotspots: typeof settings.hotspots) =>
		new Set(
			(hotspots ?? [])
				.map((hotspot) => hotspot.linkedCameraId)
				.filter((cameraId): cameraId is string => Boolean(cameraId))
		)

	const visibleHotspotLinks = linkedCameraIds(visibleHotspots)

	/*
	  Linkage deliberately is NOT what makes a camera a hotspot camera. A hotspot
	  may link any camera the author picks, including the scene's own default -
	  the picker offers every camera and the server validates only that the id
	  exists. Promoting a camera on linkage alone would let one internal hotspot
	  delete the scene's opening view from the embed. That camera is a scene
	  camera in its own right and its pose is public regardless; only the hotspot
	  has to disappear.
	*/
	const isVisibleCamera = (camera: { cameraId?: string; kind?: string }) => {
		const cameraId = camera.cameraId

		if (isPairedHotspotCamera(camera)) {
			return cameraId !== undefined && visibleHotspotLinks.has(cameraId)
		}

		return isSceneCamera(camera)
	}

	const cameras = settings.camera?.cameras
	const visibleCameras = cameras?.filter(isVisibleCamera)

	const removedCameraIds = new Set(
		(cameras ?? [])
			.filter((camera) => !isVisibleCamera(camera))
			.map((camera) => camera.cameraId)
	)

	const camera = settings.camera
		? {
				...settings.camera,
				cameras: visibleCameras,
				activeCameraId:
					settings.camera.activeCameraId !== undefined &&
					removedCameraIds.has(settings.camera.activeCameraId)
						? undefined
						: settings.camera.activeCameraId
			}
		: settings.camera

	// A rule whose only action is now gone would fire as a no-op, so the rule
	// goes with it rather than being left half-applied.
	const interactions = settings.interactions
		?.map((interaction) => ({
			...interaction,
			actions: interaction.actions.filter(
				(action) =>
					action.type !== 'activate_camera' ||
					!removedCameraIds.has(action.cameraId)
			)
		}))
		.filter((interaction) => interaction.actions.length > 0)

	const shadows = settings.shadows
		? {
				...settings.shadows,
				baked:
					settings.shadows.baked &&
					settings.shadows.baked.assetId === bakeAssetId
						? settings.shadows.baked
						: undefined
			}
		: settings.shadows

	return {
		...settings,
		hotspots: visibleHotspots,
		camera,
		interactions,
		shadows
	}
}
