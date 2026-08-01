import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from '@vctrl/viewer'

export interface SceneEmbedInfoPopoverProps {
	title?: string
	description?: string
}

/**
 * The scene's name and description, behind the viewer's own info affordance.
 * Rendered into `<SceneEmbedViewer popover>` rather than by it, so a surface
 * that wants no popover simply omits the prop.
 */
const SceneEmbedInfoPopover = ({
	title,
	description
}: SceneEmbedInfoPopoverProps) => (
	<InfoPopover className="z-100">
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
			<InfoPopoverVectrealFooter />
		</InfoPopoverContent>
	</InfoPopover>
)

export default SceneEmbedInfoPopover
