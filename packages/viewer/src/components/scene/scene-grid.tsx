import { Grid } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { GridProps } from '@vctrl/core'
import { useCallback, useEffect, useState } from 'react'
import { Box3, Mesh, Object3D, Vector3 } from 'three'

/**
 * Default grid options.
 */
export const defaultGridOptions: GridProps = {
	showGrid: false,
	snapToBottom: true,
	cellSize: 0.5,
	sectionSize: 5,
	sectionColor: 'rgb(134, 73, 33)',
	cellColor: 'rgb(100, 100, 100)',
	fadeDistance: 25,
	fadeStrength: 1,
	args: [10, 10],
	followCamera: false,
	infiniteGrid: true
}

/**
 * SceneGrid component that renders a grid based on the size of the scene's content.
 * The grid adjusts its position and size according to the bounding box of the scene.
 */
const SceneGrid = (props: GridProps) => {
	// State to hold the size of the scene's bounding box
	const [size, setSize] = useState<Vector3 | null>(null)

	// Access the current scene from the three.js context
	const scene = useThree((state) => state.scene)

	/**
	 * Recursively computes the union of bounding boxes of the given node(s).
	 *
	 * @param {Object3D | Object3D[]} node - The node or array of nodes to compute the bounding box for.
	 * @returns {Box3} The union of the bounding boxes.
	 */
	const computeBoundingBox = useCallback(
		(node: Object3D | Object3D[]): Box3 => {
			const bbox = new Box3()
			const nodes = Array.isArray(node) ? node : [node]

			nodes.forEach((child) => {
				if (child instanceof Mesh && child.name !== 'Grid') {
					// Include the bounding box of Meshes that are not the grid itself
					try {
						const childBbox = new Box3().setFromObject(child)
						bbox.union(childBbox)
					} catch (error) {
						console.error('Error computing mesh size:', error)
					}
				} else if (child instanceof Object3D) {
					// Recursively compute bounding boxes for child nodes
					const childBbox = computeBoundingBox(child.children)
					bbox.union(childBbox)
				}
			})

			return bbox
		},
		[]
	)

	// Effect to compute the bounding box of the scene whenever the scene changes
	useEffect(() => {
		if (!scene) return

		const bbox = computeBoundingBox(scene.children)
		setSize(bbox.getSize(new Vector3()))
	}, [scene.children, scene, computeBoundingBox])

	// Merge default grid options with props
	const { showGrid, snapToBottom, ...gridOptions } = {
		...defaultGridOptions,
		...props
	}

	// If showGrid is false or size is not available, don't render anything
	if (!showGrid) {
		return null
	}

	const position =
		snapToBottom && size ? new Vector3(0, -size.y / 2, 0) : new Vector3(0, 0, 0)

	// Render the Grid component, positioning it at the bottom of the scene's bounding box
	return <Grid name="Grid" position={position} {...gridOptions} />
}

export default SceneGrid
