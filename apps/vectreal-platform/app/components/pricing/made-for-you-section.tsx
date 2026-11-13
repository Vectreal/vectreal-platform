import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import {
	MADE_FOR_YOU_PRICES,
	PILOT_CONTACT_TOPIC,
	PILOT_PRICE,
	PRICING_PAGE_COPY
} from '../../constants/product-copy'
import { formatPrice } from '../../lib/domain/billing/plan-price'

const COPY = PRICING_PAGE_COPY.madeForYou

/** Whole euros, formatted as the plan cards format their prices. */
const euros = (amount: number) => formatPrice(amount * 100, 'eur')

const ROWS = [
	{ key: 'free', price: euros(MADE_FOR_YOU_PRICES.free) },
	{ key: 'standard', price: euros(MADE_FOR_YOU_PRICES.standard) },
	{
		key: 'artist',
		price: `${COPY.rows.artist.byQuote} ${euros(MADE_FOR_YOU_PRICES.artist.from)} to ${euros(MADE_FOR_YOU_PRICES.artist.to)}`
	},
	{
		key: 'setup',
		price: `${euros(MADE_FOR_YOU_PRICES.setup)} ${COPY.rows.setup.once}`
	}
] as const

/**
 * The offer for a brand, before the software plans: the pilot's price as the
 * figure to remember, and what each part of it costs as ruled rows beside it,
 * set as the home page's steps are. A reader who came from a letter finds the
 * price of what the letter offered first; the plans follow for whoever wants
 * the software itself.
 *
 * The first action is the free model, the same door as the home page; the
 * pilot is a conversation until it can be bought.
 */
export function MadeForYouSection() {
	return (
		<div className="grid items-start gap-16 lg:grid-cols-[5fr_6fr] lg:gap-24">
			<div>
				<h2 id="made-for-you-heading" className="text-h2">
					{COPY.heading}
				</h2>
				<p className="text-muted-foreground text-body-lg mt-6 max-w-xl">
					{COPY.lead}
				</p>

				<div className="mt-10 space-y-2">
					<p className="text-eyebrow text-muted-foreground">
						{COPY.pilot.label}
					</p>
					<p className="text-h2 text-foreground tabular-nums">{euros(PILOT_PRICE)}</p>
					<p className="text-body">{COPY.pilot.body}</p>
					<p className="text-muted-foreground text-body-sm max-w-md">
						{COPY.pilot.terms}
					</p>
				</div>

				<div className="mt-10 flex flex-col gap-3 sm:flex-row">
					<Button
						asChild
						size="lg"
						variant="brand"
						className="tap-target relative"
					>
						<Link to="/free-model">
							{COPY.cta}
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
					<Button
						asChild
						size="lg"
						variant="secondary"
						className="tap-target relative"
					>
						<Link to={`/contact?topic=${PILOT_CONTACT_TOPIC}`}>
							{COPY.pilotCta}
						</Link>
					</Button>
				</div>
			</div>

			<ul aria-label={COPY.rowsLabel}>
				{ROWS.map(({ key, price }) => (
					<li
						key={key}
						className="border-foreground/10 grid gap-1.5 border-t py-7 last:border-b sm:grid-cols-[1fr_auto] sm:gap-x-8"
					>
						<h3 className="text-body-lg text-foreground font-medium">
							{COPY.rows[key].title}
						</h3>
						<p className="text-body-lg tabular-nums sm:row-span-2 sm:text-right">
							{price}
						</p>
						<p className="text-muted-foreground text-body">
							{COPY.rows[key].body}
						</p>
					</li>
				))}
			</ul>
		</div>
	)
}
