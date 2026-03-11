import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from '@shared/components/ui/sheet'
import { BookText, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DocsPageToc } from './docs-page-toc'
import { DocsTreeNav } from './docs-tree-nav'

import type { DocHeading } from '../../hooks/use-doc-toc'

interface DocsMobileNavigationProps {
	pathname: string
	headings: DocHeading[]
	activeId: string | null
}

export function DocsMobileNavigation({
	pathname,
	headings,
	activeId
}: DocsMobileNavigationProps) {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		setOpen(false)
	}, [pathname])

	return (
		<div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button variant="outline" size="sm" className="gap-2">
						<Menu className="h-4 w-4" aria-hidden="true" />
						Browse docs
					</Button>
				</SheetTrigger>
				<SheetContent side="left" className="w-[90vw] max-w-sm">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<BookText className="h-4 w-4" aria-hidden="true" />
							Documentation
						</SheetTitle>
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
