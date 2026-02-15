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
import { Switch } from '@shared/components/ui/switch'
import { Textarea } from '@shared/components/ui/textarea'
import { ModelExporter } from '@vctrl/core'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { CheckCircle, EyeOff, Globe, Lock } from 'lucide-react'
import { useCallback, useRef, useState, type FC } from 'react'
import { toast } from 'sonner'

import { itemVariants } from '../../animation'

interface PublishOptionsProps {
	sceneId?: string
}

export const PublishOptions: FC<PublishOptionsProps> = ({ sceneId }) => {
	const [title, setTitle] = useState('My 3D Scene')
	const [description, setDescription] = useState('')
	const [visibility, setVisibility] = useState('private')
	const [allowDownload, setAllowDownload] = useState(false)
	const [allowComments, setAllowComments] = useState(true)
	const [isPublishing, setIsPublishing] = useState(false)
	const { optimizer, file } = useModelContext(true)
	const exporterRef = useRef<ModelExporter>(new ModelExporter())

	const handlePublish = useCallback(async () => {
		if (!sceneId) {
			toast.error('Save the scene before publishing.')
			return
		}

		const document = optimizer?._getDocument?.()
		if (!document) {
			toast.error('Model not loaded or optimization failed.')
			return
		}

		setIsPublishing(true)
		try {
			const result = await exporterRef.current.exportDocumentGLB(document)
			const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'scene'
			const payload = {
				data: Array.from(result.data),
				fileName: `${baseName}.glb`,
				mimeType: 'model/gltf-binary'
			}

			const formData = new FormData()
			formData.append('action', 'publish-scene')
			formData.append('sceneId', sceneId)
			formData.append('publishedGlb', JSON.stringify(payload))

			const response = await fetch('/api/scene-settings', {
				method: 'POST',
				body: formData
			})

			const resultData = await response.json()
			if (!response.ok || resultData.error) {
				throw new Error(
					resultData.error || `HTTP error! status: ${response.status}`
				)
			}

			window.dispatchEvent(
				new CustomEvent('scene-stats-updated', {
					detail: { sceneId }
				})
			)
			toast.success('Scene published successfully.')
		} catch (error) {
			console.error('Failed to publish scene:', error)
			toast.error(
				error instanceof Error ? error.message : 'Failed to publish scene'
			)
		} finally {
			setIsPublishing(false)
		}
	}, [sceneId, optimizer, file])

	return (
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Configure how your scene will be published to the platform
			</div>

			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title" className="text-sm">
						Scene Title
					</Label>
					<Input
						id="title"
						placeholder="Enter scene title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description" className="text-sm">
						Description
					</Label>
					<Textarea
						id="description"
						placeholder="Describe your 3D scene..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="h-20 resize-none"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="visibility" className="text-sm">
						Visibility
					</Label>
					<Select value={visibility} onValueChange={setVisibility}>
						<SelectTrigger id="visibility" className="w-full">
							<SelectValue placeholder="Select visibility" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="public">
								<div className="flex items-center">
									<Globe className="mr-2 h-4 w-4" />
									Public
								</div>
							</SelectItem>
							<SelectItem value="unlisted">
								<div className="flex items-center">
									<EyeOff className="mr-2 h-4 w-4" />
									Unlisted
								</div>
							</SelectItem>
							<SelectItem value="private">
								<div className="flex items-center">
									<Lock className="mr-2 h-4 w-4" />
									Private
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{visibility === 'public' && 'Anyone can view your scene'}
						{visibility === 'unlisted' && 'Only people with the link can view'}
						{visibility === 'private' && 'Only you can view this scene'}
					</p>
				</div>

				<div className="space-y-3 pt-2">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="allow-download" className="text-sm">
								Allow Downloads
							</Label>
							<p className="text-muted-foreground text-xs">
								Let viewers download your scene
							</p>
						</div>
						<Switch
							id="allow-download"
							checked={allowDownload}
							onCheckedChange={setAllowDownload}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="allow-comments" className="text-sm">
								Allow Comments
							</Label>
							<p className="text-muted-foreground text-xs">
								Enable commenting on your scene
							</p>
						</div>
						<Switch
							id="allow-comments"
							checked={allowComments}
							onCheckedChange={setAllowComments}
						/>
					</div>
				</div>
			</div>

			<div className="flex items-center rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
				<CheckCircle className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
				<p className="text-xs text-green-700 dark:text-green-400">
					Your scene is optimized and ready to be published.
				</p>
			</div>

			<Button
				variant="default"
				className="w-full"
				onClick={handlePublish}
				disabled={isPublishing}
			>
				{isPublishing ? 'Publishing...' : 'Publish Scene'}
			</Button>
		</motion.div>
	)
}
