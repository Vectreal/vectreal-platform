import { cn } from '@shared/utils'

import SectionLabel from './section-label'

interface SectionHeadingProps {
	label: string
	title: string
	subtitle?: string
	align?: 'left' | 'center'
}

const SectionHeading = ({
	label,
	title,
	subtitle,
	align = 'left'
}: SectionHeadingProps) => (
	<div
		className={cn(
			'flex flex-col gap-4',
			align === 'center' && 'items-center text-center'
		)}
	>
		<SectionLabel>{label}</SectionLabel>
		<h2 className="text-h2 text-foreground">{title}</h2>
		{subtitle && (
			<p className="text-muted-foreground text-body-lg max-w-xl">{subtitle}</p>
		)}
	</div>
)

export default SectionHeading
