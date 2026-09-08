import { cn } from '@shared/utils'

interface SectionLabelProps {
	children: React.ReactNode
	className?: string
}

/*
  `text-orange`, not `text-orange/70`.

  The alpha was there all along but never rendered: tailwind-merge sorted
  `text-orange/70` and `text-eyebrow` into the same `text-color` group and
  dropped the colour. Registering the rungs as font sizes made the colour
  effective, and at 11px over this panel it measures 3.77:1. Full strength is
  6.59:1.
*/
const SectionLabel = ({ children, className }: SectionLabelProps) => (
	<div
		className={cn(
			'border-orange/20 bg-orange/5 text-orange text-eyebrow -ml-1 inline-flex w-fit items-center gap-1.5 self-start rounded-full border px-3 py-1.5',
			className
		)}
	>
		<span
			className="bg-orange/60 h-1.5 w-1.5 rounded-full"
			aria-hidden="true"
		/>
		{children}
	</div>
)

export default SectionLabel
