import { Skeleton } from './skeleton'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * `Skeleton` tints with a value over its surface rather than `--muted`, which
 * is a near-white in light mode and all but vanished on a raised panel. It also
 * pulses: it previously ran a one-shot entrance and then sat static, which reads
 * as empty content rather than pending content.
 *
 * Chromatic freezes CSS animations at their first frame, so the pulse itself is
 * not diffed - but the resting colour on each surface is, which is the part that
 * regressed before.
 */
const meta = {
	title: 'Components/Skeleton',
	component: Skeleton,
	tags: ['autodocs']
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const OnEachSurface: Story = {
	render: () => (
		<div className="space-y-3">
			{['bg-background', 'ds-sunken', 'ds-raised', 'ds-overlay'].map(
				(surface) => (
					<div key={surface} className={`${surface} space-y-2 rounded-2xl p-4`}>
						<p className="text-eyebrow text-muted-foreground">{surface}</p>
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-4 w-32" />
					</div>
				)
			)}
		</div>
	)
}

export const Staggered: Story = {
	render: () => (
		<div className="ds-raised space-y-2 rounded-2xl p-4">
			{Array.from({ length: 5 }, (_, index) => (
				<Skeleton
					key={index}
					className="h-4"
					style={{
						width: `${70 - index * 8}%`,
						animationDelay: `${index * 90}ms`
					}}
				/>
			))}
		</div>
	)
}
