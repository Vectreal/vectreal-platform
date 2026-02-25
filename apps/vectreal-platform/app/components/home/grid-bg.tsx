import { cn } from '@shared/utils'

interface GridBgProps {
	isMobile: boolean
}

const GridBg = ({ isMobile }: GridBgProps) => {
	return (
		<div className="bg-background absolute inset-0 z-0 h-full w-full">
			{/* Radial background behind grid items  */}
			<div className="from-accent/35 absolute inset-0 bg-radial-[ellipse_at_center] to-transparent transform-3d" />
			{/* Grid items */}
			<div className="absolute inset-0 grid grid-cols-16 grid-rows-4 gap-[1px] max-md:grid-cols-8">
				{Array.from({ length: isMobile ? 32 : 64 }).map((_, index) => (
					<div key={index} className={cn('bg-background rounded-sm')} />
				))}
			</div>

			{/* Overlay to create glow effect */}
			<div className="absolute inset-0 mix-blend-color-dodge blur-xl">
				<div className="from-accent/50 absolute inset-0 bg-radial-[ellipse_at_center] to-transparent transform-3d" />
				<div className="absolute inset-0 grid grid-cols-16 grid-rows-4 gap-[1px] max-md:grid-cols-8 max-md:grid-rows-4">
					{Array.from({ length: isMobile ? 32 : 64 }).map((_, index) => (
						<div key={index} className={cn('bg-background rounded-sm')} />
					))}
				</div>
			</div>

			{/* Top and bottom gradient overlays */}
			<div className="via-background/0 from-background to-background absolute inset-0 bg-gradient-to-b" />
		</div>
	)
}
export default GridBg
