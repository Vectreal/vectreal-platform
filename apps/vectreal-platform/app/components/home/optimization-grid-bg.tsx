import { cn } from '@shared/utils'

interface OptimizationGridBgProps {
	className?: string
}

const WIDTH = 1440
const HEIGHT = 260
const MARGIN = 18

// Fine baseline grid, constant density, just texture.
const GRID_COLS = 24
const GRID_ROWS = 6

// Funnel lines, many on the left merge into few on the right, echoing
// mesh decimation: dense geometry in, a simplified pattern out.
const DENSE_COUNT = 32
const SPARSE_COUNT = 6
const GROUP_SIZE = DENSE_COUNT / SPARSE_COUNT
const MERGE_START = WIDTH * 0.3
const MERGE_END = WIDTH * 0.66

const laneY = (i: number) =>
	MARGIN + (i * (HEIGHT - MARGIN * 2)) / (DENSE_COUNT - 1)

const targetY = (group: number) => {
	const start = group * GROUP_SIZE
	let sum = 0
	for (let i = start; i < start + GROUP_SIZE; i++) sum += laneY(i)
	return sum / GROUP_SIZE
}

const FUNNEL_LINES = Array.from({ length: DENSE_COUNT }, (_, i) => {
	const y0 = laneY(i)
	const y1 = targetY(Math.floor(i / GROUP_SIZE))
	const midX = (MERGE_START + MERGE_END) / 2
	return {
		key: i,
		d: `M 0 ${y0} L ${MERGE_START} ${y0} C ${midX} ${y0} ${midX} ${y1} ${MERGE_END} ${y1} L ${WIDTH} ${y1}`
	}
})

/**
 * Subtle full-width backdrop for the optimization section: a fine grid
 * texture overlaid with lines that funnel from many down to few, visually
 * echoing the "heavy asset in, simplified asset out" story.
 */
export function OptimizationGridBg({ className }: OptimizationGridBgProps) {
	return (
		<div
			className={cn(
				'pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-screen -translate-x-1/2 -translate-y-1/2 overflow-hidden',
				className
			)}
			style={{
				maskImage:
					'radial-gradient(ellipse 60% 80% at 50% 50%, black, transparent 90%)',
				WebkitMaskImage:
					'radial-gradient(ellipse 60% 80% at 50% 50%, black, transparent 90%)'
			}}
			aria-hidden="true"
		>
			<svg
				className="h-full w-full"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				fill="none"
			>
				{/* Baseline grid texture */}
				<g stroke="var(--surface-border)" strokeWidth={1} opacity={0.4}>
					{Array.from({ length: GRID_COLS + 1 }, (_, i) => {
						const x = (i * WIDTH) / GRID_COLS
						return <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={HEIGHT} />
					})}
					{Array.from({ length: GRID_ROWS + 1 }, (_, i) => {
						const y = (i * HEIGHT) / GRID_ROWS
						return <line key={`h-${i}`} x1={0} y1={y} x2={WIDTH} y2={y} />
					})}
				</g>

				{/* Funnel: dense on the left, merged and simplified on the right */}
				<g
					stroke="var(--accent)"
					strokeWidth={1.5}
					strokeLinecap="round"
					opacity={0.16}
				>
					{FUNNEL_LINES.map((line) => (
						<path key={line.key} d={line.d} />
					))}
				</g>
			</svg>
		</div>
	)
}

export default OptimizationGridBg
