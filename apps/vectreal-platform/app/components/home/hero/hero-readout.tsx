import { cn } from '@shared/utils'

import styles from './hero-sheet.module.css'
import { useHeroState, type HeroStore } from './hero-store'
import { HOME_PAGE_COPY } from '../../../constants/product-copy'
import { HERO_MODEL } from '../../../lib/samples/sample-models'
import { inUnitOf } from '../in-unit-of'

import type { ReactNode } from 'react'

/*
  The sheet's captions: the figure label above the stage and the readout of
  what the file on it holds. Each reads only its own slice of the hero store,
  so the download counter re-renders its cell and nothing else.
*/

const COPY = HOME_PAGE_COPY.stage

const count = new Intl.NumberFormat('en-US')

export function FigureLabel({ store }: { store: HeroStore }) {
	const view = useHeroState(store, (s) => s.view)
	const face =
		view === 'live'
			? COPY.liveView
			: view === 'dropped'
				? COPY.droppedView
				: HERO_MODEL.view
	return (
		<span className="text-eyebrow">
			{COPY.figure} · {face}
		</span>
	)
}

function Cell({
	label,
	className,
	children
}: {
	label: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={className}>
			<span className={cn('text-eyebrow', styles.label)}>{label}</span>
			{children}
		</div>
	)
}

/*
  The readout is a polite live region, so what the stage finds in a dropped file
  is announced. The download counter is not: it lives in its own cell, outside
  the announced text, or a screen reader would read every frame of it.
*/
export function Readout({ store }: { store: HeroStore }) {
	const readout = useHeroState(store, (s) => s.readout)
	const original =
		readout.originalBytes === null
			? null
			: inUnitOf(readout.originalBytes, readout.originalBytes)
	return (
		<>
			<div className="contents" aria-live="polite">
				<Cell label={COPY.readouts.file} className={styles.file}>
					<span className={styles.value}>{readout.fileName}</span>
				</Cell>
				<Cell label={COPY.readouts.materials} className={styles.count}>
					<span className={styles.value}>
						{count.format(readout.materials)}
					</span>
				</Cell>
				<Cell label={COPY.readouts.vertices} className={styles.count}>
					<span className={styles.value}>{count.format(readout.vertices)}</span>
				</Cell>
				<Cell label={COPY.readouts.textures} className={styles.count}>
					<span className={styles.value}>{count.format(readout.textures)}</span>
				</Cell>
				{original && (
					<Cell label={COPY.readouts.original} className={styles.original}>
						<span className={styles.value}>
							{original.value}
							<small>{original.unit}</small>
						</span>
					</Cell>
				)}
			</div>
			<SizeCell store={store} />
			<StatusCell store={store} />
		</>
	)
}

function SizeCell({ store }: { store: HeroStore }) {
	const total = useHeroState(store, (s) => s.readout.bytes)
	const shown = useHeroState(store, (s) => s.shownBytes)
	const got = inUnitOf(shown, total)
	const of = inUnitOf(total, total)
	return (
		<Cell label={COPY.readouts.size} className={styles.size}>
			<span
				className={styles.value}
				data-done={shown >= total ? '' : undefined}
			>
				{got.value}
				<small>
					<span className={styles.of}>/&nbsp;{of.value}&nbsp;</span>
					{of.unit}
				</small>
			</span>
		</Cell>
	)
}

function StatusCell({ store }: { store: HeroStore }) {
	const status = useHeroState(store, (s) => s.status)
	const busy = useHeroState(store, (s) => s.busy)
	return (
		<Cell label={COPY.readouts.status} className={styles.status}>
			<span
				className={styles.value}
				data-live={busy ? '' : undefined}
				role="status"
			>
				<i className={styles.dot} aria-hidden="true" />
				{COPY.status[status]}
			</span>
		</Cell>
	)
}
