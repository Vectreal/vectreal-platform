import { cn } from '@shared/utils'

/*
  The grid is already sized in CSS — 16 columns at desktop, 8 below `md`, four
  rows either way — so the cell count follows the same breakpoint instead of a
  prop. Cells past the mobile count are dropped from grid flow with
  `max-md:hidden` rather than never rendered.

  The count used to come from a user-agent sniff in the home loader, which
  cannot be right here: `/` is prerendered, so that sniff ran with no request
  at all and every visitor received the 64-cell desktop grid until hydration
  redrew it.
*/
const DESKTOP_CELLS = 64
const MOBILE_CELLS = 32

const GridCells = () => (
	<>
		{Array.from({ length: DESKTOP_CELLS }).map((_, index) => (
			<div
				key={index}
				className={cn(
					'bg-background rounded-sm',
					index >= MOBILE_CELLS && 'max-md:hidden'
				)}
			/>
		))}
	</>
)

const GridBg = () => {
	return (
		<div className="bg-background absolute inset-0 z-0 h-full w-full">
			{/* Radial background behind grid items  */}
			<div className="from-orange/35 absolute inset-0 bg-radial-[ellipse_at_center] to-transparent transform-3d" />
			{/* Grid items */}
			<div className="absolute inset-0 grid grid-cols-16 grid-rows-4 gap-[1px] max-md:grid-cols-8">
				<GridCells />
			</div>

			{/* Overlay to create glow effect */}
			<div className="absolute inset-0 mix-blend-color-dodge blur-xl">
				<div className="from-orange/50 absolute inset-0 bg-radial-[ellipse_at_center] to-transparent transform-3d" />
				<div className="absolute inset-0 grid grid-cols-16 grid-rows-4 gap-[1px] max-md:grid-cols-8 max-md:grid-rows-4">
					<GridCells />
				</div>
			</div>

			{/* Top and bottom gradient overlays */}
			<div className="via-background/0 from-background to-background absolute inset-0 bg-gradient-to-b" />
		</div>
	)
}
export default GridBg
