import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@shared/components/ui/alert-dialog'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { formatFileSize } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'

import type { ScenePublishStateResponse } from '../../types/api'

type MutationEnvelope = {
	success?: boolean
	error?: string
	data?: {
		sceneId?: string
		status?: 'draft' | 'published'
		revoked?: boolean
	}
}

interface ScenePublishStateControlProps {
	publishState: ScenePublishStateResponse
	onPublish: () =>
		| Promise<ScenePublishStateResponse | void>
		| ScenePublishStateResponse
		| void
	publishButtonText?: string
	publishDialogTitle?: string
	publishDialogDescription?: string
	revokeDialogTitle?: string
	revokeDialogDescription?: string
	isPublishActionPending?: boolean
	isPublishActionDisabled?: boolean
	publishDisabledReason?: string
	draftActionMode?: 'confirm' | 'immediate'
	onStateChange?: (nextState: ScenePublishStateResponse) => void
	className?: string
}

export function ScenePublishStateControl({
	publishState,
	onPublish,
	publishButtonText = 'Publish Scene',
	publishDialogTitle = 'Publish Scene?',
	publishDialogDescription = 'This will create or update the published GLB asset for this scene.',
	revokeDialogTitle = 'Revoke publication?',
	revokeDialogDescription = 'This removes the published asset and sets this scene back to draft.',
	isPublishActionPending = false,
	isPublishActionDisabled = false,
	publishDisabledReason,
	draftActionMode = 'confirm',
	onStateChange,
	className
}: ScenePublishStateControlProps) {
	const sceneId = publishState.sceneId
	const revokeFetcher = useFetcher<MutationEnvelope>({
		key: `scene-publish-revoke-${sceneId}`
	})
	const [optimisticState, setOptimisticState] =
		useState<ScenePublishStateResponse | null>(null)
	const [publishDialogOpen, setPublishDialogOpen] = useState(false)
	const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
	const [isRunningPublishAction, setIsRunningPublishAction] = useState(false)
	const handledRevokeResponseRef = useRef<string | null>(null)
	const {
		submit: submitRevoke,
		state: revokeFetcherState,
		data: revokeFetcherData
	} = revokeFetcher

	useEffect(() => {
		setOptimisticState(null)
	}, [
		publishState.sceneId,
		publishState.status,
		publishState.publishedAt,
		publishState.publishedAssetId,
		publishState.publishedAssetSizeBytes
	])

	useEffect(() => {
		if (revokeFetcherState !== 'idle' || !revokeFetcherData) {
			return
		}

		const signature = JSON.stringify(revokeFetcherData)
		if (handledRevokeResponseRef.current === signature) {
			return
		}
		handledRevokeResponseRef.current = signature

		if (revokeFetcherData.success === false) {
			toast.error(revokeFetcherData.error || 'Failed to revoke publication')
			return
		}

		const nextState: ScenePublishStateResponse = {
			sceneId,
			status: 'draft',
			publishedAt: null,
			publishedAssetId: null,
			publishedAssetSizeBytes: null
		}

		setOptimisticState(nextState)
		onStateChange?.(nextState)
		setRevokeDialogOpen(false)
		toast.success('Scene publication revoked')
	}, [revokeFetcherState, revokeFetcherData, sceneId, onStateChange])

	const effectivePublishState = optimisticState ?? publishState

	const isPublished = effectivePublishState.status === 'published'
	const isMutationBusy =
		revokeFetcherState !== 'idle' ||
		isRunningPublishAction ||
		isPublishActionPending
	const canPublish = !isPublishActionDisabled && !isMutationBusy

	const statusLabel = isPublished ? 'Published' : 'Draft'
	const publishedAtText = useMemo(() => {
		if (!effectivePublishState.publishedAt) {
			return 'Not published yet'
		}

		const date = new Date(effectivePublishState.publishedAt)
		if (Number.isNaN(date.getTime())) {
			return 'Not published yet'
		}

		return date.toLocaleString()
	}, [effectivePublishState.publishedAt])

	const handleConfirmPublish = useCallback(async () => {
		if (!canPublish) {
			return
		}

		setIsRunningPublishAction(true)
		try {
			const result = await onPublish()
			if (result) {
				setOptimisticState(result)
				onStateChange?.(result)
			}
			setPublishDialogOpen(false)
		} finally {
			setIsRunningPublishAction(false)
		}
	}, [canPublish, onPublish, onStateChange])

	const handleConfirmRevoke = useCallback(() => {
		if (isMutationBusy) {
			return
		}

		const formData = new FormData()
		formData.append('action', 'revoke-scene-publish')
		formData.append('sceneId', sceneId)
		submitRevoke(formData, {
			method: 'post',
			action: `/api/scenes/${sceneId}`
		})
	}, [isMutationBusy, sceneId, submitRevoke])

	const handleDraftAction = useCallback(() => {
		if (draftActionMode === 'immediate') {
			void handleConfirmPublish()
			return
		}

		setPublishDialogOpen(true)
	}, [draftActionMode, handleConfirmPublish])

	return (
		<motion.div
			layout
			className={className ?? 'space-y-3'}
			transition={{ duration: 0.2, ease: 'easeOut' }}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="space-y-1">
					<p className="text-muted-foreground text-xs">{publishedAtText}</p>
				</div>
				<Badge variant={isPublished ? 'default' : 'secondary'}>
					{statusLabel}
				</Badge>
			</div>

			<AnimatePresence mode="wait" initial={false}>
				{isPublished && (
					<motion.p
						key="published-size"
						initial={{ opacity: 0, y: -2 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -2 }}
						className="text-muted-foreground text-xs"
					>
						Published GLB size:{' '}
						{typeof effectivePublishState.publishedAssetSizeBytes === 'number'
							? formatFileSize(effectivePublishState.publishedAssetSizeBytes)
							: '—'}
					</motion.p>
				)}
			</AnimatePresence>

			<div className="flex flex-col gap-2">
				<Button
					type="button"
					onClick={() =>
						isPublished ? setRevokeDialogOpen(true) : handleDraftAction()
					}
					disabled={isMutationBusy || (!isPublished && isPublishActionDisabled)}
					variant={isPublished ? 'outline' : 'default'}
					className="w-full"
				>
					{isMutationBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isPublished ? 'Revoke publication' : publishButtonText}
				</Button>
				{!isPublished && publishDisabledReason && (
					<p className="text-muted-foreground text-xs">
						{publishDisabledReason}
					</p>
				)}
			</div>

			{draftActionMode === 'confirm' && (
				<AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{publishDialogTitle}</AlertDialogTitle>
							<AlertDialogDescription>
								{publishDialogDescription}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => void handleConfirmPublish()}
								disabled={!canPublish}
							>
								{isRunningPublishAction || isPublishActionPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Publishing...
									</>
								) : (
									'Confirm publish'
								)}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			<AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{revokeDialogTitle}</AlertDialogTitle>
						<AlertDialogDescription>
							{revokeDialogDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmRevoke}
							disabled={isMutationBusy || !sceneId}
						>
							{revokeFetcherState !== 'idle' ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Revoking...
								</>
							) : (
								'Revoke publication'
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</motion.div>
	)
}
