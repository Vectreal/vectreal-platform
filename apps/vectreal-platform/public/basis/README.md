# Basis Universal transcoder

Decodes `KHR_texture_basisu` (KTX2) textures in published scenes, through
three.js's `KTX2Loader`.

[GitHub](https://github.com/BinomialLLC/basis_universal)

## Contents

Sourced from `node_modules/three/examples/jsm/libs/basis/`, so they match the
installed three.js version. `tests/public-codec-files.spec.ts` fails when they
drift.

* `basis_transcoder.js` — JavaScript wrapper for the WebAssembly transcoder.
* `basis_transcoder.wasm` — WebAssembly transcoder.

These are served with a one-day cache, at the origin and at Cloudflare, under
names that do not change between versions. After replacing them, purge
`/basis/*` at the edge so a browser never pairs a new wrapper with an old wasm.

## Loading

`packages/core/src/model-loader/ktx2-three-loader.ts` points the loader here
(`KTX2_TRANSCODER_PATH`), only for a model that declares `KHR_texture_basisu`.

## License

[Apache License 2.0](https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE)
