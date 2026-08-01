import { cn } from '@shared/utils'

interface SectionLabelProps {
	children: React.ReactNode
	className?: string
}

const SectionLabel = ({ children, className }: SectionLabelProps) => (
	<div
		className={cn(
			'border-orange/20 bg-orange/5 text-orange/70 text-eyebrow -ml-1 inline-flex w-fit items-center gap-1.5 self-start rounded-full border px-3 py-1.5',
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
