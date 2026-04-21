import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { motion } from 'framer-motion'
import { Clipboard, Link2, Mail, QrCode, X } from 'lucide-react'
import { useState, type FC } from 'react'

import { itemVariants } from '../../animation'

const FacebookIcon: FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
	</svg>
)

const LinkedinIcon: FC<{ className?: string }> = ({ className }) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
	</svg>
)

export const ShareOptions: FC = () => {
	const [shareLink, setShareLink] = useState(
		'https://example.com/view/scene-id'
	)
	const [copied, setCopied] = useState(false)

	const handleCopyLink = () => {
		navigator.clipboard
			.writeText(shareLink)
			.then(() => {
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			})
			.catch((err) => {
				console.error('Failed to copy link: ', err)
			})
	}

	const socialButtons = [
		{
			icon: <X className="h-4 w-4" />,
			label: 'Twitter',
			color: 'bg-[#1DA1F2] hover:bg-[#1DA1F2]/90'
		},
		{
			icon: <FacebookIcon className="h-4 w-4" />,
			label: 'Facebook',
			color: 'bg-[#1877F2] hover:bg-[#1877F2]/90'
		},
		{
			icon: <LinkedinIcon className="h-4 w-4" />,
			label: 'LinkedIn',
			color: 'bg-[#0A66C2] hover:bg-[#0A66C2]/90'
		},
		{
			icon: <Mail className="h-4 w-4" />,
			label: 'Email',
			color: 'bg-zinc-700 hover:bg-zinc-700/90'
		}
	]

	return (
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Share your 3D scene with others through various channels
			</div>

			<div className="space-y-2">
				<Label className="text-sm">Share Link</Label>
				<div className="flex gap-2">
					<Input
						value={shareLink}
						onChange={(e) => setShareLink(e.target.value)}
						className="flex-1"
					/>
					<Button variant="outline" size="icon" onClick={handleCopyLink}>
						{copied ? (
							<Clipboard className="text-success h-4 w-4" />
						) : (
							<Link2 className="h-4 w-4" />
						)}
					</Button>
				</div>
				{copied && (
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="text-success mt-1 text-xs"
					>
						Link copied to clipboard!
					</motion.p>
				)}
			</div>

			<Separator className="my-4" />

			<div className="space-y-3">
				<Label className="text-sm">Share on Social Media</Label>
				<div className="grid grid-cols-2 gap-2">
					{socialButtons.map((btn, index) => (
						<Button
							key={index}
							variant="outline"
							size="sm"
							className={`justify-start ${index > 1 ? 'mt-2' : ''}`}
						>
							<span className={`${btn.color} mr-2 rounded-md p-1 text-white`}>
								{btn.icon}
							</span>
							{btn.label}
						</Button>
					))}
				</div>
			</div>

			<div className="flex justify-center pt-2">
				<motion.div
					whileHover={{ scale: 1.05 }}
					className="cursor-pointer rounded-md border p-3"
				>
					<QrCode className="text-muted-foreground mx-auto h-24 w-24" />
					<p className="text-muted-foreground mt-2 text-center text-xs">
						QR Code
					</p>
				</motion.div>
			</div>
		</motion.div>
	)
}
