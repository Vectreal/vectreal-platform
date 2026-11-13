import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@shared/components/ui/table'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
import {
	AuthenticityTokenInput,
	useAuthenticityToken
} from 'remix-utils/csrf/react'

import { Route } from './+types/intake'
import {
	DetailPanelSection,
	EmptyState
} from '../../components/layout-components'
import {
	IntakeAttachments,
	type IntakeAttachmentActionResult
} from '../../components/model-intake/intake-attachments'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { MODEL_INTAKE_COPY } from '../../constants/product-copy'
import { requireIntakeAdmin } from '../../lib/domain/model-intake/model-intake-admin.server'
import { deleteIntakeById } from '../../lib/domain/model-intake/model-intake-deletion.server'
import {
	findIntakeForDeletion,
	finishIntakeCleanup,
	listIntakeLetters,
	listIntakeSubmissions,
	summarizeIntakeLetters,
	markIntakeDelivered,
	markIntakePilotBooked,
	setIntakeCleanupLog,
	startIntakeCleanup
} from '../../lib/domain/model-intake/model-intake-repository.server'
import {
	intakeAttachmentName,
	intakeRequestsByLetter,
	isIntakeAttachmentSizeAcceptable,
	isIntakeProductType,
	MODEL_INTAKE_OUTCOMES,
	type ModelIntakeOutcome,
	type ModelIntakeStatus
} from '../../lib/domain/model-intake/model-intake-shared'
import {
	createIntakeAttachmentUpload,
	deleteIntakeAttachment,
	listIntakeAttachments,
	MODEL_INTAKE_PAGE_LINK_SECONDS,
	signIntakePhotoUrls
} from '../../lib/domain/model-intake/model-intake-storage.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { decryptSensitiveValue } from '../../lib/security/pii-encryption.server'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

/*
  The free-model requests, for the team making the models. Internal: behind
  the `model-intake-admin` flag, English only, and it never shows the brand's
  name, email, company or message, which stay encrypted. The notification
  email carried those to the inbox; this page carries the work: the link and
  photos, the cleanup clock, the outcome and the retention date.
*/

/**
 * One request's link, or `unreadable` when it was written under another key:
 * one such row must not take the whole page, and every other request, down.
 */
function readLink(stored: string): string | 'unreadable' {
	try {
		return decryptSensitiveValue(stored)
	} catch {
		return 'unreadable'
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireIntakeAdmin(request)
	const [rows, letters, letterRows] = await Promise.all([
		listIntakeSubmissions(),
		summarizeIntakeLetters(),
		listIntakeLetters()
	])
	const requests = await Promise.all(
		rows.map(async ({ link, ...row }) => ({
			...row,
			link: link ? readLink(link) : null,
			photoUrls: await signIntakePhotoUrls(
				row.photoPaths,
				MODEL_INTAKE_PAGE_LINK_SECONDS
			).catch(() => []),
			attachments: await listIntakeAttachments(
				row.id,
				MODEL_INTAKE_PAGE_LINK_SECONDS
			).catch(() => null)
		}))
	)
	const perBatch = new Map<string, number>()
	for (const row of rows) {
		const source = row.letterCode ? 'letters' : row.batch
		perBatch.set(source, (perBatch.get(source) ?? 0) + 1)
	}
	const requestsByLetter = intakeRequestsByLetter(rows)
	const letterList = letterRows.map((letter) => ({
		...letter,
		requests: (requestsByLetter.get(letter.code) ?? []).map(
			(row) => row.referenceCode
		)
	}))
	return data({
		requests,
		perBatch: [...perBatch.entries()],
		letters,
		letterList
	})
}

type IntakeActionResult = IntakeAttachmentActionResult

/**
 * Mints the URL the browser uploads one attachment to, after the same checks
 * the browser made: the request exists, the type is allowed, the declared
 * size is under the cap. Storage then holds the upload to the bucket.
 */
async function startAttachment(id: string, formData: FormData) {
	const name = intakeAttachmentName(String(formData.get('fileName') ?? ''))
	if (!name) {
		return data<IntakeActionResult>(
			{ error: 'This file type cannot be attached.' },
			{ status: 400 }
		)
	}
	if (!isIntakeAttachmentSizeAcceptable(Number(formData.get('fileSize')))) {
		return data<IntakeActionResult>(
			{ error: 'This file is too large to attach.' },
			{ status: 400 }
		)
	}
	// The stored id names the folder: storage keys are case-sensitive where a uuid match is not.
	const row = await findIntakeForDeletion(id)
	if (!row) {
		return data<IntakeActionResult>(
			{ error: 'Request not found.' },
			{ status: 404 }
		)
	}
	try {
		const uploadUrl = await createIntakeAttachmentUpload(row.id, name)
		return uploadUrl === 'exists'
			? data<IntakeActionResult>(
					{ error: `${name} is already attached.` },
					{ status: 409 }
				)
			: data<IntakeActionResult>({ ok: true, uploadUrl })
	} catch {
		return data<IntakeActionResult>(
			{ error: 'An upload could not be prepared. Try again.' },
			{ status: 500 }
		)
	}
}

/** Only a stored name is accepted, so the path cannot leave the request's folder. */
async function removeAttachment(id: string, formData: FormData) {
	const raw = String(formData.get('name') ?? '')
	if (raw === '' || intakeAttachmentName(raw) !== raw) {
		return data<IntakeActionResult>({ error: 'No such file.' }, { status: 400 })
	}
	// The stored id names the folder: storage keys are case-sensitive where a uuid match is not.
	const row = await findIntakeForDeletion(id)
	if (!row) {
		return data<IntakeActionResult>(
			{ error: 'Request not found.' },
			{ status: 404 }
		)
	}
	try {
		await deleteIntakeAttachment(row.id, raw)
	} catch {
		return data<IntakeActionResult>(
			{ error: 'The file could not be deleted. Try again.' },
			{ status: 500 }
		)
	}
	return data<IntakeActionResult>({ ok: true })
}

export async function action({ request }: Route.ActionArgs) {
	// The gate first, so anyone it refuses gets the same 404 as the loader
	// rather than a CSRF 403 that confirms the page exists.
	await requireIntakeAdmin(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const id = formData.get('id')
	if (typeof id !== 'string' || id === '') {
		return data<IntakeActionResult>(
			{ error: 'No request named.' },
			{ status: 400 }
		)
	}

	const now = new Date()
	const intent = formData.get('intent')
	if (intent === 'attach-start') return startAttachment(id, formData)
	if (intent === 'attach-delete') return removeAttachment(id, formData)
	let found: boolean | 'not_started'
	switch (intent) {
		case 'start-cleanup':
			found = await startIntakeCleanup(id, now)
			break
		case 'stop-cleanup':
			found = await finishIntakeCleanup(id, now)
			break
		case 'log': {
			const rawMinutes = String(formData.get('cleanupMinutes') ?? '').trim()
			const minutes = rawMinutes === '' ? null : Number(rawMinutes)
			const rawOutcome = formData.get('outcome')
			const outcome = MODEL_INTAKE_OUTCOMES.includes(
				rawOutcome as ModelIntakeOutcome
			)
				? (rawOutcome as ModelIntakeOutcome)
				: null
			if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) {
				return data<IntakeActionResult>(
					{ error: 'Minutes must be a whole number.' },
					{ status: 400 }
				)
			}
			found = await setIntakeCleanupLog(id, {
				cleanupMinutes: minutes,
				outcome
			})
			break
		}
		case 'delivered':
			found = await markIntakeDelivered(id, now)
			break
		case 'pilot-booked':
			found = await markIntakePilotBooked(id)
			break
		case 'delete':
			found = await deleteIntakeById(id)
			break
		default:
			return data<IntakeActionResult>(
				{ error: 'Unknown action.' },
				{ status: 400 }
			)
	}

	if (found === 'not_started') {
		return data<IntakeActionResult>(
			{ error: 'Start cleanup first.' },
			{ status: 409 }
		)
	}
	return found
		? data<IntakeActionResult>({ ok: true })
		: data<IntakeActionResult>({ error: 'Request not found.' }, { status: 404 })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const STATUS_LABEL: Record<ModelIntakeStatus, string> = {
	received: 'New',
	in_cleanup: 'In cleanup',
	delivered: 'Delivered',
	pilot_booked: 'Pilot booked'
}

// A fixed zone, so the server's render and the browser's hydration agree.
const dateTime = new Intl.DateTimeFormat('en-GB', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'Europe/Berlin'
})
const dateOnly = new Intl.DateTimeFormat('en-GB', {
	dateStyle: 'medium',
	timeZone: 'Europe/Berlin'
})

type IntakeRequest = Route.ComponentProps['loaderData']['requests'][number]

function describeSize(row: IntakeRequest): string {
	const parts = [row.heightCm, row.widthCm, row.depthCm]
	return parts.every((part) => part === null)
		? 'No size'
		: parts.map((part) => (part === null ? '?' : `${part}`)).join(' x ') + ' cm'
}

function IntakeActionButton({
	id,
	intent,
	label,
	variant = 'outline'
}: {
	id: string
	intent: string
	label: string
	variant?: 'outline' | 'default'
}) {
	const fetcher = useFetcher<IntakeActionResult>()
	return (
		<fetcher.Form method="post" className="flex items-center gap-2">
			<AuthenticityTokenInput />
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="intent" value={intent} />
			<Button
				type="submit"
				size="sm"
				variant={variant}
				disabled={fetcher.state !== 'idle'}
			>
				{label}
			</Button>
			{fetcher.data && 'error' in fetcher.data ? (
				<span role="alert" className="text-destructive text-body-sm">
					{fetcher.data.error}
				</span>
			) : null}
		</fetcher.Form>
	)
}

/** Where a letter in the letters list links to the request it led to. */
const requestAnchor = (referenceCode: string) => `request-${referenceCode}`

type IntakeLetterRow = Route.ComponentProps['loaderData']['letterList'][number]

/** Each posted letter: whom it went to, whether its code was scanned, and whether a request came. */
function LettersTable({ letters }: { letters: IntakeLetterRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Code</TableHead>
					<TableHead>Organization</TableHead>
					<TableHead>Audience</TableHead>
					<TableHead>Scans</TableHead>
					<TableHead>Request</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{letters.map((letter) => (
					<TableRow key={letter.code}>
						<TableCell className="font-mono">{letter.code}</TableCell>
						<TableCell>{letter.organization}</TableCell>
						<TableCell>{letter.audience}</TableCell>
						<TableCell>
							{letter.scans === 0
								? 'Not scanned'
								: `${letter.scans} · last ${dateTime.format(new Date(letter.lastScanAt ?? 0))}`}
						</TableCell>
						<TableCell>
							{letter.requests.length === 0
								? 'None'
								: letter.requests.map((referenceCode, index) => (
										<span key={referenceCode}>
											{index > 0 ? ', ' : null}
											<a
												href={`#${requestAnchor(referenceCode)}`}
												className="underline underline-offset-4"
											>
												{referenceCode}
											</a>
										</span>
									))}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

function IntakeRow({ row }: { row: IntakeRequest }) {
	const logFetcher = useFetcher<IntakeActionResult>()
	const deleteFetcher = useFetcher<IntakeActionResult>()
	const csrfToken = useAuthenticityToken()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const productType = isIntakeProductType(row.productType)
		? MODEL_INTAKE_COPY.en.fields.productType.options[row.productType]
		: row.productType

	const deletePlan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: `Delete ${row.referenceCode}?`,
		description:
			'The request, its photos and its attached files are removed now.',
		consequences: ['This cannot be undone'],
		confirmLabel: 'Delete request',
		token: null
	}

	return (
		<li
			id={requestAnchor(row.referenceCode)}
			className="ds-raised scroll-mt-4 space-y-4 rounded-2xl p-5"
		>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="text-body font-medium">{row.referenceCode}</span>
				<Badge variant="secondary">{STATUS_LABEL[row.status]}</Badge>
				{row.productType === 'other' ? <Badge>Review first</Badge> : null}
				{row.emailStatus !== 'sent' ? (
					<Badge variant="destructive">Email {row.emailStatus}</Badge>
				) : null}
			</div>
			<p className="text-muted-foreground text-body-sm">
				{productType} · {describeSize(row)} ·{' '}
				{/* A letter names its source; "batch direct" beside it read as a contradiction. */}
				{row.letterCode
					? `letter ${row.letterCode} (${row.letterOrganization}) · `
					: `batch ${row.batch} · `}
				{row.locale} · received {dateTime.format(new Date(row.createdAt))}
			</p>
			{row.consentClientAt ? (
				<p className="text-muted-foreground text-body-sm">
					Agency confirmed its client&apos;s OK{' '}
					{dateTime.format(new Date(row.consentClientAt))}
				</p>
			) : null}

			<div className="flex flex-wrap gap-3">
				{row.link === 'unreadable' ? (
					<span className="text-destructive text-body-sm">
						Link stored but unreadable with this key
					</span>
				) : row.link ? (
					<a
						href={row.link}
						target="_blank"
						rel="noreferrer"
						className="text-body-sm max-w-full truncate underline underline-offset-4"
					>
						{row.link}
					</a>
				) : null}
				{row.photoUrls.map((url, index) => (
					<a
						key={url || index}
						href={url}
						target="_blank"
						rel="noreferrer"
						className="text-body-sm underline underline-offset-4"
					>
						Photo {index + 1}
					</a>
				))}
			</div>
			<IntakeAttachments id={row.id} attachments={row.attachments} />

			<div className="flex flex-wrap items-center gap-2">
				<IntakeActionButton
					id={row.id}
					intent="start-cleanup"
					label="Start cleanup"
				/>
				<IntakeActionButton
					id={row.id}
					intent="stop-cleanup"
					label="Stop cleanup"
				/>
				<span className="text-muted-foreground text-body-sm">
					{row.cleanupStartedAt
						? `Started ${dateTime.format(new Date(row.cleanupStartedAt))}`
						: 'Not started'}
					{row.cleanupFinishedAt
						? `, stopped ${dateTime.format(new Date(row.cleanupFinishedAt))}`
						: ''}
				</span>
			</div>

			<logFetcher.Form method="post" className="flex flex-wrap items-end gap-3">
				<AuthenticityTokenInput />
				<input type="hidden" name="id" value={row.id} />
				<input type="hidden" name="intent" value="log" />
				<label className="space-y-1.5">
					<span className="text-label-xs block">Cleanup minutes</span>
					<Input
						name="cleanupMinutes"
						inputMode="numeric"
						defaultValue={row.cleanupMinutes ?? ''}
						key={row.cleanupMinutes ?? 'none'}
						className="w-28"
					/>
				</label>
				<label className="space-y-1.5">
					<span className="text-label-xs block">Outcome</span>
					<select
						name="outcome"
						defaultValue={row.outcome ?? ''}
						key={row.outcome ?? 'none'}
						className="ds-field text-body-sm h-9 rounded-md px-3"
					>
						<option value="">Not judged</option>
						<option value="usable">Usable</option>
						<option value="unusable">Not usable</option>
					</select>
				</label>
				<Button type="submit" size="sm" disabled={logFetcher.state !== 'idle'}>
					Save
				</Button>
				{logFetcher.data && 'error' in logFetcher.data ? (
					<span className="text-destructive text-body-sm">
						{logFetcher.data.error}
					</span>
				) : null}
			</logFetcher.Form>

			<div className="flex flex-wrap items-center gap-2">
				<IntakeActionButton
					id={row.id}
					intent="delivered"
					label="Mark delivered"
				/>
				<IntakeActionButton
					id={row.id}
					intent="pilot-booked"
					label="Mark pilot booked"
				/>
				<Button
					type="button"
					size="sm"
					variant="destructive"
					onClick={() => setConfirmDelete(true)}
				>
					Delete now
				</Button>
				<span className="text-muted-foreground text-body-sm">
					{row.deleteAfter
						? `Deleted after ${dateOnly.format(new Date(row.deleteAfter))}`
						: 'Kept: the pilot agreement governs'}
				</span>
			</div>

			<ConfirmDestructiveDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				plan={deletePlan}
				isPending={deleteFetcher.state !== 'idle'}
				errorMessage={
					deleteFetcher.data && 'error' in deleteFetcher.data
						? deleteFetcher.data.error
						: null
				}
				onConfirm={() =>
					deleteFetcher.submit(
						{ id: row.id, intent: 'delete', csrf: csrfToken },
						{ method: 'post' }
					)
				}
			/>
		</li>
	)
}

export default function IntakePage({ loaderData }: Route.ComponentProps) {
	const { requests, perBatch, letters, letterList } = loaderData

	return (
		<div className="space-y-6">
			<DetailPanelSection title="Free-model requests">
				<p className="text-muted-foreground text-body-sm">
					{perBatch.length > 0
						? perBatch.map(([batch, count]) => `${batch}: ${count}`).join(' · ')
						: 'No requests yet.'}
				</p>
				{letters.posted > 0 ? (
					<p className="text-muted-foreground text-body-sm">
						Letters: {letters.posted} registered · {letters.scanned} scanned ·{' '}
						{letters.replied} replied
					</p>
				) : null}
			</DetailPanelSection>
			{letterList.length > 0 ? (
				<DetailPanelSection title="Letters">
					<LettersTable letters={letterList} />
				</DetailPanelSection>
			) : null}
			{requests.length === 0 ? (
				<EmptyState
					icon={Inbox}
					title="No requests yet"
					description="Requests sent through /free-model appear here."
				/>
			) : (
				<ul className="space-y-4">
					{requests.map((row) => (
						<IntakeRow key={row.id} row={row} />
					))}
				</ul>
			)}
		</div>
	)
}
