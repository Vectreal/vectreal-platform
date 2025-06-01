import RadioAccordionItem from './radio-item'
import { RadioAccordionProps } from './types'

const RadioAccordion = <T extends string>({
	label,
	description,
	options,
	selectedOption,
	onSelectPreset
}: RadioAccordionProps<T>) => {
	return (
		<div className="w-full">
			<div className="space-y-2">
				<p className="px-2">{label}</p>
				<small className="text-muted-foreground/75 mt-2 mb-4 block px-2">
					{description}
				</small>
				{options.map((option) => (
					<RadioAccordionItem
						key={option.id}
						option={option}
						isSelected={selectedOption?.id === option.id}
						onSelect={() => onSelectPreset(option)}
					/>
				))}
			</div>
		</div>
	)
}

export default RadioAccordion
