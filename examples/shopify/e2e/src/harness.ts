export const HARNESS_PORT = 4330

/** The example scene's cameras, in the order its own camera switcher steps through them. */
export const SCENE_CAMERAS = ['default', 'detail', 'context']

/** The tour the harness page asks for: the hero view, back for context, then in close to hand over. */
export const HARNESS_STEPS = [
	{
		camera: 'default',
		heading: 'Siebzig Jahre in der Hand',
		text: 'An den Kanten ist der Lack durchgerieben, darunter glänzt das Messing.'
	},
	{
		camera: 'context',
		heading: 'Passt in jede Manteltasche',
		text: '138 Millimeter breit und 580 Gramm schwer, ohne Objektiv.'
	},
	{
		camera: 'detail',
		heading: 'Zwei Bilder, ein Punkt',
		text: 'Im Sucher liegen zwei Bilder übereinander. Wo sie sich decken, sitzt die Schärfe.'
	}
]

export const HARNESS_CAMERAS = HARNESS_STEPS.map((step) => step.camera)
