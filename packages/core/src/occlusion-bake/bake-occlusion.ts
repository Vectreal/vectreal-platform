import {
	AdditiveBlending,
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	DoubleSide,
	GLSL3,
	HalfFloatType,
	Matrix3,
	Matrix4,
	Mesh,
	NearestFilter,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	UnsignedByteType,
	Vector3,
	WebGLRenderTarget,
	type WebGLRenderer
} from 'three'
import { BVHShaderGLSL, MeshBVH, MeshBVHUniformStruct } from 'three-mesh-bvh'

import {
	DEFAULT_OCCLUSION_BAKE_OPTIONS,
	type OcclusionBakeOptions
} from './options'
import { castsOcclusion, readUvs, type OcclusionBakePlan } from './plan'
import { triangleIndices, type ScenePrimitive } from './scene-primitives'

import type { Material } from '@gltf-transform/core'

/**
 * One material's occlusion as RGBA bytes, `size` by `size`, grey in every
 * color channel. Row 0 is the top of the image, where glTF puts UV v = 0.
 */
export interface BakedOcclusion {
	material: Material
	size: number
	pixels: Uint8Array
}

/** Rays per draw. A draw that runs too long is killed by the GPU watchdog. */
const SAMPLES_PER_PASS = 16
/** Texels the bake is spread past each UV island, so mipmaps do not blend in the empty texture. */
const GUTTER = 8
/** How far a ray starts off its surface, as a share of the scene diagonal. */
const RAY_BIAS = 5e-4
/** The most rays a texel can take: half-float counts are exact only up to 2048. */
const MAX_SAMPLES = 2048

/*
  Raytraces each target material's ambient occlusion in the space of its
  first UV set: every triangle is drawn at its UVs, and each texel sends
  cosine-weighted rays from the surface point it covers into a BVH of the
  whole scene that `castsOcclusion` admits. Rays run a few at a time, yielding
  between draws, so a slow GPU is not reset and the page stays responsive.
*/
export async function bakeOcclusion(
	plan: OcclusionBakePlan,
	renderer: WebGLRenderer,
	options: OcclusionBakeOptions = DEFAULT_OCCLUSION_BAKE_OPTIONS
): Promise<BakedOcclusion[]> {
	const { resolution: size, distance } = options
	const samples = Math.min(options.samples, MAX_SAMPLES)
	const casting = plan.primitives.filter(castsOcclusion)
	const occluder = mergedOccluders(casting)
	// Sized by what casts and what is baked: a skinned or instanced part is not
	// drawn where its node puts it, so its bind pose would misjudge the scale.
	const bounds = new Box3()
	const placed = [...casting, ...plan.targets.flatMap((t) => t.primitives)]
	for (const { primitive, worldMatrix } of placed) {
		bounds.union(worldBounds(primitive, worldMatrix))
	}
	const diagonal = bounds.isEmpty() ? 1 : bounds.getSize(new Vector3()).length()

	if (!occluder) {
		return plan.targets.map(({ material }) => ({
			material,
			size,
			pixels: new Uint8Array(size * size * 4).fill(255)
		}))
	}

	const bvh = new MeshBVH(occluder)
	const bvhUniform = new MeshBVHUniformStruct()
	bvhUniform.updateFrom(bvh)

	const traceMaterial = new ShaderMaterial({
		glslVersion: GLSL3,
		defines: { BVH_STACK_DEPTH: 60 },
		uniforms: {
			bvh: { value: bvhUniform },
			maxDistance: { value: distance * diagonal },
			bias: { value: RAY_BIAS * diagonal },
			firstSample: { value: 0 },
			passSamples: { value: SAMPLES_PER_PASS },
			totalSamples: { value: samples }
		},
		vertexShader: TRACE_VERTEX,
		fragmentShader: TRACE_FRAGMENT,
		side: DoubleSide,
		blending: AdditiveBlending,
		depthTest: false,
		depthWrite: false
	})
	const resolveMaterial = new ShaderMaterial({
		glslVersion: GLSL3,
		uniforms: { accumulated: { value: null } },
		vertexShader: RESOLVE_VERTEX,
		fragmentShader: RESOLVE_FRAGMENT,
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

	const baked: BakedOcclusion[] = []
	let scene = new Scene()
	try {
		for (const { material, primitives } of plan.targets) {
			scene = new Scene()
			for (const entry of primitives) {
				const mesh = new Mesh(surfaceGeometry(entry), traceMaterial)
				mesh.frustumCulled = false
				scene.add(mesh)
			}

			renderer.setClearColor(0x000000, 0)
			renderer.setRenderTarget(accumulation)
			renderer.clear()
			for (let first = 0; first < samples; first += SAMPLES_PER_PASS) {
				traceMaterial.uniforms['firstSample'].value = first
				traceMaterial.uniforms['passSamples'].value = Math.min(
					SAMPLES_PER_PASS,
					samples - first
				)
				renderer.setRenderTarget(accumulation)
				renderer.render(scene, camera)
				await nextTask()
			}

			resolveMaterial.uniforms['accumulated'].value = accumulation.texture
			renderer.setRenderTarget(resolved)
			renderer.render(resolveScene, camera)
			const pixels = new Uint8Array(size * size * 4)
			renderer.readRenderTargetPixels(resolved, 0, 0, size, size, pixels)
			fillGutter(pixels, size)
			baked.push({ material, size, pixels })

			disposeGeometries(scene)
		}
	} finally {
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
		occluder.dispose()
	}
	return baked
}

/** RGBA bytes from `bakeOcclusion` as a PNG, in a browser or worker. */
export async function encodeOcclusionPng({
	size,
	pixels
}: BakedOcclusion): Promise<Uint8Array> {
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

/** Every occluding triangle in world space, as one geometry for the BVH. */
function mergedOccluders(
	primitives: ScenePrimitive[]
): BufferGeometry | undefined {
	const positions: Float32Array[] = []
	const indices: number[] = []
	let offset = 0
	for (const { primitive, worldMatrix } of primitives) {
		const world = worldPositions(primitive, worldMatrix)
		const triangles = triangleIndices(primitive)
		for (let i = 0; i < triangles.length; i++)
			indices.push(triangles[i] + offset)
		positions.push(world)
		offset += world.length / 3
	}
	if (indices.length === 0) return undefined

	const merged = new Float32Array(offset * 3)
	let at = 0
	for (const part of positions) {
		merged.set(part, at)
		at += part.length
	}
	return new BufferGeometry()
		.setAttribute('position', new BufferAttribute(merged, 3))
		.setIndex(new BufferAttribute(new Uint32Array(indices), 1))
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
  outward by one texel; anything left after the gutter is white, unoccluded.
*/
function fillGutter(pixels: Uint8Array, size: number) {
	for (let round = 0; round < GUTTER; round++) {
		const source = pixels.slice()
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const i = (y * size + x) * 4
				if (source[i + 3] !== 0) continue
				let sum = 0
				let count = 0
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx = x + dx
						const ny = y + dy
						if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
						const n = (ny * size + nx) * 4
						if (source[n + 3] === 0) continue
						sum += source[n]
						count++
					}
				}
				if (count === 0) continue
				const value = Math.round(sum / count)
				pixels[i] = pixels[i + 1] = pixels[i + 2] = value
				pixels[i + 3] = 255
			}
		}
	}
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i + 3] !== 0) continue
		pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 255
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

const TRACE_FRAGMENT = /* glsl */ `
precision highp isampler2D;
precision highp usampler2D;

${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}

uniform BVH bvh;
uniform float maxDistance;
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

void main() {
	vec3 normal = normalize(vNormal);
	vec3 helper = abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
	vec3 tangent = normalize(cross(helper, normal));
	vec3 bitangent = cross(normal, tangent);
	vec3 origin = vPosition + normal * bias;

	// A Hammersley set shared by every texel, shifted by a per-texel offset so
	// neighbors do not repeat one another's pattern.
	uint texel = pcg(uint(gl_FragCoord.x) + pcg(uint(gl_FragCoord.y)));
	vec2 shift = vec2(pcg(texel), pcg(texel + 1u)) * 2.3283064365386963e-10;

	float open = 0.0;
	for (int i = 0; i < passSamples; i++) {
		int k = firstSample + i;
		vec2 xi = fract(vec2((float(k) + 0.5) / float(totalSamples), radicalInverse(uint(k))) + shift);
		float r = sqrt(xi.x);
		float phi = 6.283185307179586 * xi.y;
		vec3 direction = normalize(
			tangent * (r * cos(phi)) + bitangent * (r * sin(phi)) + normal * sqrt(max(0.0, 1.0 - xi.x))
		);

		uvec4 faceIndices;
		vec3 faceNormal;
		vec3 barycoord;
		float side;
		float dist;
		bool hit = bvhIntersectFirstHit(bvh, origin, direction, faceIndices, faceNormal, barycoord, side, dist);
		if (!hit || dist > maxDistance) open += 1.0;
	}
	fragColor = vec4(open, float(passSamples), 0.0, 1.0);
}
`

const RESOLVE_VERTEX = /* glsl */ `
out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const RESOLVE_FRAGMENT = /* glsl */ `
uniform sampler2D accumulated;
in vec2 vUv;
out vec4 fragColor;

void main() {
	vec4 sum = texture(accumulated, vUv);
	float covered = sum.g > 0.0 ? 1.0 : 0.0;
	fragColor = vec4(vec3(covered > 0.0 ? sum.r / sum.g : 1.0), covered);
}
`
