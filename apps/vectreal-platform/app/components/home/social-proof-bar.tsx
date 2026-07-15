// app/components/landing/social-proof-bar.tsx
import { cn } from '@shared/utils'

interface SocialProofItem {
	text: string
}

interface SocialProofBarProps {
	items: SocialProofItem[]
	className?: string
}

export function SocialProofBar({ items, className }: SocialProofBarProps) {
	// Duplicate items so the CSS marquee loop is seamless
	const doubled = [...items, ...items]

	return (
		<div
			className={cn(
				'border-surface-border w-full overflow-hidden border-y py-3',
				className
			)}
			aria-label="Social proof highlights"
			role="marquee"
		>
			<div className="animate-marquee flex w-max gap-12 whitespace-nowrap">
				{doubled.map((item, i) => (
					<span
						key={i}
						className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase"
					>
						<span
							className="bg-accent/60 inline-block h-1 w-1 rounded-full"
							aria-hidden="true"
						/>
						{item.text}
					</span>
				))}
			</div>
		</div>
	)
}
