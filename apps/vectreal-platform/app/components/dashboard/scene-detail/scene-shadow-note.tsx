/** Every word the note says, so a copy change is one edit here. */
export const SCENE_SHADOW_NOTE_COPY =
	"This scene's shadow isn't stored yet. Publish it again from the Publisher so every device shows it."

/**
 * Under the viewer, in the muted type of the scene's metadata row: a fact
 * about the published scene and what fixes it, not an alert. Phones and heavy
 * scenes draw a contact shadow until a publish stores the bake.
 */
export function SceneShadowNote() {
	return (
		<p className="text-muted-foreground text-xs">{SCENE_SHADOW_NOTE_COPY}</p>
	)
}
