import {
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	CustomBlending,
	ClampToEdgeWrapping,
	DataArrayTexture,
	DataTexture,
	DoubleSide,
	GLSL3,
	HalfFloatType,
	LinearFilter,
	Matrix3,
	Matrix4,
	Mesh,
	NearestFilter,
	OneFactor,
	OrthographicCamera,
	PlaneGeometry,
	RedFormat,
	RGBAFormat,
	Scene,
	ShaderMaterial,
	UnsignedByteType,
	Vector3,
	WebGLRenderTarget,
	type IUniform,
	type WebGLRenderer
} from 'three'
import {
	BVHShaderGLSL,
	FloatVertexAttributeTexture,
	MeshBVH,
	MeshBVHUniformStruct
} from 'three-mesh-bvh'

import { BakeError } from './bake-outcome'
import {
	cutoutVertexAlphas,
	cutoutUvs,
	decodeCutoutMasks,
	MASK_SIZE,
	type CutoutLayers
} from './cutouts'
import {
	FIRST_SLICE_BUDGET,
	gpuSettled,
	gpuTimeMs,
	type GpuTimer,
	MAX_SAMPLES_PER_DRAW,
	nextSliceBudget,
	slicesOf,
	UNFENCED_SLICE_BUDGET
} from './gpu-slices'
import { castsOcclusion, readUvs, type OcclusionBakeTarget } from './plan'
import { triangleIndices, type ScenePrimitive } from './scene-primitives'

import type { Material } from '@gltf-transform/core'

/**
 * One material's bake as RGBA bytes, `size` by `size`. Row 0 is the top of
 * the image, where glTF puts UV v = 0.
 */
export interface UvBake {
	material: Material
	size: number
	pixels: Uint8Array
}

/** What a tracer draws and how its sum becomes bytes. */
export interface UvTrace {
	/** Bakes and bounds of every target, as in `OcclusionBakePlan`. */
	targets: OcclusionBakeTarget[]
	primitives: ScenePrimitive[]
	size: number
	samples: number
	/**
	 * GLSL with the BVH functions and `bvh`, `bias`, `diagonal`,
	 * `firstSample`, `passSamples` and `totalSamples` declared, plus
	 * `vPosition` and `vNormal` (world space, unnormalized) in, and
	 * `fragColor` out. Each pass adds its output to the last.
	 */
	traceFragment: string
	/** The tracer's own uniforms, beside the shared ones. */
	uniforms: Record<string, IUniform>
	/**
	 * GLSL reading `accumulated` at `vUv` into `fragColor`, with alpha 0 where
	 * no triangle drew, so the gutter knows which texels are empty.
	 */
	resolveFragment: string
	/** RGBA for texels no gutter round reached. */
	empty: [number, number, number, number]
	/** Names the bake in the error a GPU reset raises. */
	label: string
	/** How much of the bake is drawn, 0 to 1, after each slice. */
	onProgress?: (fraction: number) => void
}

/** Texels the bake is spread past each UV island, so mipmaps do not blend in the empty texture. */
const GUTTER = 8
/** How far a ray starts off its surface, as a share of the scene diagonal. */
const RAY_BIAS = 5e-4
/** Cutout texels a ray passes through before it counts as blocked. */
const MAX_CUTOUT_HITS = 8

/*
  Raytraces each target material in the space of its first UV set: every
  triangle is drawn at its UVs, and each texel traces rays from the surface
  point it covers into a BVH of the whole scene that `castsOcclusion` admits.
  An alpha-masked caster blocks a ray only where its mask is opaque.
  Rays run in slices of a few milliseconds, each waiting for the GPU to finish
  the last, so a slow GPU is not reset and the page's frames are never queued
  behind more than one slice. Undefined when nothing in the scene blocks a
  ray, which leaves the result to the caller.
*/
export async function traceInUvSpace(
	renderer: WebGLRenderer,
	trace: UvTrace
): Promise<UvBake[] | undefined> {
	const { size, samples } = trace
	const casting = trace.primitives.filter(castsOcclusion)
	const cutouts = await decodeCutoutMasks(casting)
	const occluder = mergedOccluders(casting, cutouts.layerOf)
	if (!occluder) return undefined
	// Sized by what casts and what is baked: a skinned or instanced part is not
	// drawn where its node puts it, so its bind pose would misjudge the scale.
	const bounds = new Box3()
	const placed = [...casting, ...trace.targets.flatMap((t) => t.primitives)]
	for (const { primitive, worldMatrix } of placed) {
		bounds.union(worldBounds(primitive, worldMatrix))
	}
	const diagonal = bounds.isEmpty() ? 1 : bounds.getSize(new Vector3()).length()

	const bvh = new MeshBVH(occluder)
	const bvhUniform = new MeshBVHUniformStruct()
	bvhUniform.updateFrom(bvh)
	const cutoutUvTexture = new FloatVertexAttributeTexture()
	cutoutUvTexture.updateFrom(occluder.getAttribute('cutout') as BufferAttribute)
	const cutoutMasks = new DataArrayTexture(
		cutouts.layers,
		MASK_SIZE,
		MASK_SIZE,
		cutouts.layers.length / (MASK_SIZE * MASK_SIZE)
	)
	cutoutMasks.format = RedFormat
	cutoutMasks.minFilter = cutoutMasks.magFilter = LinearFilter
	// Each layer wraps as its own texture does, in the shader.
	cutoutMasks.wrapS = cutoutMasks.wrapT = ClampToEdgeWrapping
	cutoutMasks.needsUpdate = true
	const cutoutParams = new DataTexture(
		cutouts.params,
		cutouts.params.length / 4,
		1,
		RGBAFormat
	)
	cutoutParams.needsUpdate = true

	const traceMaterial = new ShaderMaterial({
		glslVersion: GLSL3,
		defines: { BVH_STACK_DEPTH: 60, MAX_CUTOUT_HITS },
		uniforms: {
			...trace.uniforms,
			bvh: { value: bvhUniform },
			cutoutUvs: { value: cutoutUvTexture },
			cutoutMasks: { value: cutoutMasks },
			cutoutParams: { value: cutoutParams },
			diagonal: { value: diagonal },
			bias: { value: RAY_BIAS * diagonal },
			firstSample: { value: 0 },
			passSamples: { value: MAX_SAMPLES_PER_DRAW },
			totalSamples: { value: samples }
		},
		vertexShader: TRACE_VERTEX,
		fragmentShader: `${TRACE_PRELUDE}\n${trace.traceFragment}`,
		side: DoubleSide,
		// A plain sum, alpha included, so a tracer can count in alpha: three's
		// additive blending would scale each color by its alpha first.
		blending: CustomBlending,
		blendSrc: OneFactor,
		blendDst: OneFactor,
		depthTest: false,
		depthWrite: false
	})
	const resolveMaterial = new ShaderMaterial({
		glslVersion: GLSL3,
		uniforms: { ...trace.uniforms, accumulated: { value: null } },
		vertexShader: RESOLVE_VERTEX,
		fragmentShader: trace.resolveFragment,
		depthTest: false,
		depthWrite: false
	})
	const target = (type: typeof HalfFloatType | typeof UnsignedByteType) =>
		new WebGLRenderTarget(size, size, {
			type,
			minFilter: NearestFilter,
			magFilter: NearestFilter,
			depthBuffer: false
		})
	const accumulation = target(HalfFloatType)
	const resolved = target(UnsignedByteType)
	const camera = new OrthographicCamera()
	const resolveScene = new Scene().add(
		new Mesh(new PlaneGeometry(2, 2), resolveMaterial)
	)
	resolveScene.children[0].frustumCulled = false

	const previousTarget = renderer.getRenderTarget()
	const previousClearColor = renderer.getClearColor(new Color())
	const previousClearAlpha = renderer.getClearAlpha()
	const previousAutoClear = renderer.autoClear
	// Every pass adds to the last; an automatic clear would keep only the final one.
	renderer.autoClear = false
	// Watched for the whole bake: three asks the browser to restore a lost
	// context, and a restored one reads back as an empty bake.
	let contextLost = false
	const onContextLost = () => (contextLost = true)
	renderer.domElement.addEventListener('webglcontextlost', onContextLost)
	const gl = renderer.getContext() as WebGL2RenderingContext
	const throwIfLost = () => {
		if (contextLost || gl.isContextLost()) {
			throw new BakeError(
				'gpu-reset',
				`The GPU reset while baking ${trace.label}`
			)
		}
	}
	// The bake's own GPU time, where the browser offers it: the wall clock also
	// counts the page's frames, and would shrink the bake to nothing while the
	// view is moving.
	const timer: GpuTimer | null = gl.getExtension(
		'EXT_disjoint_timer_query_webgl2'
	)
	// Carried from slice to slice and target to target, so it is measured once.
	let budget = FIRST_SLICE_BUDGET
	// Texel-rays, so a target counts by its share of the work.
	const work = trace.targets.length * size * size * samples
	let worked = 0

	const baked: UvBake[] = []
	let scene = new Scene()
	try {
		for (const { material, primitives } of trace.targets) {
			scene = new Scene()
			for (const entry of primitives) {
				const mesh = new Mesh(surfaceGeometry(entry), traceMaterial)
				mesh.frustumCulled = false
				scene.add(mesh)
			}

			renderer.setClearColor(0x000000, 0)
			accumulation.scissorTest = false
			renderer.setRenderTarget(accumulation)
			renderer.clear()
			accumulation.scissorTest = true
			const slices = slicesOf(size, samples, () => budget)
			for (const { tile, firstSample, samples: passSamples } of slices) {
				traceMaterial.uniforms['firstSample'].value = firstSample
				traceMaterial.uniforms['passSamples'].value = passSamples
				accumulation.scissor.set(tile.x, tile.y, tile.width, tile.height)
				// Applies the target's scissor, which three reads only here.
				renderer.setRenderTarget(accumulation)
				const query = timer && gl.createQuery()
				if (timer && query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query)
				const start = performance.now()
				try {
					renderer.render(scene, camera)
				} catch (error) {
					// An open query would refuse every later one on this context.
					if (timer && query) {
						gl.endQuery(timer.TIME_ELAPSED_EXT)
						gl.deleteQuery(query)
					}
					throw error
				}
				if (timer && query) gl.endQuery(timer.TIME_ELAPSED_EXT)
				const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
				if (fence) {
					await gpuSettled(gl, fence)
					const wallMs = performance.now() - start
					const elapsed =
						(timer && query && gpuTimeMs(gl, timer, query)) ?? wallMs
					budget = nextSliceBudget(
						budget,
						tile.width * tile.height * passSamples,
						elapsed,
						size * size * MAX_SAMPLES_PER_DRAW
					)
				} else {
					if (query) gl.deleteQuery(query)
					budget = UNFENCED_SLICE_BUDGET
					await nextTask()
				}
				throwIfLost()
				worked += tile.width * tile.height * passSamples
				trace.onProgress?.(worked / work)
			}

			resolveMaterial.uniforms['accumulated'].value = accumulation.texture
			renderer.setRenderTarget(resolved)
			renderer.render(resolveScene, camera)
			const pixels = new Uint8Array(size * size * 4)
			renderer.readRenderTargetPixels(resolved, 0, 0, size, size, pixels)
			throwIfLost()
			fillGutter(pixels, size, trace.empty)
			baked.push({ material, size, pixels })

			disposeGeometries(scene)
		}
	} finally {
		renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
		disposeGeometries(scene)
		renderer.autoClear = previousAutoClear
		renderer.setRenderTarget(previousTarget)
		renderer.setClearColor(previousClearColor, previousClearAlpha)
		accumulation.dispose()
		resolved.dispose()
		traceMaterial.dispose()
		resolveMaterial.dispose()
		disposeGeometries(resolveScene)
		bvhUniform.dispose()
		cutoutUvTexture.dispose()
		cutoutMasks.dispose()
		cutoutParams.dispose()
		occluder.dispose()
	}
	return baked
}

/** RGBA bytes from a bake as a PNG, in a browser or worker. */
export async function encodeBakePng({
	size,
	pixels
}: UvBake): Promise<Uint8Array> {
	const canvas = new OffscreenCanvas(size, size)
	const context = canvas.getContext('2d')
	if (!context) throw new Error('No 2D canvas context to encode the bake')
	context.putImageData(
		new ImageData(new Uint8ClampedArray(pixels), size, size),
		0,
		0
	)
	const blob = await canvas.convertToBlob({ type: 'image/png' })
	return new Uint8Array(await blob.arrayBuffer())
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve))

const disposeGeometries = (scene: Scene) =>
	scene.children.forEach((mesh) => (mesh as Mesh).geometry.dispose())

function readVec3s(primitive: ScenePrimitive['primitive'], semantic: string) {
	const accessor = primitive.getAttribute(semantic)
	if (!accessor) return undefined
	const count = accessor.getCount()
	const values = new Float32Array(count * 3)
	const element = [0, 0, 0]
	for (let i = 0; i < count; i++) {
		accessor.getElement(i, element)
		values.set(element, i * 3)
	}
	return values
}

function worldPositions(
	primitive: ScenePrimitive['primitive'],
	worldMatrix: number[]
): Float32Array {
	const positions = readVec3s(primitive, 'POSITION') ?? new Float32Array()
	new BufferAttribute(positions, 3).applyMatrix4(
		new Matrix4().fromArray(worldMatrix)
	)
	return positions
}

function worldBounds(
	primitive: ScenePrimitive['primitive'],
	worldMatrix: number[]
): Box3 {
	return new Box3().setFromBufferAttribute(
		new BufferAttribute(worldPositions(primitive, worldMatrix), 3)
	)
}

/*
  Every occluding triangle in world space, as one geometry for the BVH. Each
  vertex carries `cutout`: its mask UV, its mask layer and its vertex alpha,
  or a layer of -1 where the part is solid.
*/
function mergedOccluders(
	primitives: ScenePrimitive[],
	layerOf: CutoutLayers['layerOf']
): BufferGeometry | undefined {
	const positions: Float32Array[] = []
	const cutouts: Float32Array[] = []
	const indices: number[] = []
	let offset = 0
	for (const { primitive, material, worldMatrix } of primitives) {
		const world = worldPositions(primitive, worldMatrix)
		const count = world.length / 3
		const triangles = triangleIndices(primitive)
		for (let i = 0; i < triangles.length; i++)
			indices.push(triangles[i] + offset)
		positions.push(world)
		const cutout = new Float32Array(count * 4)
		const mask = material ? layerOf.get(material) : undefined
		const uvs = mask && cutoutUvs(primitive, mask.mask)
		const alphas = mask && cutoutVertexAlphas(primitive)
		for (let i = 0; i < count; i++) {
			cutout[i * 4] = uvs?.[i * 2] ?? 0
			cutout[i * 4 + 1] = uvs?.[i * 2 + 1] ?? 0
			cutout[i * 4 + 2] = mask?.layer ?? -1
			cutout[i * 4 + 3] = alphas?.[i] ?? 0
		}
		cutouts.push(cutout)
		offset += count
	}
	if (indices.length === 0) return undefined

	return new BufferGeometry()
		.setAttribute('position', new BufferAttribute(concat(positions), 3))
		.setAttribute('cutout', new BufferAttribute(concat(cutouts), 4))
		.setIndex(new BufferAttribute(new Uint32Array(indices), 1))
}

function concat(parts: Float32Array[]): Float32Array {
	const merged = new Float32Array(
		parts.reduce((total, part) => total + part.length, 0)
	)
	let at = 0
	for (const part of parts) {
		merged.set(part, at)
		at += part.length
	}
	return merged
}

/** One target primitive in world space with the normals and UVs the tracer reads. */
function surfaceGeometry({ primitive, worldMatrix }: ScenePrimitive) {
	const geometry = new BufferGeometry()
		.setAttribute(
			'position',
			new BufferAttribute(worldPositions(primitive, worldMatrix), 3)
		)
		.setAttribute('uv', new BufferAttribute(readUvs(primitive)!, 2))
		.setIndex(
			new BufferAttribute(Uint32Array.from(triangleIndices(primitive)), 1)
		)
	const normals = readVec3s(primitive, 'NORMAL')
	if (normals) {
		const attribute = new BufferAttribute(normals, 3)
		// Left unnormalized under a scaled node: the tracer normalizes per texel.
		attribute.applyNormalMatrix(
			new Matrix3().getNormalMatrix(new Matrix4().fromArray(worldMatrix))
		)
		geometry.setAttribute('normal', attribute)
	} else {
		geometry.computeVertexNormals()
		// A mirroring node reverses the winding the normals are computed from.
		if (new Matrix4().fromArray(worldMatrix).determinant() < 0) {
			const computed = geometry.getAttribute('normal') as BufferAttribute
			for (let i = 0; i < computed.array.length; i++) computed.array[i] *= -1
		}
	}
	return geometry
}

/*
  Texels no triangle covers carry alpha 0. Each round gives every empty texel
  next to a covered one the average of its covered neighbors, growing the bake
  outward by one texel; anything left after the gutter takes `empty`.
*/
function fillGutter(pixels: Uint8Array, size: number, empty: UvTrace['empty']) {
	for (let round = 0; round < GUTTER; round++) {
		const source = pixels.slice()
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const i = (y * size + x) * 4
				if (source[i + 3] !== 0) continue
				const sum = [0, 0, 0]
				let count = 0
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx = x + dx
						const ny = y + dy
						if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
						const n = (ny * size + nx) * 4
						if (source[n + 3] === 0) continue
						for (let c = 0; c < 3; c++) sum[c] += source[n + c]
						count++
					}
				}
				if (count === 0) continue
				for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(sum[c] / count)
				pixels[i + 3] = 255
			}
		}
	}
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i + 3] === 0) pixels.set(empty, i)
	}
}

const TRACE_VERTEX = /* glsl */ `
out vec3 vPosition;
out vec3 vNormal;

void main() {
	vPosition = position;
	vNormal = normal;
	// Drawn at its UVs: v = 0 lands on the first row the bake reads back.
	gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`

const TRACE_PRELUDE = /* glsl */ `
precision highp isampler2D;
precision highp usampler2D;
precision highp sampler2DArray;

${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}

uniform BVH bvh;
uniform sampler2D cutoutUvs;
uniform sampler2DArray cutoutMasks;
uniform sampler2D cutoutParams;
uniform float diagonal;
uniform float bias;
uniform int firstSample;
uniform int passSamples;
uniform int totalSamples;

in vec3 vPosition;
in vec3 vNormal;
out vec4 fragColor;

uint pcg(uint v) {
	uint state = v * 747796405u + 2891336453u;
	uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
	return (word >> 22u) ^ word;
}

float radicalInverse(uint bits) {
	bits = (bits << 16u) | (bits >> 16u);
	bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
	bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
	bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
	bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
	return float(bits) * 2.3283064365386963e-10;
}

// Sample k of a Hammersley set shared by every texel, shifted by a per-texel
// offset so neighbors do not repeat one another's pattern.
vec2 sampleAt(int k) {
	uint texel = pcg(uint(gl_FragCoord.x) + pcg(uint(gl_FragCoord.y)));
	vec2 shift = vec2(pcg(texel), pcg(texel + 1u)) * 2.3283064365386963e-10;
	return fract(vec2((float(k) + 0.5) / float(totalSamples), radicalInverse(uint(k))) + shift);
}

// A unit vector in the frame of axis, from its components along the two
// perpendiculars and the axis itself.
vec3 aroundAxis(vec3 axis, float x, float y, float z) {
	vec3 helper = abs(axis.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
	vec3 tangent = normalize(cross(helper, axis));
	vec3 bitangent = cross(axis, tangent);
	return normalize(tangent * x + bitangent * y + axis * z);
}

// A mask coordinate wrapped as glTF's sampler says: 0 repeat, 1 clamp, 2 mirror.
float wrapped(float x, float mode) {
	if (mode > 1.5) return 1.0 - abs(mod(x, 2.0) - 1.0);
	if (mode > 0.5) return clamp(x, 0.0, 1.0);
	return fract(x);
}

// Whether anything opaque lies within maxDistance along the ray. A hit on a
// cutout's clear texel is passed through, and the ray goes on from there.
bool blocked(vec3 origin, vec3 direction, float maxDistance) {
	uvec4 faceIndices;
	vec3 faceNormal;
	vec3 barycoord;
	float side;
	float dist;
	for (int i = 0; i < MAX_CUTOUT_HITS; i++) {
		bool hit = bvhIntersectFirstHit(bvh, origin, direction, faceIndices, faceNormal, barycoord, side, dist);
		if (!hit || dist > maxDistance) return false;
		vec4 cutout = textureSampleBarycoord(cutoutUvs, barycoord, faceIndices.xyz);
		if (cutout.z < -0.5) return true;
		int layer = int(round(cutout.z));
		vec4 params = texelFetch(cutoutParams, ivec2(layer, 0), 0);
		vec2 wrap = params.rg * 255.0;
		vec2 uv = vec2(wrapped(cutout.x, wrap.x), wrapped(cutout.y, wrap.y));
		float alpha = texture(cutoutMasks, vec3(uv, float(layer))).r * cutout.w;
		if (alpha >= params.b) return true;
		origin += direction * (dist + bias);
		maxDistance -= dist + bias;
	}
	return true;
}
`

const RESOLVE_VERTEX = /* glsl */ `
out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
