export interface Option<Identifiers> {
	id: Identifiers
	label: string
	description: string
	icon: React.ReactNode
}

export interface RadioAccordionProps<Identifiers> {
	options: Option<Identifiers>[]
	selectedOption?: Option<Identifiers>
	onSelectPreset: (preset: Option<Identifiers>) => void
	label?: string
	description?: string
}

export interface RadioAccordionOptionProps<Identifiers> {
	option: Option<Identifiers>
	isSelected: boolean
	onSelect: () => void
}
