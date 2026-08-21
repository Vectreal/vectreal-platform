import { isSceneCamera } from './scene-camera'

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
 * Id prefix the publisher mints every hotspot-paired camera with.
 *
 * Exported so the panel that mints them and the policy that recognizes them
 * share one literal. Only the prefix is shared; the full minted shape is
 * asserted separately by {@link PAIRED_HOTSPOT_CAMERA_ID}, which is a fallback
 * for scenes saved before paired cameras carried `kind: 'hotspot'` - current
 * ones are classified by the tag and never reach it.
 */
export const PAIRED_HOTSPOT_CAMERA_ID_PREFIX = 'hotspot-camera-'

/**
 * The full minted shape: `hotspot-camera-<epoch-millis>-<base36 suffix>`.
 *
 * Matching the whole shape rather than the bare prefix, because ordinary camera
 * ids are slugified from the user's own camera name (`deriveUniqueSlug` in
 * `@shared/utils`). Someone renaming a camera to "Hotspot Camera 1" gets the id
 * `hotspot-camera-1`, and a prefix test would classify that perfectly ordinary
 * camera as a hotspot pair and drop it from the embed - visible nowhere else,
 * since the publisher, the dashboard and `/preview` all classify by `kind`.
 * A slugified name cannot produce a 13-digit epoch and a base36 suffix.
 */
const PAIRED_HOTSPOT_CAMERA_ID = /^hotspot-camera-\d{10,}-[a-z0-9]{1,8}$/

/** Whether a camera id was minted by the publisher as a hotspot pair. */
export function isPairedHotspotCameraId(cameraId: string): boolean {
	return PAIRED_HOTSPOT_CAMERA_ID.test(cameraId)
}

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
	  What makes a camera a hotspot camera: its tag, or the id the publisher
	  minted it with.

	  The publisher only started writing `kind: 'hotspot'` on paired cameras
	  recently, so every scene saved before that has an untagged one - and
	  `isSceneCamera` reads a missing `kind` as "scene". Trusting the tag alone
	  would keep exactly the cameras this redaction exists to remove, for exactly
	  the scenes already in the database.

	  The minted id is the reliable second signal - the whole shape, not the bare
	  prefix, for the reason on `PAIRED_HOTSPOT_CAMERA_ID`.

	  Linkage deliberately is NOT the signal. A hotspot may link any camera the
	  author picks, including the scene's own default - the picker offers every
	  camera and the server validates only that the id exists. Promoting a camera
	  on linkage alone would let one internal hotspot delete the scene's default
	  view from the embed. That camera is a scene camera in its own right and its
	  pose is public regardless; only the hotspot has to disappear.
	*/
	const isVisibleCamera = (camera: { cameraId?: string; kind?: string }) => {
		const cameraId = camera.cameraId
		const isHotspotCamera =
			camera.kind === 'hotspot' ||
			(camera.kind === undefined &&
				cameraId !== undefined &&
				isPairedHotspotCameraId(cameraId))

		if (isHotspotCamera) {
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
					settings.shadows.baked && settings.shadows.baked.assetId === bakeAssetId
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
