import { cn } from '@shared/utils'
import { Link } from 'react-router'

import {
	CONVERT_INDEX_PATH,
	convertPairPath,
	convertPairsBySource
} from '../../lib/convert/convert-pairs'

interface Props {
	pathname: string
}

/**
 * The control that switches format, and the only way between converters.
 *
 * Without it each pair page is a dead end: someone who converts a GLB to glTF
 * and then wants USDZ has to retype the URL, and that person - converting
 * several files in one sitting - is the repeat visitor the family is for.
 *
 * It is a rail with a marked row rather than a row of pills. Pills would make
 * the two targets look like equal siblings of the heading above them, which is
 * the uniform-cards shape the brand reference warns about; a rail says "these
 * are the same conversion with a different endpoint" and has room for six
 * formats without wrapping into a block of chips.
 *
 * The marker is the one place brand orange appears on these pages. That is
 * deliberate: it marks what the reader is looking at, which is the single job
 * the accent has.
 *
 * IT IS ONLY A RAIL WHERE THERE IS A RAIL. Above `lg` it sits in an 18rem
 * column under the heading and a vertical list is the shape of that column.
 * Below `lg` there is no column - it is the full width of the page - and
 * stacking the groups there produced 280px of near-empty screen between the
 * converter and the footer, every row a six-character label with two thirds of
 * the line unused. So the groups sit side by side instead, which is the same
 * control at half the height and reads as deliberate rather than as a sidebar
 * that fell over.
 *
 * They wrap rather than sitting in fixed columns, because the number of groups
 * is the number of source formats and that is the set the roadmap grows. Two
 * columns were right while there were two sources; STL made a third, which a
 * two-column grid strands alone in a half-width second row - the group naming
 * the format the visitor actually arrived with reading as a layout accident.
 * OBJ and FBX would take it to five.
 */
export function ConvertFormatNav({ pathname }: Props) {
	const groups = convertPairsBySource()
	const onIndex = pathname === CONVERT_INDEX_PATH

	return (
		<nav
			aria-label="Converters"
			className="flex flex-wrap gap-x-6 gap-y-8 lg:block lg:space-y-8"
		>
			{groups.map((group) => (
				<div key={group.from} className="min-w-32 flex-1 lg:min-w-0">
					<p className="text-muted-foreground text-eyebrow mb-3">
						Convert {group.fromLabel} to
					</p>

					<ul className="border-border border-l">
						{group.pairs.map((pair) => {
							const href = convertPairPath(pair)
							const isActive = pathname === href

							return (
								<li key={pair.slug}>
									<Link
										to={href}
										viewTransition
										aria-current={isActive ? 'page' : undefined}
										className={cn(
											'-ml-px flex items-baseline gap-2 border-l-2 py-2 pl-4 text-sm transition-colors',
											isActive
												? 'text-foreground border-[rgb(var(--orange-rgb))] font-medium'
												: 'text-muted-foreground hover:text-foreground border-transparent'
										)}
									>
										{pair.toLabel}
										<code className="text-muted-foreground text-label-xs font-mono">
											.{pair.to}
										</code>
									</Link>
								</li>
							)
						})}
					</ul>
				</div>
			))}

			<Link
				to={CONVERT_INDEX_PATH}
				viewTransition
				aria-current={onIndex ? 'page' : undefined}
				className={cn(
					'hover:text-foreground inline-block w-full text-sm underline underline-offset-4 transition-colors lg:w-auto',
					onIndex && 'text-foreground font-medium'
				)}
			>
				All converters
			</Link>
		</nav>
	)
}
