import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The type and radius scales. Both have drifted before - the radius scale went
 * self-referential and silently collapsed to Tailwind's defaults after
 * hydration, and two type tokens shipped with no utility class at all.
 */
const meta = {
	title: 'Foundations/Tokens'
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const TYPE = [
	['text-display', 'Display'],
	['text-headline', 'Headline'],
	['text-h2', 'Heading 2'],
	['text-h3', 'Heading 3'],
	['text-body-lg', 'Body large'],
	['text-label-xs', 'Label xs'],
	['text-eyebrow', 'Eyebrow']
] as const

export const Typography: Story = {
	render: () => (
		<div className="space-y-4">
			{TYPE.map(([cls, label]) => (
				<div key={cls}>
					<p className="text-muted-foreground text-label-xs mb-1 font-mono">
						.{cls}
					</p>
					<p className={cls}>{label}</p>
				</div>
			))}
		</div>
	)
}

const RADII = [
	'rounded-sm',
	'rounded-md',
	'rounded-lg',
	'rounded-xl',
	'rounded-2xl'
] as const

/**
 * Every step is derived from the single `--radius` knob. If any of them ever
 * stops tracking it, the progression here stops being even.
 */
export const Radius: Story = {
	render: () => (
		<div className="flex flex-wrap gap-3">
			{RADII.map((cls) => (
				<div key={cls} className="space-y-2">
					<div className={`ds-overlay size-24 ${cls}`} />
					<p className="text-muted-foreground text-label-xs font-mono">.{cls}</p>
				</div>
			))}
		</div>
	)
}

export const Brand: Story = {
	render: () => (
		<div className="flex flex-wrap gap-3">
			<div className="space-y-2">
				<div className="bg-orange size-24 rounded-xl" />
				<p className="text-muted-foreground text-label-xs font-mono">
					bg-orange
				</p>
			</div>
			{/*
			  --accent is the neutral hover token, not the brand. It reads as a
			  near-invisible grey here on purpose; if it ever renders orange again,
			  something has re-pointed it at the brand colour.
			*/}
			<div className="space-y-2">
				<div className="bg-accent size-24 rounded-xl" />
				<p className="text-muted-foreground text-label-xs font-mono">
					bg-accent
				</p>
			</div>
			<div className="space-y-2">
				<div
					className="size-24 rounded-xl"
					style={{ background: 'rgb(var(--orange-rgb) / 0.14)' }}
				/>
				<p className="text-muted-foreground text-label-xs font-mono">
					--orange-rgb / .14
				</p>
			</div>
		</div>
	)
}
