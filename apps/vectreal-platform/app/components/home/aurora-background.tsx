// app/components/landing/aurora-background.tsx
import { cn } from '@shared/utils'

interface AuroraBackgroundProps {
	className?: string
	/** Intensity 0–1 of the orange bloom. Defaults to a restrained 1. */
	intensity?: number
}

/**
 * Ambient animated backdrop: two drifting orange blooms over a subtle grid.
 * Pure CSS animation (GPU-composited), pauses under prefers-reduced-motion.
 */
export function AuroraBackground({
	className,
	intensity = 1
}: AuroraBackgroundProps) {
	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-0 overflow-hidden',
				className
			)}
			aria-hidden="true"
		>
			{/* Grid texture, masked to fade at edges */}
			<div
				className="absolute inset-0 opacity-[0.06]"
				style={{
					backgroundImage:
						'linear-gradient(var(--surface-border) 1px, transparent 1px), linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)',
					backgroundSize: '64px 64px',
					maskImage:
						'radial-gradient(ellipse 90% 70% at 50% 40%, black, transparent 80%)',
					WebkitMaskImage:
						'radial-gradient(ellipse 90% 70% at 50% 40%, black, transparent 80%)'
				}}
			/>

			{/* Aurora bloom 1 */}
			<div
				className="animate-aurora absolute -top-1/4 left-[10%] h-[55vh] w-[55vh] rounded-full blur-[100px]"
				style={{
					background:
						'radial-gradient(circle, oklch(0.62 0.2 40 / ' +
						0.22 * intensity +
						') 0%, transparent 70%)'
				}}
			/>

			{/* Aurora bloom 2 */}
			<div
				className="animate-aurora-2 absolute right-[8%] -bottom-1/4 h-[50vh] w-[50vh] rounded-full blur-[110px]"
				style={{
					background:
						'radial-gradient(circle, oklch(0.55 0.16 50 / ' +
						0.16 * intensity +
						') 0%, transparent 70%)'
				}}
			/>
		</div>
	)
}
