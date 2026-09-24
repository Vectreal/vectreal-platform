import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import {
	CONVERT_INDEX_PATH,
	convertPairPath,
	convertPairsBySource,
	type ConvertPair
} from '../../lib/convert/convert-pairs'

import type { ReactNode } from 'react'

/**
 * The control that switches format, and the way between converters.
 *
 * One line, read as the conversion itself: from one format, to another. It sits
 * in the page header under the title it changes, so switching is a choice made
 * where the reader already is, and the converter keeps the full width below.
 *
 * It replaced a vertical rail listing every pair under its source. That grew a
 * row per pair (five sources made it longer than the converter beside it), put
 * the conversion a reader wanted into a list of all of them, and drew its
 * structure with a line per group. Here there are only two questions, and each
 * has one row of answers.
 *
 * Every option is a real link, so a crawler reaches every pair from every pair.
 * Choosing a source keeps the current target where that pair exists, and falls
 * back to the source's first target where it does not.
 */
export function ConvertFormatSwitch({ pair }: { pair: ConvertPair }) {
	const sources = convertPairsBySource()
	const targets = sources.find((group) => group.from === pair.from)?.pairs ?? []

	return (
		<nav
			aria-label="Converters"
			className="flex flex-wrap items-center gap-x-3 gap-y-3"
		>
			<Group label="From">
				{sources.map((group) => {
					const next =
						group.pairs.find((candidate) => candidate.to === pair.to) ??
						group.pairs[0]
					const active = group.from === pair.from
					return (
						<Option
							key={group.from}
							to={convertPairPath(next)}
							active={active}
							current={active ? 'true' : undefined}
						>
							{group.fromLabel}
						</Option>
					)
				})}
			</Group>

			{/*
			  Only where the two groups share a line. Once they wrap, the arrow
			  lands alone at the start of the second row pointing at nothing, and
			  the groups' own From and To already say the direction.
			*/}
			<ArrowRight
				className="text-muted-foreground hidden size-4 shrink-0 lg:block"
				aria-hidden="true"
			/>

			<Group label="To">
				{targets.map((target) => {
					const active = target.slug === pair.slug
					return (
						<Option
							key={target.slug}
							to={convertPairPath(target)}
							active={active}
							current={active ? 'page' : undefined}
						>
							{target.toLabel}
						</Option>
					)
				})}
			</Group>

			<Link
				to={CONVERT_INDEX_PATH}
				viewTransition
				className="text-muted-foreground hover:text-foreground text-body-sm ml-1 underline-offset-4 transition-colors hover:underline"
			>
				All converters
			</Link>
		</nav>
	)
}

function Group({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div
			role="group"
			aria-label={label}
			className="ds-sunken flex flex-wrap items-center gap-1 rounded-xl p-1"
		>
			<span
				className="text-eyebrow text-muted-foreground px-2"
				aria-hidden="true"
			>
				{label}
			</span>
			{children}
		</div>
	)
}

function Option({
	to,
	active,
	current,
	children
}: {
	to: string
	active: boolean
	current?: 'page' | 'true'
	children: ReactNode
}) {
	return (
		<Link
			to={to}
			viewTransition
			aria-current={current}
			className={cn(
				// Concentric with its group: the group's 20px corner less its 4px padding.
				'text-body-sm rounded-lg px-3 py-1.5 transition-colors',
				active
					? 'ds-overlay text-foreground font-medium'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			{children}
		</Link>
	)
}
