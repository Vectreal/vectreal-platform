'use client'

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
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
import { Check, ChevronsUpDown, X } from 'lucide-react'
import * as React from 'react'

export interface ProjectOption {
	id: string
	name: string
	slug: string
}

interface ProjectMultiSelectProps {
	projects: ProjectOption[]
	value: string[]
	onChange: (value: string[]) => void
	placeholder?: string
	emptyText?: string
	disabled?: boolean
	className?: string
}

export function ProjectMultiSelect({
	projects,
	value,
	onChange,
	placeholder = 'Select projects...',
	emptyText = 'No projects found',
	disabled = false,
	className
}: ProjectMultiSelectProps) {
	const [open, setOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState('')

	const selectedProjects = React.useMemo(() => {
		return projects.filter((project) => value.includes(project.id))
	}, [projects, value])

	const filteredProjects = React.useMemo(() => {
		if (!searchQuery) return projects

		const query = searchQuery.toLowerCase()
		return projects.filter(
			(project) =>
				project.name.toLowerCase().includes(query) ||
				project.slug.toLowerCase().includes(query)
		)
	}, [projects, searchQuery])

	const handleToggleProject = (projectId: string) => {
		const newValue = value.includes(projectId)
			? value.filter((id) => id !== projectId)
			: [...value, projectId]

		onChange(newValue)
	}

	const handleRemoveProject = (projectId: string, e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		onChange(value.filter((id) => id !== projectId))
	}

	const handleClearAll = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		onChange([])
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						'w-full justify-between font-normal',
						selectedProjects.length === 0 && 'text-muted-foreground',
						className
					)}
				>
					<div className="flex flex-1 flex-wrap gap-1 overflow-hidden">
						{selectedProjects.length === 0 ? (
							<span>{placeholder}</span>
						) : (
							<>
								<span className="text-sm">
									{selectedProjects.length} selected
								</span>
								{selectedProjects.slice(0, 2).map((project) => (
									<Badge
										key={project.id}
										variant="secondary"
										className="mr-1 gap-1"
									>
										{project.name}
										<X
											className="size-3 cursor-pointer opacity-70 hover:opacity-100"
											onClick={(e) => handleRemoveProject(project.id, e)}
										/>
									</Badge>
								))}
								{selectedProjects.length > 2 && (
									<Badge variant="secondary">
										+{selectedProjects.length - 2} more
									</Badge>
								)}
							</>
						)}
					</div>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search projects..."
						value={searchQuery}
						onValueChange={setSearchQuery}
					/>
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{filteredProjects.map((project) => {
								const isSelected = value.includes(project.id)
								return (
									<CommandItem
										key={project.id}
										value={project.id}
										onSelect={() => handleToggleProject(project.id)}
										className="cursor-pointer"
									>
										<div className="flex flex-1 items-center gap-2">
											<Checkbox
												checked={isSelected}
												className="pointer-events-none"
											/>
											<div className="flex flex-col">
												<span className="text-sm font-medium">
													{project.name}
												</span>
												<span className="text-muted-foreground text-xs">
													{project.slug}
												</span>
											</div>
										</div>
										{isSelected && (
											<Check className="text-primary ml-auto size-4" />
										)}
									</CommandItem>
								)
							})}
						</CommandGroup>
					</CommandList>
					{selectedProjects.length > 0 && (
						<div className="border-t p-2">
							<Button
								variant="ghost"
								size="sm"
								className="w-full"
								onClick={handleClearAll}
							>
								Clear all ({selectedProjects.length})
							</Button>
						</div>
					)}
				</Command>
			</PopoverContent>
		</Popover>
	)
}
