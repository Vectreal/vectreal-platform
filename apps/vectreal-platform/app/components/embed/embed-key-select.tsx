import { Button } from '@shared/components/ui/button'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Plus, RefreshCw } from 'lucide-react'
import { useId, type FC } from 'react'

import {
	isEmbedKeyUsable,
	type EmbedApiKeyOption
} from '../../lib/domain/embed/embed-key-options'
import { EMBED_COPY } from '../../lib/domain/embed/embed-snippet'
import { InlineNotice } from '../layout-components'

import type { EmbedApiKeysApi } from './use-embed-api-keys'

/**
 * One row: what it is called, and whether it can be picked.
 *
 * Exported and pure so the rule can be asserted directly as well as through the
 * listbox. Both matter: a pure test of this function passes happily while the
 * JSX renders `option.name` and ignores `disabled`, which is exactly what it did
 * until a spec opened the select.
 *
 * The suffix order is the one `EmbedApiKeyOption` documents, and getting it
 * wrong is a wrong instruction rather than a cosmetic slip:
 *
 * - `revoked` first. Its value is null *because* it was revoked, and
 *   `rotateApiKey` refuses anything that is not active, so telling its owner to
 *   rotate it sends them to an action that throws. A revoked key is replaced.
 * - `expired` next, ahead of `value`. An aged-out key keeps its stored
 *   ciphertext, so it decrypts and would otherwise read as selectable - and
 *   then 404 at the embed, which is the failure this panel exists to prevent.
 * - `value === null` last, which by elimination is the live key whose stored
 *   value cannot be read back: predating the column, or no longer decrypting.
 *   That one is the case rotation does fix.
 */
export function describeKeyOption(option: EmbedApiKeyOption): {
	name: string
	/** Why this row cannot be used, or null when it can. */
	suffix: string | null
	disabled: boolean
} {
	const name = `${option.name} ...${option.keyPreview}`

	if (option.revoked) {
		return { name, suffix: EMBED_COPY.keyRevokedSuffix, disabled: true }
	}

	if (option.expired) {
		return { name, suffix: EMBED_COPY.keyExpiredSuffix, disabled: true }
	}

	if (option.value === null) {
		return { name, suffix: EMBED_COPY.keyRotateSuffix, disabled: true }
	}

	return { name, suffix: null, disabled: false }
}

interface EmbedKeySelectProps {
	api: EmbedApiKeysApi
}

/**
 * Pick a key for this project, or make one.
 *
 * There is no paste field. Someone reaching this panel has uploaded a model,
 * composed it and published it; they have never held an API key, so asking them
 * to produce one was asking for something that does not exist yet. The value
 * comes back from the loader now, so the two real answers - "use one of these"
 * and "make one" - are the only two controls.
 *
 * Each is `w-full` on its own row rather than the two sharing one. The pair was
 * where the panel overflowed: `SelectTrigger` is `w-fit whitespace-nowrap`, so
 * with `flex-1` and no `min-w-0` a key named after its project set the row's
 * floor and pushed the button past the 26rem both hosts are. Every other
 * `SelectTrigger` in the app is `w-full` on its own row; this is that, rather
 * than a `min-w-0` holding the old shape together.
 */
export const EmbedKeySelect: FC<EmbedKeySelectProps> = ({ api }) => {
	const fieldId = useId()
	if (api.loadError) {
		/*
		  The error replaces the control rather than sitting under it. A member
		  who may open this panel but may not read keys would otherwise get a
		  disabled, empty picker and a create button directly above the 403 saying
		  they are not allowed to know - three affordances narrating access they
		  do not have.

		  With a way back. The request is latched per endpoint by a ref, so a
		  transient 500 or an expired session used to end the panel: the notice
		  stood and nothing on screen could ask again.
		*/
		return (
			<div className="space-y-2">
				<InlineNotice tone="error" className="break-words">
					{api.loadError}
				</InlineNotice>
				{/*
				  Disabled while the request is out. React Router keeps the previous
				  `data` during a re-load, so `loadError` stays set for the whole
				  retry: without this nothing on screen changed, and because each
				  `fetch` aborts the last one, clicking faster than the round trip
				  stopped it ever completing.
				*/}
				<Button
					variant="secondary"
					size="sm"
					className="w-full"
					onClick={api.retry}
					disabled={api.loading}
				>
					<RefreshCw />
					{api.loading ? EMBED_COPY.retryPending : EMBED_COPY.retry}
				</Button>
			</div>
		)
	}

	/*
	  Before an answer, the select renders disabled and says nothing. Zero keys is
	  also what a request in flight and a request never dispatched look like from
	  here, so any claim about the list belongs behind `hasAnswer`.

	  There is deliberately no "this project has no keys yet" line for the case
	  where the list came back empty and this member cannot create one. That state
	  does not exist: `dashboard-operations.ts` gives `api-key:read` and
	  `api-key:create` the same roles, so an answer arriving at all means the
	  Create button is rendered, and the button is the whole next step. The
	  sentence was there for a year and could never have been seen.
	*/
	const hasKeys = !api.hasAnswer || api.keys.length > 0
	const noneUsable =
		api.hasAnswer &&
		api.keys.length > 0 &&
		!api.keys.some((key) => isEmbedKeyUsable(key))

	return (
		<div className="space-y-2">
			{hasKeys && (
				<>
					{/*
					  A real label, associated by `htmlFor`. `aria-label` alone named the
					  control for a screen reader and left a sighted user with the
					  placeholder as its only label - which disappears on selection,
					  leaving a bare `Embed key for Demo ...ab3x` under an "Access"
					  heading. That is the textbook WCAG 3.3.2 failure, and the field
					  this replaced had the mirror-image bug: a visible label with no
					  `htmlFor` tying it to anything.
					*/}
					<Label htmlFor={fieldId}>{EMBED_COPY.keyLabel}</Label>
					<Select
						value={api.selectedKeyId}
						onValueChange={api.selectKey}
						disabled={!api.hasAnswer}
					>
						{/*
						  `block truncate` on the value slot. The primitive clamps it with
						  `line-clamp-1`, which needs a line break to put an ellipsis on
						  and never gets one under the trigger's own `whitespace-nowrap` -
						  so a long key name was hard-clipped mid-character.
						*/}
						<SelectTrigger
							id={fieldId}
							className="w-full *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
						>
							<SelectValue placeholder={EMBED_COPY.keyPickerPlaceholder} />
						</SelectTrigger>
						{/*
						  Capped to the trigger. A popper shrink-to-fits to max-content, and
						  names are capped at 100 characters, so one long key opened a
						  ~890px listbox beside a 416px panel.
						*/}
						<SelectContent className="max-w-(--radix-select-trigger-width)">
							{api.keys.map((option) => {
								const { name, suffix, disabled } = describeKeyOption(option)

								return (
									<SelectItem
										key={option.id}
										value={option.id}
										disabled={disabled}
									>
										{/*
										  Name and reason as separate children, so truncation
										  cannot eat the reason. `truncate` clips from the right,
										  and a key named after a long project removed exactly
										  the `(revoked)` that explains why the row is greyed
										  out - leaving `opacity-50` as the only cue.

										  Wrapped rather than classed on the item, because the
										  truncation has to land on a flex child: the
										  primitive's `ItemText` span is itself `flex`.
										*/}
										<span className="truncate">{name}</span>
										{/*
										  Not muted. `SelectItem` already puts the whole row at
										  `data-[disabled]:opacity-50`, and a second
										  de-emphasis took the reason to 1.84:1 in light mode -
										  half the contrast of the name it qualifies, and the
										  only text in the row that says why it is dead.
										*/}
										{suffix && <span className="shrink-0">({suffix})</span>}
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</>
			)}

			{/*
			  Said once above the list rather than once per row: reaching this state
			  means every row already carries the reason it cannot be used.
			*/}
			{noneUsable && (
				<p className="text-muted-foreground text-xs">
					{EMBED_COPY.keyNoneUsable}
				</p>
			)}

			{/*
			  `default` when it is the only thing to do. With no usable key the
			  toolbar above is three disabled controls, and a disabled `default`
			  button measures 3.3:1 against its surface while this one, as
			  `secondary`, measured 1.09:1 - so the panel's loudest element was the
			  control the user cannot press and its quietest was the only one they
			  can.
			*/}
			{api.canCreateKey && (
				<Button
					variant={api.token ? 'secondary' : 'default'}
					size="sm"
					className="w-full"
					onClick={api.createKey}
					disabled={api.creating}
				>
					{api.creating ? (
						EMBED_COPY.createKeyPending
					) : (
						<>
							<Plus />
							{EMBED_COPY.createKey}
						</>
					)}
				</Button>
			)}

			{/*
			  A fixed sentence, not the server's. The route returns `error.message`
			  for anything that is an `Error`, so this rendered whatever threw -
			  "database is down" from its own spec, or the name of another
			  organization - as user-facing copy. None of those name an action this
			  panel offers, and `break-words` is kept because the sentence still has
			  to survive a narrow host.
			*/}
			{api.createError && (
				<InlineNotice tone="error" className="break-words">
					{EMBED_COPY.createKeyFailure}
				</InlineNotice>
			)}
		</div>
	)
}
