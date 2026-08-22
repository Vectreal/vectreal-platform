import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Eye, EyeOff, KeyRound, Plus } from 'lucide-react'
import { useState, type FC } from 'react'

import { EmbedCreatedKeyDialog } from './embed-created-key-dialog'
import {
	matchesKeyPreview,
	type EmbedApiKeyOption
} from '../../lib/domain/embed/embed-key-options'
import { EMBED_COPY } from '../../lib/domain/embed/embed-snippet'
import { InfoTooltip } from '../info-tooltip'
import { InlineNotice } from '../layout-components'

import type { EmbedApiKeysApi } from './use-embed-api-keys'

/** `name ...ab3x (expired)` - enough to recognize a key you saved elsewhere. */
function describeKey(option: EmbedApiKeyOption): string {
	const suffix = option.revoked
		? ` (${EMBED_COPY.keyRevokedSuffix})`
		: option.expired
			? ` (${EMBED_COPY.keyExpiredSuffix})`
			: ''

	return `${option.name} ...${option.keyPreview}${suffix}`
}

interface EmbedKeyFieldProps {
	api: EmbedApiKeysApi
}

export const EmbedKeyField: FC<EmbedKeyFieldProps> = ({ api }) => {
	const [revealed, setRevealed] = useState(false)

	const selectedKey = api.keys.find((key) => key.id === api.selectedKeyId)
	const previewMismatch = Boolean(
		selectedKey &&
			api.token.trim() &&
			!matchesKeyPreview(api.token, selectedKey.keyPreview)
	)

	return (
		<div className="space-y-2">
			{!api.token && (
				<InlineNotice>{EMBED_COPY.tokenMissingNotice}</InlineNotice>
			)}

			<div className="flex items-center gap-2">
				<Label htmlFor="embed-token" className="text-sm">
					{EMBED_COPY.tokenLabel}
				</Label>
				<InfoTooltip content={EMBED_COPY.tokenHelp} />
			</div>

			<div className="ph-no-capture flex items-center gap-2">
				<Input
					id="embed-token"
					type={revealed ? 'text' : 'password'}
					autoComplete="off"
					spellCheck={false}
					value={api.token}
					onChange={(event) => api.setToken(event.target.value)}
					placeholder={EMBED_COPY.tokenPlaceholder}
				/>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setRevealed((current) => !current)}
					title={revealed ? EMBED_COPY.tokenHide : EMBED_COPY.tokenReveal}
					aria-label={revealed ? EMBED_COPY.tokenHide : EMBED_COPY.tokenReveal}
				>
					{revealed ? (
						<EyeOff className="h-3.5 w-3.5" />
					) : (
						<Eye className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>

			{previewMismatch && (
				<p className="text-warning-foreground text-xs">
					{EMBED_COPY.tokenMismatch}
				</p>
			)}

			<div className="flex items-center gap-2">
				<Label className="text-sm">{EMBED_COPY.keyPickerLabel}</Label>
				<InfoTooltip content={EMBED_COPY.keyPickerHint} />
			</div>

			<div className="flex items-center gap-2">
				<Select
					value={api.selectedKeyId}
					onValueChange={api.selectKey}
					disabled={api.keys.length === 0}
				>
					<SelectTrigger className="flex-1">
						<SelectValue placeholder={EMBED_COPY.keyPickerPlaceholder} />
					</SelectTrigger>
					<SelectContent>
						{api.keys.map((option) => (
							<SelectItem key={option.id} value={option.id}>
								{describeKey(option)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{api.canCreateKey && (
					<Button
						variant="secondary"
						size="sm"
						onClick={api.createKey}
						disabled={api.creating}
						title={EMBED_COPY.createKey}
					>
						{api.creating ? (
							EMBED_COPY.createKeyPending
						) : (
							<>
								<Plus className="mr-1 h-3.5 w-3.5" />
								<KeyRound className="mr-1 h-3.5 w-3.5" />
								{EMBED_COPY.createKeyShort}
							</>
						)}
					</Button>
				)}
			</div>

			{/*
			  Only once an answer is in. Zero keys is what a project with none, a
			  request still in flight, a request never dispatched, and a refused
			  request all look like from here - and a member who may open this
			  panel but may not read keys would otherwise be told the project has
			  none, directly above the 403 saying they are not allowed to know.
			*/}
			{api.keys.length === 0 && api.hasLoaded && !api.loadError && (
				<p className="text-muted-foreground text-xs">
					{EMBED_COPY.keyPickerEmpty}
				</p>
			)}

			{api.loadError && (
				<InlineNotice tone="error">{api.loadError}</InlineNotice>
			)}
			{api.createError && (
				<InlineNotice tone="error">
					{EMBED_COPY.createKeyFailure} {api.createError}
				</InlineNotice>
			)}

			<EmbedCreatedKeyDialog
				plaintext={api.createdPlaintext}
				expiresAt={api.createdKeyExpiresAt}
				onDismiss={api.dismissCreatedKey}
			/>
		</div>
	)
}
