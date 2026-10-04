import { Toggle } from '@shared/components/ui/toggle'

interface LoadingThumbnailToggleProps {
	checked: boolean
	onCheckedChange: (checked: boolean) => void
	/** When the change reaches visitors: with the next save, or at once. */
	appliesOn: 'save' | 'change'
	disabled?: boolean
}

const APPLIES = {
	save: 'Applies as soon as you save.',
	change: 'Applies right away.'
} as const

/**
 * The author's choice of `presentation.showLoadingThumbnail`, the same control
 * in the publisher and on the dashboard.
 */
export function LoadingThumbnailToggle({
	checked,
	onCheckedChange,
	appliesOn,
	disabled
}: LoadingThumbnailToggleProps) {
	return (
		<Toggle
			checked={checked}
			onCheckedChange={onCheckedChange}
			disabled={disabled}
			label="Show thumbnail while loading"
			description={`Embeds show this scene's saved thumbnail behind the loader until the 3D scene is ready. ${APPLIES[appliesOn]}`}
		/>
	)
}
