import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Button } from '@vctrl-ui/ui/button'

import { motion } from 'framer-motion'
import { Box, Download, FileAxis3d } from 'lucide-react'
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

function handleExportError(error: ErrorEvent) {
	toast.error(error.message)
}

export const SaveOptions: React.FC = () => {
	const [format, setFormat] = useState<ExportFormat>('glb')
	const { file } = useModelContext()

	const { handleGltfExport } = useExportModel(
		handleExportSuccess,
		handleExportError
	)

	function handleFormatChange(value: Option<ExportFormat>) {
		if (value.id === format) {
			return
		}

		setFormat(value.id)
	}

	const selectedFormatOption = EXPORT_OPTIONS.find(
		(option) => option.id === format
	)

	const handleSave = () => {
		if (!selectedFormatOption) {
			toast.error('Please select a valid export format.')
			return
		}
		if (selectedFormatOption.id === 'glb') {
			handleGltfExport(file, true)
		} else if (selectedFormatOption.id === 'gltf') {
			handleGltfExport(file, false)
		}
	}

	return (
		<motion.div
			variants={itemVariants}
			className="flex flex-col gap-4 px-2 py-2"
		>
			<RadioAccordion
				label="Export Format"
				description="Choose the format for downloading your 3D model."
				selectedOption={selectedFormatOption}
				onSelectPreset={handleFormatChange}
				options={EXPORT_OPTIONS}
			/>

			<Button onClick={handleSave}>
				<Download className="h-4 w-4" />
				Download
			</Button>
		</motion.div>
	)
}
