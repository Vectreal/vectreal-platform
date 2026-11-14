import { Button } from '@shared/components/ui/button'
import { Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import { useOncePerFetcherResponse } from '../../hooks/use-once-per-fetcher-response'
import {
	intakeAttachmentName,
	isIntakeAttachmentSizeAcceptable,
	MODEL_INTAKE_ATTACHMENT_ACCEPT,
	MODEL_INTAKE_ATTACHMENT_TOO_LARGE_MESSAGE,
	MODEL_INTAKE_MAX_ATTACHMENT_LABEL
} from '../../lib/domain/model-intake/model-intake-shared'
import { ConfirmDestructiveDialog } from '../shared/confirm-destructive-dialog'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

export interface IntakeAttachmentItem {
	name: string
	bytes: number | null
	url: string
}

/** What the intake page's action answers; `uploadUrl` only to `attach-start`. */
export type IntakeAttachmentActionResult =
	{ ok: true; uploadUrl?: string } | { error: string }

const megabytes = (bytes: number) =>
	`${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

/**
 * Sends the file straight to storage with the signed URL, reporting progress:
 * a video of several hundred megabytes takes minutes, and fetch cannot report
 * an upload's progress.
 */
function uploadFile(
	url: string,
	file: File,
	onProgress: (fraction: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest()
		request.open('PUT', url)
		request.setRequestHeader(
			'content-type',
			file.type || 'application/octet-stream'
		)
		request.setRequestHeader('x-upsert', 'false')
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total)
		}
		request.onload = () =>
			request.status >= 200 && request.status < 300
				? resolve()
				: reject(
						new Error(
							/exists|duplicate/i.test(request.responseText)
								? 'A file with this name is already attached.'
								: request.status === 413 || /size/i.test(request.responseText)
									? MODEL_INTAKE_ATTACHMENT_TOO_LARGE_MESSAGE
									: `Upload failed (${request.status}).`
						)
					)
		request.onerror = () => reject(new Error('Upload failed: network error.'))
		request.send(file)
	})
}

/**
 * Files downloaded from a brand's link, kept with its request so the 90-day
 * purge deletes them with it. Staff only, like the page.
 */
export function IntakeAttachments({
	id,
	attachments
}: {
	id: string
	/** Null when storage could not be listed. */
	attachments: IntakeAttachmentItem[] | null
}) {
	const csrf = useAuthenticityToken()
	const startFetcher = useFetcher<IntakeAttachmentActionResult>()
	const revalidator = useRevalidator()
	const inputRef = useRef<HTMLInputElement>(null)
	// The picked file waits here while the action mints its upload URL.
	const pending = useRef<File | null>(null)
	const [progress, setProgress] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)

	useOncePerFetcherResponse(startFetcher, (result) => {
		const file = pending.current
		pending.current = null
		if ('error' in result) {
			setProgress(null)
			setError(result.error)
			return
		}
		if (!file || !result.uploadUrl) return
		uploadFile(result.uploadUrl, file, setProgress)
			.then(() => revalidator.revalidate())
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setProgress(null))
	})

	function pick(file: File | undefined) {
		if (inputRef.current) inputRef.current.value = ''
		if (!file) return
		setError(null)
		if (!intakeAttachmentName(file.name)) {
			setError('This file type cannot be attached.')
			return
		}
		if (!isIntakeAttachmentSizeAcceptable(file.size)) {
			setError(MODEL_INTAKE_ATTACHMENT_TOO_LARGE_MESSAGE)
			return
		}
		pending.current = file
		setProgress(0)
		startFetcher.submit(
			{
				id,
				intent: 'attach-start',
				fileName: file.name,
				fileSize: String(file.size),
				csrf
			},
			{ method: 'post' }
		)
	}

	return (
		<div className="space-y-2">
			{attachments === null ? (
				<p className="text-destructive text-body-sm">
					Attached files could not be listed.
				</p>
			) : attachments.length > 0 ? (
				<ul className="space-y-1">
					{attachments.map((attachment) => (
						<AttachmentRow key={attachment.name} id={id} item={attachment} />
					))}
				</ul>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				<input
					ref={inputRef}
					type="file"
					accept={MODEL_INTAKE_ATTACHMENT_ACCEPT}
					className="sr-only"
					aria-label="File to attach"
					tabIndex={-1}
					disabled={progress !== null}
					onChange={(event) => pick(event.target.files?.[0])}
				/>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={progress !== null}
					onClick={() => inputRef.current?.click()}
				>
					<Paperclip aria-hidden="true" />
					Attach file
				</Button>
				<span className="text-muted-foreground text-body-sm">
					Up to {MODEL_INTAKE_MAX_ATTACHMENT_LABEL}
				</span>
				{progress !== null ? (
					<span role="status" className="text-muted-foreground text-body-sm">
						Uploading {Math.round(progress * 100)}%
					</span>
				) : null}
				{error ? (
					<span role="alert" className="text-destructive text-body-sm">
						{error}
					</span>
				) : null}
			</div>
		</div>
	)
}

function AttachmentRow({
	id,
	item
}: {
	id: string
	item: IntakeAttachmentItem
}) {
	const csrf = useAuthenticityToken()
	const deleteFetcher = useFetcher<IntakeAttachmentActionResult>()
	const [confirm, setConfirm] = useState(false)

	const plan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: `Delete ${item.name}?`,
		description: 'The attached file is removed from this request now.',
		consequences: ['This cannot be undone'],
		confirmLabel: 'Delete file',
		token: null
	}

	return (
		<li className="text-body-sm flex flex-wrap items-center gap-x-3 gap-y-1">
			<a
				href={item.url}
				download={item.name}
				className="max-w-full truncate underline underline-offset-4"
			>
				{item.name}
			</a>
			{item.bytes !== null ? (
				<span className="text-muted-foreground">{megabytes(item.bytes)}</span>
			) : null}
			<Button
				type="button"
				size="sm"
				variant="ghost"
				onClick={() => setConfirm(true)}
			>
				Delete
			</Button>
			<ConfirmDestructiveDialog
				open={confirm}
				onOpenChange={setConfirm}
				plan={plan}
				isPending={deleteFetcher.state !== 'idle'}
				errorMessage={
					deleteFetcher.data && 'error' in deleteFetcher.data
						? deleteFetcher.data.error
						: null
				}
				onConfirm={() =>
					deleteFetcher.submit(
						{ id, intent: 'attach-delete', name: item.name, csrf },
						{ method: 'post' }
					)
				}
			/>
		</li>
	)
}
