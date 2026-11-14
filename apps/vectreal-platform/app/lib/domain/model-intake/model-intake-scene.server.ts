import {
	intakeSceneFor,
	type ModelIntakeShowcase,
	parseIntakeScenes
} from './model-intake-shared'
import {
	publishedEmbedSceneDeps,
	resolvePublishedEmbedScene,
	type PublishedEmbedScene
} from '../embed/published-embed-scene.server'

// A product turning in a hero, not a viewer to work: it turns whatever the
// scene's own setting says, and draws no switcher, markers or hint.
const HERO_EMBED_OPTIONS = [
	['cameraControls', '0'],
	['hotspots', '0'],
	['hint', '0']
] as const

/** What an intake page's hero needs to show the product turning. */
export type IntakeScene = PublishedEmbedScene

export const intakeSceneDeps = {
	scenes: () => parseIntakeScenes(process.env.MODEL_INTAKE_SCENES),
	...publishedEmbedSceneDeps
}

export type IntakeSceneDeps = typeof intakeSceneDeps

/**
 * The published scene an intake page turns at the top: the one for the
 * letter's showcase, else the default. Null when none is configured or the
 * scene is not published, and the page then leads with its text: a hero must
 * never fail the page.
 */
export async function resolveIntakeScene(
	request: Request,
	showcase: ModelIntakeShowcase | null,
	deps: IntakeSceneDeps = intakeSceneDeps
): Promise<IntakeScene | null> {
	const parsed = deps.scenes()
	if (!parsed.ok) {
		deps.reportServerError(new Error(`MODEL_INTAKE_SCENES: ${parsed.error}`), {
			request
		})
		return null
	}
	const ref = intakeSceneFor(parsed.scenes, showcase)
	if (!ref) return null
	return resolvePublishedEmbedScene(request, ref, HERO_EMBED_OPTIONS, deps)
}
