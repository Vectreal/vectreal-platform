import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger
} from '@vctrl/viewer'

export interface SceneEmbedInfoPopoverProps {
	title?: string
	description?: string
}

/**
 * The scene's name and description, behind the viewer's own info affordance.
 * Rendered into `<SceneEmbedViewer popover>` rather than by it, so a surface
 * that wants no popover simply omits the prop.
 *
 * Carries no Vectreal mark. It used to end in one, which meant an author
 * switching this popover off also switched the branding off - so the mark is
 * now its own element, `VectrealEmbedBadge`, gated on the plan rather than on
 * what the author wanted to say about their scene.
 */
const SceneEmbedInfoPopover = ({
	title,
	description
}: SceneEmbedInfoPopoverProps) => (
	<InfoPopover>
		<InfoPopoverTrigger />
		<InfoPopoverContent>
			<InfoPopoverCloseButton />
			<InfoPopoverText>
				{title ? <p className="mb-3 font-medium">{title}</p> : null}
				{description ? (
					<p>{description}</p>
				) : (
					<p className="opacity-50">No description provided for this scene.</p>
				)}
			</InfoPopoverText>
		</InfoPopoverContent>
	</InfoPopover>
)

export default SceneEmbedInfoPopover
