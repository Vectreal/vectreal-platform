import { Card } from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { ComponentProps, CSSProperties } from 'react'

interface BasicCardProps extends ComponentProps<'div'> {
	className?: string
	cardClassName?: string
	/**
	 * Inline styles for the inner `Card`. Unknown props spread onto the outer
	 * wrapper, so a plain `style` would sit *behind* the card surface rather
	 * than on it.
	 */
	cardStyle?: CSSProperties
	/** Lifts this card one step up the elevation ladder. */
	highlight?: boolean
	as?: 'div' | 'article' | 'section' | 'header'
}

/**
 * A `Card` that can sit one step higher than its neighbours.
 *
 * The card body is left to `Card`, which already carries `ds-raised`.
 *
 * There used to be a brand highlight bar across the top edge: a 4px orange
 * strip, and behind it a blurred orange glow on `animate-pulse`. That is three
 * separate problems on every card in the product. Two of them are on the
 * doctrine's ban list by name - a coloured strip on a card edge, and a coloured
 * glow - and the third was an infinite animation that no `prefers-reduced-
 * motion` rule reached, because the block in `globals.css` is a hand-maintained
 * allowlist and Tailwind's built-in `animate-pulse` was never added to it.
 *
 * The bar was also the only thing `highlight` did, and with `highlight`
 * undefined it still drew a 1px orange stub - so every card in the product wore
 * a piece of brand furniture nobody had asked for.
 *
 * Emphasis is a step on the ladder instead. `ds-raised` on the wrapper makes
 * the `ds-raised` card inside it resolve to 8% rather than 4%, which is the
 * ladder's own self-correcting nesting rule doing exactly the job it was
 * written for. No new class, no colour, and it tracks the theme.
 */
const BasicCard = ({
	children,
	className,
	cardClassName,
	cardStyle,
	highlight,
	as: Component = 'div',
	...props
}: BasicCardProps) => {
	return (
		<Component
			className={cn(
				'group relative overflow-hidden rounded-2xl',
				highlight && 'ds-raised',
				className
			)}
			{...props}
		>
			<Card
				className={cn('relative h-full rounded-2xl', cardClassName)}
				style={cardStyle}
			>
				{children}
			</Card>
		</Component>
	)
}

export default BasicCard
