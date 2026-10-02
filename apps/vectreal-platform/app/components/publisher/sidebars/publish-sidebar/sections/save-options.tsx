import { Button } from '@shared/components/ui/button'
import {
	ChoiceList,
	type ChoiceListOption
} from '@shared/components/ui/choice-list'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { Archive, Box, Download, FileAxis3d, Smartphone } from 'lucide-react'
import { useState, type FC } from 'react'
import { toast } from 'sonner'

import { itemVariants } from '../../animation'

type ExportFormat = 'glb' | 'gltf' | 'glb-draco' | 'usdz'

const EXPORT_OPTIONS: ChoiceListOption<ExportFormat>[] = [
	{
		value: 'glb',
		label: 'GLB (Binary)',
		detail: 'A single binary file, the format the web and most 3D tools read.',
		icon: <FileAxis3d />
	},
	{
		value: 'gltf',
		label: 'GLTF (ZIP)',
		detail: 'JSON with its assets beside it, easiest to inspect and edit.',
		icon: <Box />
	},
	{
		value: 'glb-draco',
		label: 'GLB (Draco-compressed)',
		detail:
			'The smallest download: geometry compressed with Draco, in one binary file.',
		icon: <Archive />
	},
	{
		value: 'usdz',
		label: 'USDZ',
		detail: 'For AR Quick Look on iOS and macOS.',
		icon: <Smartphone />
	}
]

function handleExportSuccess() {
	toast.info('Successfully exported model.')
}

function handleExportError(error: Error) {
	toast.error(error.message)
}

export const SaveOptions: FC = () => {
	const [format, setFormat] = useState<ExportFormat>('gltf')
	const { file, optimizer } = useModelContext()

	const {
		handleDocumentGltfExport,
		handleDocumentGlbDracoExport,
		handleThreeUsdzExport
	} = useExportModel(handleExportSuccess, handleExportError)

	const handleDownload = () => {
		if (!optimizer?.isReady) {
			toast.error(
				'Model is still preparing. Try downloading again in a moment.'
			)
			return
		}

		if (format === 'usdz') {
			if (!file) {
				toast.error('Model not loaded or optimization failed.')
				return
			}
			handleThreeUsdzExport(file)
			return
		}

		const document = optimizer?._getDocument()

		if (!document) {
			toast.error('Model not loaded or optimization failed.')
			return
		}

		if (format === 'glb') {
			handleDocumentGltfExport(document, file, true)
		} else if (format === 'gltf') {
			handleDocumentGltfExport(document, file, false)
		} else if (format === 'glb-draco') {
			handleDocumentGlbDracoExport(document, file)
		}
	}

	return (
		<motion.div variants={itemVariants} className="flex flex-col gap-3 pb-4">
			<ChoiceList
				aria-label="Export format"
				options={EXPORT_OPTIONS}
				value={format}
				onValueChange={setFormat}
			/>

			<Button onClick={handleDownload} variant="outline" className="w-full">
				<Download className="h-4 w-4" />
				Download
			</Button>
		</motion.div>
	)
}
