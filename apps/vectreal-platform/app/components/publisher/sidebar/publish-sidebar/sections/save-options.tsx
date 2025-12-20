import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { motion } from 'framer-motion'
import { Box, Download, FileAxis3d, Save, User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
	Option,
	RadioAccordion
} from '../../../../../components/radio-accordion'
import { itemVariants } from '../../animation'

type ExportFormat = 'glb' | 'gltf'
// | 'usdz' | 'obj';

const EXPORT_OPTIONS: Option<ExportFormat>[] = [
	{
		id: 'glb',
		label: 'GLB (Binary)',
		description:
			'Single binary file format, optimized for web and most 3D platforms',
		icon: <FileAxis3d className="h-4 w-4" />
	},
	{
		id: 'gltf',
		label: 'GLTF (ZIP)',
		description:
			'JSON-based format with separate assets, ideal for debugging and editing',
		icon: <Box className="h-4 w-4" />
	}
	// { value: 'usdz', label: 'USDZ', desc: 'For AR on iOS devices' },
	// {
	// 	value: 'obj',
	// 	label: 'OBJ',
	// 	desc: 'Legacy format, wide support'
	// }
]

function handleExportSuccess() {
	toast.info('Successfully exported model.')
}

function handleExportError(error: Error) {
	toast.error(error.message)
}

interface SaveOptionsProps {
	userId?: string
	sceneId?: string
	projectId?: string
}

export const SaveOptions: React.FC<SaveOptionsProps> = ({ userId }) => {
	const [format, setFormat] = useState<ExportFormat>('gltf')
	const { file, optimizer } = useModelContext()

	const { handleDocumentGltfExport } = useExportModel(
		handleExportSuccess,
		handleExportError
	)

	const isLoggedIn = Boolean(userId)

	function handleFormatChange(value: Option<ExportFormat>) {
		if (value.id === format) {
			return
		}

		setFormat(value.id)
	}

	const selectedFormatOption = EXPORT_OPTIONS.find(
		(option) => option.id === format
	)

	const handleDownload = () => {
		if (!selectedFormatOption) {
			toast.error('Please select a valid export format.')
			return
		}

		const document = optimizer?._getDocument()

		if (!document) {
			toast.error('Model not loaded or optimization failed.')
			return
		}

		if (selectedFormatOption.id === 'glb') {
			handleDocumentGltfExport(document, file, true)
		} else if (selectedFormatOption.id === 'gltf') {
			handleDocumentGltfExport(document, file, false)
		}
	}

	const handleSaveToCloud = () => {
		// TODO: Implement cloud save functionality
		toast.info('Cloud save functionality coming soon!')
	}

	return (
		<motion.div
			variants={itemVariants}
			className="flex flex-col gap-4 px-2 py-2"
		>
			{/* Scene Save Section */}
			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">Save to Cloud</h4>
					<p className="text-muted-foreground text-xs">
						Save your scene configuration and share it with others
					</p>
				</div>

				<Button
					onClick={handleSaveToCloud}
					variant={isLoggedIn ? 'default' : 'outline'}
					className="w-full"
				>
					{isLoggedIn ? (
						<Save className="h-4 w-4" />
					) : (
						<User className="h-4 w-4" />
					)}
					{isLoggedIn ? 'Save Scene' : 'Sign In to Save'}
				</Button>
			</div>

			<Separator />

			{/* Export Section */}
			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">Download Model</h4>
					<p className="text-muted-foreground text-xs">
						Export your optimized 3D model for use in other applications
					</p>
				</div>

				<RadioAccordion
					label="Export Format"
					description="Choose the format for downloading your 3D model."
					selectedOption={selectedFormatOption}
					onSelectPreset={handleFormatChange}
					options={EXPORT_OPTIONS}
				/>

				<Button onClick={handleDownload} variant="outline" className="w-full">
					<Download className="h-4 w-4" />
					Download
				</Button>
			</div>
		</motion.div>
	)
}
