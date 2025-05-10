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

import useLoadModel from './use-load-model'

interface ModelProviderProps extends React.PropsWithChildren {
	optimizer?: ReturnType<typeof useOptimizeModel>
}

const ModelContext = createContext({} as ReturnType<typeof useLoadModel>)

const ModelProvider = ({ children, optimizer }: ModelProviderProps) => {
	const value = useLoadModel(optimizer)

	return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
}

const useModelContext = () => {
	return useContext(ModelContext)
}

export { ModelContext, ModelProvider, useModelContext }
