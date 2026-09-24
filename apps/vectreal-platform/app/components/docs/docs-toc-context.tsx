import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react'

import type { DocHeading } from '../../hooks/use-doc-toc'

interface DocsToc {
	headings: DocHeading[]
	activeId: string | null
}

const EMPTY: DocsToc = { headings: [], activeId: null }

const DocsTocContext = createContext<{
	toc: DocsToc
	setToc: (toc: DocsToc) => void
} | null>(null)

/**
 * Carries a docs page's contents from the page up to the site nav.
 *
 * On docs routes the nav is the docs bar, and below `xl` its sheet lists the
 * page's contents. The nav sits beside the docs layout rather than inside it,
 * so it cannot read the layout's state directly; the layout publishes here and
 * the nav reads. The contents are read from the rendered article, so they were
 * client-only before this too: the server HTML loses nothing.
 */
export function DocsTocProvider({ children }: { children: ReactNode }) {
	const [toc, setToc] = useState(EMPTY)
	const value = useMemo(() => ({ toc, setToc }), [toc])
	return (
		<DocsTocContext.Provider value={value}>{children}</DocsTocContext.Provider>
	)
}

export function useDocsToc(): DocsToc {
	return useContext(DocsTocContext)?.toc ?? EMPTY
}

/** Publishes the page's contents while the page is mounted, and clears them when it leaves. */
export function usePublishDocsToc(toc: DocsToc) {
	const setToc = useContext(DocsTocContext)?.setToc
	useEffect(() => {
		setToc?.(toc)
	}, [toc, setToc])
	useEffect(() => () => setToc?.(EMPTY), [setToc])
}
