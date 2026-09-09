import { ScrollArea } from '@shared/components/ui/scroll-area'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from '@shared/components/ui/sheet'
import { useEffect, useState } from 'react'

import { DocsPageToc } from './docs-page-toc'
import { DocsTreeNav } from './docs-tree-nav'

import type { DocHeading } from '../../hooks/use-doc-toc'

interface DocsMobileNavigationProps extends React.PropsWithChildren {
	pathname: string
	headings: DocHeading[]
	activeId: string | null
}

export function DocsMobileNavigation({
	children,
	pathname,
	headings,
	activeId
}: DocsMobileNavigationProps) {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		setOpen(false)
	}, [pathname])

	/*
	  `xl:hidden`, not `lg:hidden`.

	  The contents rail opposite starts at `xl`, and this sheet was the only
	  other place the table of contents lived - so between 1024px and 1279px it
	  existed in neither. The tree nav has no such gap, which is what makes this
	  an oversight rather than a decision.

	  Widening that rail to `lg` instead would also have closed it, and cost 39%
	  of the reading column: measured at 1024px the article drops from 656px to
	  400px once two 256px rails are up. The sheet costs a click and no width.
	*/
	return (
		<div className="flex items-center justify-between gap-3 xl:hidden">
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>{children}</SheetTrigger>
				<SheetContent side="left" className="w-[90vw] max-w-sm">
					<SheetHeader>
						<SheetTitle>Documentation</SheetTitle>
						<SheetDescription>
							Navigate pages and jump to sections.
						</SheetDescription>
					</SheetHeader>
					<ScrollArea className="h-full px-4 pb-10">
						{/*
						  Hidden once the tree-nav rail is up at `lg`, so the sheet
						  does not offer a second copy of navigation already on
						  screen. Between `lg` and `xl` it carries the contents
						  alone, which is the reason it is still reachable there.
						*/}
						<div className="mb-8 lg:hidden">
							<DocsTreeNav
								pathname={pathname}
								onNavigate={() => setOpen(false)}
							/>
						</div>
						<div>
							<p className="text-muted-foreground text-eyebrow mb-2 px-1">
								On this page
							</p>
							<DocsPageToc
								headings={headings}
								activeId={activeId}
								onNavigate={() => setOpen(false)}
							/>
						</div>
					</ScrollArea>
				</SheetContent>
			</Sheet>
		</div>
	)
}
