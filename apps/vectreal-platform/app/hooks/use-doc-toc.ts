import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { type RefObject, useEffect, useMemo, useState } from 'react'

export interface DocHeading {
	id: string
	title: string
	level: 2 | 3
}

function getHeadingTitle(heading: HTMLElement): string {
	const clone = heading.cloneNode(true) as HTMLElement
	const autolink = clone.querySelector("a[aria-hidden='true']")
	autolink?.remove()
	return clone.textContent?.trim() ?? ''
}

export function useDocToc(
	contentRef: RefObject<HTMLElement | null>,
	dependencyKey?: string
) {
	const [headings, setHeadings] = useState<DocHeading[]>([])
	const [activeId, setActiveId] = useState<string | null>(null)
	/*
	  The site nav swaps at the same breakpoint as `--spacing-below-nav`, so the
	  observer is rebuilt when it crosses: a phone rotated to portrait otherwise
	  kept the landscape band while headings landed 12px higher.
	*/
	const isMobile = useIsMobile()

	useEffect(() => {
		const contentRoot = contentRef.current
		if (!contentRoot) {
			setHeadings([])
			return
		}

		const headingElements = Array.from(
			contentRoot.querySelectorAll<HTMLElement>('h2[id], h3[id]')
		)

		const nextHeadings = headingElements
			.map((heading) => {
				const level = Number.parseInt(heading.tagName.replace('H', ''), 10)
				if (level !== 2 && level !== 3) {
					return null
				}

				const title = getHeadingTitle(heading)
				if (!heading.id || title.length === 0) {
					return null
				}

				return {
					id: heading.id,
					title,
					level
				} satisfies DocHeading
			})
			.filter((heading): heading is DocHeading => heading !== null)

		setHeadings(nextHeadings)
	}, [contentRef, dependencyKey])

	// Apart from the observer below, which also rebuilds on a breakpoint
	// crossing: a rotated phone keeps its highlight rather than jumping back.
	useEffect(() => {
		const hashId = window.location.hash.replace('#', '')
		if (hashId && headings.some((heading) => heading.id === hashId)) {
			setActiveId(hashId)
		} else {
			setActiveId(headings[0]?.id ?? null)
		}
	}, [headings])

	useEffect(() => {
		if (headings.length === 0) {
			return
		}

		const observedIds = new Set(headings.map((heading) => heading.id))
		const headingElements = headings
			.map((heading) => document.getElementById(heading.id))
			.filter((element): element is HTMLElement => element !== null)

		if (headingElements.length === 0) {
			return
		}

		/*
		  The band starts where an anchor jump lands a heading: its resolved
		  `scroll-margin-top`, which `mdx.module.css` reads from
		  `--spacing-below-nav`, so the nav each viewport shows is cleared. Read
		  here rather than restated, since a heading that has just been jumped to
		  must count as in view.
		*/
		const clearance = getComputedStyle(headingElements[0]).scrollMarginTop

		const observer = new IntersectionObserver(
			(entries) => {
				const intersecting = entries
					.filter((entry) => entry.isIntersecting)
					.sort(
						(a, b) =>
							Math.abs(a.boundingClientRect.top) -
							Math.abs(b.boundingClientRect.top)
					)

				const nearestId = intersecting[0]?.target.id
				if (nearestId && observedIds.has(nearestId)) {
					setActiveId(nearestId)
				}
			},
			{
				rootMargin: `-${clearance} 0px -65% 0px`,
				threshold: [0, 0.1, 0.5, 1]
			}
		)

		for (const element of headingElements) {
			observer.observe(element)
		}

		const onHashChange = () => {
			const nextHashId = window.location.hash.replace('#', '')
			if (nextHashId && observedIds.has(nextHashId)) {
				setActiveId(nextHashId)
			}
		}

		window.addEventListener('hashchange', onHashChange)

		return () => {
			window.removeEventListener('hashchange', onHashChange)
			observer.disconnect()
		}
	}, [headings, isMobile])

	return useMemo(
		() => ({
			headings,
			activeId
		}),
		[activeId, headings]
	)
}
