import { HexColorPicker } from 'react-colorful'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@vctrl/shared/components'
import { cn } from '@vctrl/@vctrl-ui/utils'

import { useEditorContext } from '../../components/providers'
import CloseButton from '../../components/modal-close-button'

interface ColorPickerProps {
	show: boolean
	setShow: (showColorPicker: boolean) => void
}

const ColorPicker = ({ show, setShow }: ColorPickerProps) => {
	const { color, setColor } = useEditorContext()

	function handleColorPickerChange(event: React.ChangeEvent<HTMLInputElement>) {
		const value = event.target.value
		if (value.length > 7) return

		setColor(value.includes('#') ? value : `#${value}`)
	}

	return (
		<Card
			className={cn(
				'fixed top-1/2 -translate-y-1/2 transition-all duration-300',
				show && 'visible left-4 opacity-100',
				!show && 'invisible -left-4 opacity-0'
			)}
		>
			<CloseButton title="Close color picker" onClick={() => setShow(false)} />
			<CardHeader>
				<CardTitle>Set Background-color</CardTitle>
				<CardDescription>Pick a color</CardDescription>
			</CardHeader>
			<CardContent>
				<HexColorPicker color={color} onChange={setColor} />
				<p className="mt-4">
					<span className="text-sm text-zinc-600">Current color: </span>
					<input
						value={color}
						className="w-24 rounded bg-zinc-700 px-1 uppercase"
						onChange={handleColorPickerChange}
					/>
				</p>
			</CardContent>
		</Card>
	)
}

export default ColorPicker
