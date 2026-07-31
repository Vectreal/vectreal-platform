import { formatFileSize } from '@shared/utils'
import { ArrowRight } from 'lucide-react'

import type { FC, ReactNode } from 'react'

export const formatCount = (value: number | null | undefined) =>
	typeof value === 'number' ? value.toLocaleString() : '-'

export const formatBytes = (value: number | null | undefined) =>
	typeof value === 'number' ? formatFileSize(value) : '-'

interface MetricRowProps {
	label: string
	children: ReactNode
}

export const MetricRow: FC<MetricRowProps> = ({ label, children }) => (
	<div className="flex items-center justify-between gap-3">
		<p className="text-muted-foreground">{label}</p>
		<div className="text-right font-medium">{children}</div>
	</div>
)

interface BeforeAfterProps {
	before: string
	after: string
	/** Appended after the pair, e.g. "(-62%)". */
	suffix?: string
}

export const BeforeAfter: FC<BeforeAfterProps> = ({
	before,
	after,
	suffix
}) => (
	<>
		{before}
		<ArrowRight className="text-muted-foreground mx-1 inline h-3 w-3" />
		{after}
		{suffix ? (
			<span className="text-muted-foreground ml-1">{suffix}</span>
		) : null}
	</>
)
