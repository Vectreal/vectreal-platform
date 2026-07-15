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
	const doubled = [...items]

	return (
		<div
			className={cn(
				'border-surface-border flex w-full justify-center gap-12 overflow-hidden border-t py-8 whitespace-nowrap',
				className
			)}
			aria-label="Social proof highlights"
			role="marquee"
		>
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
	)
}
