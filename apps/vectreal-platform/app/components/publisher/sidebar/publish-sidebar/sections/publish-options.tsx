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
import { motion } from 'framer-motion'
import { CheckCircle, EyeOff, Globe, Lock } from 'lucide-react'
import { useState } from 'react'

import { itemVariants } from '../../animation'

export const PublishOptions: React.FC = () => {
	const [title, setTitle] = useState('My 3D Scene')
	const [description, setDescription] = useState('')
	const [visibility, setVisibility] = useState('private')
	const [allowDownload, setAllowDownload] = useState(false)
	const [allowComments, setAllowComments] = useState(true)

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
		</motion.div>
	)
}
