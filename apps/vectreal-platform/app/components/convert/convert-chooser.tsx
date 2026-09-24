import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { convertPairsByTarget } from '../../lib/convert/convert-capabilities'
import { convertPairPath } from '../../lib/convert/convert-pairs'

/**
 * Every conversion we can perform, grouped by what it produces: the index, and
 * again under every converter, where `current` marks the one open and the
 * groups sit a level down, under that page's own heading for them.
 *
 * WHAT THIS PAGE IS FOR. Someone who typed "glb to usdz" lands on the pair page,
 * not here. Whoever reaches this one is deciding rather than converting, so the
 * job is to say what can come out and why you would want it, then get out of the
 * way. That makes the destination the unit, not the pair.
 *
 * TWO EARLIER VERSIONS AND WHY THEY WERE WRONG. The first was a from-by-to table
 * with each pair's rationale in its row, which duplicated the USDZ sentence word
 * for word - the sentence describes a format, and a format is reachable from
 * every source, so it repeats once per source by construction. The second lifted
 * those sentences into a glossary underneath, which removed the duplication but
 * put the explanation a scroll away from the choice it explains, and left the
 * matrix above it a bordered grid of four one-line rows: a spec sheet.
 *
 * Grouping by destination collapses both problems into nothing. Each format is
 * named once, its reason sits directly under its name, and the sources that can
 * reach it are the choices beneath - so the copy is unique, the explanation is
 * at the point of decision, and adding OBJ, STL and FBX adds chips to three
 * sections rather than three more sections of near-identical rows.
 *
 * It needs no client state and should keep needing none. Every chip is a real
 * `<a href>` a crawler follows, which is the entire distribution model here;
 * filtering with a control would put the unselected ones behind JavaScript,
 * which is where a crawler stops.
 */
export function ConvertChooser({
	current,
	groupHeading: GroupHeading = 'h2'
}: {
	current?: string
	groupHeading?: 'h2' | 'h3'
}) {
	const groups = convertPairsByTarget()

	return (
		/*
		  One column per destination on a wide screen, so the three read as the
		  three choices they are and the page's width is used, rather than a
		  stack of rows each a third full.
		*/
		<div className="grid gap-16 lg:grid-cols-3 lg:gap-12">
			{groups.map((group) => (
				/*
				  A labelled region per destination. The label is the half of the
				  choice the chips cannot say on their own: each one reads "from
				  GLB", and without the region name a screen reader never hears what
				  it converts *to*.
				*/
				<section key={group.to} aria-label={`To ${group.toLabel}`}>
					<div className="flex items-baseline gap-2">
						<GroupHeading className="text-h3 text-foreground">
							{group.toLabel}
						</GroupHeading>
						<code className="text-muted-foreground text-label-xs font-mono">
							.{group.to}
						</code>
					</div>

					<p className="text-muted-foreground text-body mt-4 max-w-prose lg:min-h-[3lh]">
						{group.reason}
					</p>

					{/*
					  Chips rather than cards or rows. They size to their label, so a
					  row of them cannot become the uniform grid the brand reference
					  warns about, and a fifth source lengthens the row instead of
					  adding a fifth block of prose.
					*/}
					<ul className="mt-8 flex flex-wrap gap-3">
						{group.pairs.map((pair) => (
							<li key={pair.slug}>
								<Link
									to={convertPairPath(pair)}
									viewTransition
									aria-current={pair.slug === current ? 'page' : undefined}
									className={cn(
										'text-body-sm group flex items-center gap-2 rounded-xl px-4 py-3 transition-colors duration-150',
										pair.slug === current
											? 'ds-overlay'
											: 'ds-raised hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))]'
									)}
								>
									<span className="text-muted-foreground">from</span>
									<span className="text-foreground font-medium">
										{pair.fromLabel}
									</span>
									<ArrowRight
										className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
										aria-hidden
									/>
								</Link>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}
