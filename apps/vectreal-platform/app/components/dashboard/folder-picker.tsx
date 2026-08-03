import { Button } from '@shared/components/ui/button'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList
} from '@shared/components/ui/command'
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from '@shared/components/ui/popover'
import { cn } from '@shared/utils'
import { Check, ChevronsUpDown, Folder, FolderRoot } from 'lucide-react'
import { useMemo, useState } from 'react'

export interface FolderPickerOption {
	id: string
	name: string
	depth: number
	/** When set, the option renders disabled and shows this as the reason. */
	disabledReason?: string
}

interface FolderPickerProps {
	options: FolderPickerOption[]
	/** Null is the project root. */
	value: string | null
	onChange: (folderId: string | null) => void
	rootDisabledReason?: string
	disabled?: boolean
	className?: string
}

const ROOT_VALUE = '__root__'

/**
 * Single-select destination picker for a move.
 *
 * Hand-rolled from `Popover` + `Command`, which is this codebase's combobox
 * idiom (see `project-multi-select`). There was no folder picker of any kind
 * before this; the publisher fakes a tree with two indented `Select`s.
 *
 * Invalid destinations are rendered *disabled with their reason* rather than
 * filtered out - a folder silently missing from the list reads as a bug, while
 * "cannot be moved into one of its own subfolders" explains itself.
 */
export function FolderPicker({
	options,
	value,
	onChange,
	rootDisabledReason,
	disabled = false,
	className
}: FolderPickerProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')

	const filtered = useMemo(() => {
		if (!query.trim()) {
			return options
		}
		const needle = query.toLowerCase()
		return options.filter((option) =>
			option.name.toLowerCase().includes(needle)
		)
	}, [options, query])

	const selectedLabel = useMemo(() => {
		if (value === null) {
			return 'Project root'
		}
		return (
			options.find((option) => option.id === value)?.name ?? 'Select folder'
		)
	}, [options, value])

	const select = (folderId: string | null) => {
		onChange(folderId)
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn('w-full justify-between font-normal', className)}
				>
					<span className="flex min-w-0 items-center gap-2">
						{value === null ? (
							<FolderRoot className="size-4 shrink-0 opacity-70" />
						) : (
							<Folder className="size-4 shrink-0 opacity-70" />
						)}
						<span className="truncate">{selectedLabel}</span>
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-(--radix-popover-trigger-width) p-0"
				align="start"
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search folders..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						<CommandEmpty>No folders found</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value={ROOT_VALUE}
								disabled={Boolean(rootDisabledReason)}
								onSelect={() => {
									if (!rootDisabledReason) {
										select(null)
									}
								}}
								className="cursor-pointer"
							>
								<FolderRoot className="mr-2 size-4 opacity-70" />
								<span className="flex-1">Project root</span>
								{rootDisabledReason ? (
									<span className="text-muted-foreground ml-2 text-xs">
										{rootDisabledReason}
									</span>
								) : null}
								{value === null ? (
									<Check className="text-primary ml-2 size-4" />
								) : null}
							</CommandItem>

							{filtered.map((option) => (
								<CommandItem
									key={option.id}
									value={option.id}
									disabled={Boolean(option.disabledReason)}
									onSelect={() => {
										if (!option.disabledReason) {
											select(option.id)
										}
									}}
									className="cursor-pointer"
								>
									<Folder
										className="mr-2 size-4 shrink-0 opacity-70"
										// Depth as indentation rather than a nested tree: the
										// list is searchable, and a collapsible tree would hide
										// matches behind closed branches.
										style={{ marginLeft: `${option.depth * 12}px` }}
									/>
									<span className="flex-1 truncate">{option.name}</span>
									{option.disabledReason ? (
										<span className="text-muted-foreground ml-2 text-xs">
											{option.disabledReason}
										</span>
									) : null}
									{value === option.id ? (
										<Check className="text-primary ml-2 size-4" />
									) : null}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
