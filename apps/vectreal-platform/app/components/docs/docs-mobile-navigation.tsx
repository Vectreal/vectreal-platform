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

	return (
		<div className="flex items-center justify-between gap-3 lg:hidden">
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
						<div className="mb-8">
							<DocsTreeNav
								pathname={pathname}
								onNavigate={() => setOpen(false)}
							/>
						</div>
						<div>
							<p className="text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wider uppercase">
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
