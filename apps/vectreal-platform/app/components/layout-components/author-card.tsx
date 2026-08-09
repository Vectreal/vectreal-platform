import { Button } from '@shared/components/ui/button'
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from '@shared/components/ui/popover'
import { useEffect, useRef, useState } from 'react'

import { AuthorChip } from './author-chip'

interface AuthorCardAuthor {
	name: string
	role?: string
	avatar?: string
	bio?: string
	linkedinUrl?: string
}

interface AuthorCardProps {
	author: AuthorCardAuthor
}

const HOVER_OPEN_DELAY = 130
const HOVER_CLOSE_DELAY = 120

/**
 * The article byline, expanding into the author's bio and LinkedIn profile.
 *
 * Built on Popover rather than HoverCard: HoverCard ignores touch pointers
 * outright and strips the tabindex off everything inside its content, so on a
 * phone or a keyboard the card was unreachable. Popover opens on tap, click and
 * Enter; the hover intent below is layered on top so mice keep the old feel.
 */
export function AuthorCard({ author }: AuthorCardProps) {
	const [open, setOpen] = useState(false)
	const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const openedByHover = useRef(false)

	useEffect(
		() => () => {
			if (hoverTimer.current) {
				clearTimeout(hoverTimer.current)
			}
		},
		[]
	)

	function scheduleHover(nextOpen: boolean, pointerType: string) {
		// Touch fires pointerenter on tap as well, and would race the trigger's
		// own click handler into reopening what the tap just closed.
		if (pointerType !== 'mouse') {
			return
		}

		if (hoverTimer.current) {
			clearTimeout(hoverTimer.current)
		}

		hoverTimer.current = setTimeout(
			() => {
				openedByHover.current = nextOpen
				setOpen(nextOpen)
			},
			nextOpen ? HOVER_OPEN_DELAY : HOVER_CLOSE_DELAY
		)
	}

	function handleOpenChange(nextOpen: boolean) {
		if (hoverTimer.current) {
			clearTimeout(hoverTimer.current)
		}

		openedByHover.current = false
		setOpen(nextOpen)
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					className="h-[unset] gap-2 text-left"
					onPointerEnter={(event) => scheduleHover(true, event.pointerType)}
					onPointerLeave={(event) => scheduleHover(false, event.pointerType)}
				>
					<AuthorChip author={author} />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={10}
				collisionPadding={16}
				className="w-80 max-w-[calc(100vw-2rem)] p-4"
				onPointerEnter={(event) => scheduleHover(true, event.pointerType)}
				onPointerLeave={(event) => scheduleHover(false, event.pointerType)}
				// Hovering should not yank focus out of the article; a click or a
				// keypress still hands focus to the card as usual.
				onOpenAutoFocus={(event) => {
					if (openedByHover.current) {
						event.preventDefault()
					}
				}}
			>
				<div className="flex flex-col gap-3">
					<AuthorChip author={author} />
					<div className="min-w-0 flex-1">
						<p className="text-muted-foreground text-sm leading-relaxed">
							{author.bio ?? 'Author at Vectreal.'}
						</p>
						{author.linkedinUrl ? (
							<a
								href={author.linkedinUrl}
								target="_blank"
								rel="noreferrer"
								className="text-orange text-label-xs mt-2 inline-block font-medium hover:underline"
							>
								Connect on LinkedIn
							</a>
						) : null}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
