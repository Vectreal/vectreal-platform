import { cn } from '@shared/utils'

import type { SceneStatus } from '../../lib/domain/dashboard/dashboard-confirmation'

/**
 * What a scene's status looks like. One owner, one vocabulary.
 *
 * The dashboard had three, and two of them disagreed about what the brand
 * colour means:
 *
 * - `StatusBreakdown` painted **published** in brand orange, on the grounds
 *   that it is the state costing a quota slot.
 * - `ScenePublishPanel` paints **draft** in brand orange, because a draft is
 *   the state with something to do about it, and `--success` once the scene is
 *   live - "the token the rest of the app already uses to mean this worked".
 * - The scene table, the resume band and the scene card used a solid `Badge`
 *   fill and no accent at all.
 *
 * So the same scene wore an orange dot on the dashboard and a green one on its
 * own page, with orange there marking the state it was not in. The argument
 * that settled the first of those - "nothing else in the app says
 * published-is-green" - was already false when it was written.
 *
 * Resolved by taking the accent out of the question. `--orange` is the brand;
 * it identifies Vectreal and marks what to do next, and a scene's status is
 * neither. `--success` means live, which is the one reading both surfaces can
 * hold at once, and not-live is neutral at two strengths.
 *
 * A solid fill was separately the wrong weight. `--primary` is maximum contrast
 * in both themes, so on a card whose job is to help someone find a scene by
 * name or picture, the loudest element was the word "Published". Status is
 * context here, not the answer to the question the page is asked.
 */

export const SCENE_STATUS_DOT: Record<SceneStatus, string> = {
	published: 'bg-success',
	draft: 'bg-muted-foreground/60',
	archived: 'bg-muted-foreground/30'
}

interface SceneStatusTagProps {
	status: SceneStatus
	className?: string
}

/** One scene's status: a dot and the word, at the weight of a caption. */
export function SceneStatusTag({ status, className }: SceneStatusTagProps) {
	return (
		<span
			className={cn(
				'text-muted-foreground text-label-xs flex items-center gap-1.5 capitalize',
				className
			)}
		>
			<span
				className={cn(
					'size-1.5 shrink-0 rounded-full',
					SCENE_STATUS_DOT[status]
				)}
				aria-hidden="true"
			/>
			{status}
		</span>
	)
}
