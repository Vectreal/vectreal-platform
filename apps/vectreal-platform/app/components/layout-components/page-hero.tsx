import { cn } from '@shared/utils'
import { type ReactNode } from 'react'

interface PageHeroProps {
	eyebrow?: string
	heading: ReactNode
	description?: ReactNode
	actions?: ReactNode
	className?: string
}

/**
 * Shared above-the-fold hero section used by all main nav pages
 * (docs, contact, newsroom, pricing). Encodes the brand-aligned
 * design spec in one place — gradient background, typography scale,
 * eyebrow label, description, and an actions slot.
 */
const PageHero = ({
	eyebrow,
	heading,
	description,
	actions,
	className
}: PageHeroProps) => {
	return (
		<div
			className={cn(
				'from-accent/10 relative isolate overflow-hidden bg-linear-to-b via-transparent to-transparent',
				className
			)}
		>
			{/* Decorative radial accent gradients — purely visual, pointer-events off */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_25%,hsl(var(--accent)/0.14),transparent_42%),radial-gradient(circle_at_82%_12%,hsl(var(--accent)/0.09),transparent_45%)]"
			/>

			<div className="mx-auto max-w-7xl px-6 pt-24 pb-16">
				<div className="space-y-4">
					{eyebrow && (
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
							{eyebrow}
						</p>
					)}

					<h1 className="max-w-4xl text-4xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
						{heading}
					</h1>

					{description && (
						<p className="text-muted-foreground max-w-3xl text-base leading-relaxed md:text-lg">
							{description}
						</p>
					)}

					{actions && (
						<div className="flex flex-wrap items-center gap-2 pt-2">
							{actions}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default PageHero
