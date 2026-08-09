import { cn } from '@shared/utils'

import type { CSSProperties, ReactNode } from 'react'

interface ArticleMetaProps {
	/** Rendered first, in the accent colour, when present. */
	category?: string
	items: ReactNode[]
	className?: string
	/** For surfaces that must not follow the theme, such as the article hero. */
	style?: CSSProperties
}

/**
 * The category, date and reading-time row above an article title.
 *
 * Four of these existed across the newsroom and no two matched: the separator
 * was a `·` in a `text-border` span in one place and a `•` inside the text in
 * another, the tracking was `0.12em` here and `wide` there, and the category
 * was `text-primary` - which is plain foreground, so the accent it was reaching
 * for never appeared. Brand orange is `text-orange`, as the docs route already
 * had it.
 */
export function ArticleMeta({
	category,
	items,
	className,
	style
}: ArticleMetaProps) {
	return (
		<div
			className={cn(
				'text-muted-foreground text-label-xs flex flex-wrap items-center gap-1.5',
				className
			)}
			style={style}
		>
			{category ? (
				<span className="text-orange text-eyebrow">{category}</span>
			) : null}
			{items.map((item, index) => (
				<span key={index} className="flex items-center gap-1.5">
					{(index > 0 || category) && (
						<span aria-hidden="true" className="opacity-40">
							·
						</span>
					)}
					{item}
				</span>
			))}
		</div>
	)
}
