/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { createContext, useContext } from 'react'

import { useOptimizeModel } from '../use-optimize-model'

import { UseLoadModelReturn } from './types'
import useLoadModel from './use-load-model'

/**
 * Props for ModelProvider when an optimizer is provided.
 * This ensures the optimizer property is required and properly typed.
 */
interface ModelProviderPropsWithOptimizer extends React.PropsWithChildren {
	/** The optimizer instance from useOptimizeModel hook */
	optimizer: ReturnType<typeof useOptimizeModel>
}

/**
 * Props for ModelProvider when no optimizer is used.
 * The optimizer property must not be provided.
 */
interface ModelProviderPropsWithoutOptimizer extends React.PropsWithChildren {
	/** Explicitly prevents optimizer from being passed */
	optimizer?: never
}

/**
 * Discriminated union of ModelProvider props.
 * Allows the provider to be used with or without an optimizer,
 * ensuring type safety for both scenarios.
 */
type ModelProviderProps =
	| ModelProviderPropsWithOptimizer
	| ModelProviderPropsWithoutOptimizer

/**
 * Context for model loading with optimizer integration.
 * When this context has a value, the optimizer property will be fully typed
 * with all optimization methods and state.
 */
const ModelContextWithOptimizer = createContext<
	UseLoadModelReturn<true> | undefined
>(undefined)

/**
 * Context for model loading without optimizer integration.
 * When this context has a value, the optimizer property will be typed as null.
 */
const ModelContextWithoutOptimizer = createContext<
	UseLoadModelReturn<false> | undefined
>(undefined)

/**
 * Provider component for model loading context.
 *
 * This component uses a dual-context pattern to provide type-safe access to model loading
 * functionality with or without optimizer integration.
 *
 * @example
 * // With optimizer
 * const optimizer = useOptimizeModel()
 * <ModelProvider optimizer={optimizer}>
 *   <App />
 * </ModelProvider>
 *
 * @example
 * // Without optimizer
 * <ModelProvider>
 *   <App />
 * </ModelProvider>
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the model context
 * @param props.optimizer - Optional optimizer instance from useOptimizeModel hook
 */
const ModelProvider = ({ children, optimizer }: ModelProviderProps) => {
	// Call the hook once to get the model loading functionality
	// The generic type will be inferred based on whether optimizer is defined
	const value = useLoadModel(optimizer)

	// Provide the value to the appropriate context based on whether optimizer is present
	// This enables type-safe consumption via useModelContext
	if (optimizer) {
		// Optimizer is present: use ModelContextWithOptimizer
		// The type assertion is safe because we know optimizer is defined
		return (
			<ModelContextWithOptimizer.Provider
				value={value as unknown as UseLoadModelReturn<true>}
			>
				{children}
			</ModelContextWithOptimizer.Provider>
		)
	}

	// No optimizer: use ModelContextWithoutOptimizer
	// The type assertion is safe because we know optimizer is undefined
	return (
		<ModelContextWithoutOptimizer.Provider
			value={value as unknown as UseLoadModelReturn<false>}
		>
			{children}
		</ModelContextWithoutOptimizer.Provider>
	)
}

/**
 * Hook to access the model loading context.
 *
 * This hook provides type-safe access to model loading functionality.
 * The return type is automatically inferred based on how the ModelProvider was configured.
 *
 * By default (no argument), it assumes an optimizer is present and returns the full
 * optimizer integration. You can explicitly specify the expected configuration using
 * the requireOptimizer parameter.
 *
 * @example
 * // Default: assumes optimizer is present
 * const model = useModelContext()
 * model.optimizer.applyOptimization() // ✅ Fully typed
 *
 * @example
 * // Explicitly require optimizer
 * const model = useModelContext(true)
 * model.optimizer.simplifyOptimization() // ✅ Fully typed
 *
 * @example
 * // Explicitly indicate no optimizer
 * const model = useModelContext(false)
 * model.optimizer // ✅ Typed as null
 *
 * @throws {Error} If used outside of a ModelProvider
 * @returns The model loading context with type-safe optimizer property
 */
function useModelContext(): UseLoadModelReturn<true>
/**
 * @param requireOptimizer - Set to true to explicitly require optimizer integration
 */
function useModelContext(requireOptimizer: true): UseLoadModelReturn<true>
/**
 * @param requireOptimizer - Set to false to explicitly indicate no optimizer
 */
function useModelContext(requireOptimizer: false): UseLoadModelReturn<false>
function useModelContext(
	_requireOptimizer?: boolean
): UseLoadModelReturn<boolean> {
	// Check both contexts - only one will have a value based on how ModelProvider was configured
	const withOptimizer = useContext(ModelContextWithOptimizer)
	const withoutOptimizer = useContext(ModelContextWithoutOptimizer)

	// Use whichever context has a value (they're mutually exclusive)
	const context = withOptimizer ?? withoutOptimizer

	// Ensure the hook is used within a ModelProvider
	if (!context) {
		throw new Error('useModelContext must be used within a ModelProvider')
	}

	return context
}

export { ModelProvider, useModelContext }
