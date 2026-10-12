/**
 * Whether the viewer draws its camera switcher.
 *
 * Three parties decide, and any of them can say no: the host page
 * (`showCameraControls`), the scene's author (`camera.showControls`, where
 * absent means yes), and the scene itself, which needs two views to switch
 * between. The views are scene cameras only (`resolveSceneViewCameras`): a
 * hotspot's close-up is reached through its marker.
 *
 * Pure, and in `.ts`, so the rule is covered by this package's runner; the
 * viewer only asks it.
 */
export function shouldShowCameraControls({
	sceneViewCount,
	authorAllows,
	hostAllows
}: {
	sceneViewCount: number
	authorAllows: boolean | undefined
	hostAllows: boolean
}): boolean {
	return hostAllows && authorAllows !== false && sceneViewCount >= 2
}
