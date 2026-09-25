import { cn } from '@shared/utils'
import { ChevronDown } from 'lucide-react'
import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type MouseEvent,
	type PointerEvent
} from 'react'
import { Link, useLocation } from 'react-router'

import { isNavItemActive } from './nav-items'
import { dissolveIn } from '../../lib/dither/dither'
import { entersFunnel } from '../../lib/navigation/site-map'

import type { SiteLink, SiteSection } from '../../lib/navigation/site-map'

/** Long enough that a pointer crossing the bar on its way down the page opens nothing. */
const HOVER_OPEN_MS = 120
/** Long enough to cross the gap between a trigger and its panel. */
const HOVER_CLOSE_MS = 200
/** A click this soon after hover opened the panel is the same gesture, not a second press. */
const HOVER_CLICK_MS = 600
const DISSOLVE_MS = 180

const panelId = (section: SiteSection) =>
	`nav-panel-${section.label.toLowerCase().replace(/\s+/g, '-')}`

const isMouse = (event: PointerEvent) => event.pointerType === 'mouse'

/**
 * Which panel is open, and what opened it. A panel the mouse opened by
 * hovering belongs to the mouse and closes when it leaves; one opened by a
 * press (a click, Enter or Space) stays until it is dismissed. Guessing the
 * opener from where focus sits does not work: a click in Chrome focuses the
 * button too, and a keyboard user's focus can sit on a trigger while the
 * mouse does something else.
 */
type Open = { label: string; by: 'hover' | 'press' } | null

/**
 * The nav's categories: a button each, opening a panel of links under the bar.
 *
 * Built as the WAI-ARIA disclosure navigation rather than on Radix's
 * NavigationMenu, which would put about 5 KB gzipped more on every page's first
 * load for behavior two buttons need. Each panel follows its button in the
 * DOM, so Tab walks from a trigger into its links and on to the next trigger.
 * Escape closes and hands focus back to the trigger; a click outside, focus
 * moving elsewhere, or a navigation closes too. A mouse opens on hover after a
 * short intent delay; touch and keyboard open on press.
 */
export function NavPanels({
	sections,
	pathname
}: {
	sections: readonly SiteSection[]
	pathname: string
}) {
	const [open, setOpen] = useState<Open>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const triggers = useRef(new Map<string, HTMLButtonElement>())
	const timer = useRef(0)
	const hoverOpenedAt = useRef(0)

	const hover = (label: string | null, ms: number) => {
		window.clearTimeout(timer.current)
		timer.current = window.setTimeout(() => {
			if (label) hoverOpenedAt.current = performance.now()
			setOpen(label ? { label, by: 'hover' } : null)
		}, ms)
	}

	// Every navigation closes it, the pilot's query-only one included: keyed on the location, not the path.
	const { key: locationKey } = useLocation()
	useEffect(() => {
		setOpen(null)
	}, [locationKey])

	useEffect(() => () => window.clearTimeout(timer.current), [])

	const openLabel = open?.label
	useEffect(() => {
		if (!openLabel) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return
			setOpen(null)
			// Focus goes back to the trigger only from inside the nav: a panel opened by hover must not pull it out of a form field.
			if (rootRef.current?.contains(document.activeElement))
				triggers.current.get(openLabel)?.focus()
		}
		const onPointerDown = (event: globalThis.PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
		}
		document.addEventListener('keydown', onKey)
		document.addEventListener('pointerdown', onPointerDown)
		return () => {
			document.removeEventListener('keydown', onKey)
			document.removeEventListener('pointerdown', onPointerDown)
		}
	}, [openLabel])

	/** A link in a panel was followed. When the page stays where it was (an outside link, or a link opened in a new tab), focus goes back to the trigger rather than to nowhere. */
	const follow = (label: string, pageStays: boolean) => {
		setOpen(null)
		if (pageStays) triggers.current.get(label)?.focus()
	}

	return (
		<div
			ref={rootRef}
			className="flex items-center gap-0.5"
			onPointerLeave={(event) => {
				if (!isMouse(event)) return
				// A pointer passing through opens nothing, and takes with it only what it opened.
				window.clearTimeout(timer.current)
				if (open?.by === 'hover') hover(null, HOVER_CLOSE_MS)
			}}
			onBlur={(event) => {
				// Only when focus lands somewhere else. Safari does not focus a link it clicks, so a click inside moves focus nowhere; closing then would unmount the link under the pointer. Clicks outside are the pointerdown listener's.
				const next = event.relatedTarget as Node | null
				if (next && !rootRef.current?.contains(next)) setOpen(null)
			}}
		>
			{sections.map((section) => {
				const isOpen = open?.label === section.label
				const isCurrent = section.links.some(
					(link) => !link.external && isNavItemActive(link, pathname)
				)
				return (
					<Fragment key={section.label}>
						<button
							ref={(el) => {
								if (el) triggers.current.set(section.label, el)
								else triggers.current.delete(section.label)
							}}
							type="button"
							aria-expanded={isOpen}
							aria-controls={panelId(section)}
							onClick={(event) => {
								window.clearTimeout(timer.current)
								// Only a pointer's click can finish a hover; Enter and Space report no clicks (detail 0).
								const sameGesture =
									event.detail > 0 &&
									open?.by === 'hover' &&
									performance.now() - hoverOpenedAt.current < HOVER_CLICK_MS
								if (isOpen && sameGesture) return
								setOpen(isOpen ? null : { label: section.label, by: 'press' })
							}}
							onPointerEnter={(event) => {
								// A pressed panel is the reader's until they dismiss it; a mouse sweeping past does not swap it.
								if (!isMouse(event) || open?.by === 'press') return
								// Back on its own open trigger: keep it, without restarting the gesture a click would finish.
								if (isOpen) return window.clearTimeout(timer.current)
								hover(section.label, open ? 0 : HOVER_OPEN_MS)
							}}
							className={cn(
								'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
								isOpen || isCurrent
									? 'text-foreground'
									: 'text-muted-foreground hover:text-foreground'
							)}
						>
							{section.label}
							<ChevronDown
								aria-hidden="true"
								className={cn(
									'size-3.5 transition-transform duration-(--duration-fast) motion-reduce:transition-none',
									isOpen && 'rotate-180'
								)}
							/>
						</button>
						{isOpen && (
							<NavPanel
								id={panelId(section)}
								section={section}
								pathname={pathname}
								onPointerEnter={() => window.clearTimeout(timer.current)}
								onFollow={(pageStays) => follow(section.label, pageStays)}
							/>
						)}
					</Fragment>
				)
			})}
		</div>
	)
}

function NavPanel({
	id,
	section,
	pathname,
	onPointerEnter,
	onFollow
}: {
	id: string
	section: SiteSection
	pathname: string
	onPointerEnter: () => void
	/** A link in it was followed: closed, even when the page stays, as an outside link leaves it. */
	onFollow: (pageStays: boolean) => void
}) {
	const ref = useRef<HTMLDivElement>(null)

	// It arrives through the page's own dither, the way the product window changes views: the dissolve reports that something opened.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
			return
		return dissolveIn(el, DISSOLVE_MS)
	}, [])

	return (
		// Spans the bar so the panel lines up with the page, but only the panel takes the pointer: the band beside it is still the page.
		<div
			id={id}
			ref={ref}
			className="pointer-events-none absolute inset-x-0 top-full pt-2"
		>
			<div className="container-page">
				<ul
					aria-label={section.label}
					onPointerEnter={onPointerEnter}
					className={cn(
						'ds-overlay pointer-events-auto grid gap-1 rounded-2xl p-2 shadow-lg',
						section.links.length > 3 ? 'grid-cols-4' : 'grid-cols-3'
					)}
				>
					{section.links.map((link) => (
						<li key={link.to}>
							<PanelLink link={link} pathname={pathname} onFollow={onFollow} />
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

function PanelLink({
	link,
	pathname,
	onFollow
}: {
	link: SiteLink
	pathname: string
	onFollow: (pageStays: boolean) => void
}) {
	// A modified click opens the link in a new tab or window, so this page stays too.
	const onClick = (event: MouseEvent) =>
		onFollow(link.external || event.metaKey || event.ctrlKey || event.shiftKey)
	// A middle click follows it into a new tab with no click event at all.
	const onAuxClick = (event: MouseEvent) => {
		if (event.button === 1) onFollow(true)
	}
	const className =
		'hover:bg-accent focus-visible:bg-accent flex h-full flex-col gap-1 rounded-xl p-4 transition-colors focus-visible:outline-none'
	const content = (
		<>
			<span className="text-foreground text-sm font-medium">{link.label}</span>
			{link.description && (
				<span className="text-muted-foreground text-body-sm">
					{link.description}
				</span>
			)}
		</>
	)
	return link.external ? (
		<a
			href={link.to}
			target="_blank"
			rel="noreferrer"
			onClick={onClick}
			onAuxClick={onAuxClick}
			className={className}
		>
			{content}
		</a>
	) : (
		<Link
			to={link.to}
			viewTransition={entersFunnel(link.to)}
			aria-current={isNavItemActive(link, pathname) ? 'page' : undefined}
			onClick={onClick}
			onAuxClick={onAuxClick}
			className={className}
		>
			{content}
		</Link>
	)
}
