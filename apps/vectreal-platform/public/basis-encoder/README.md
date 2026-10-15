# Basis Universal encoder

Encodes textures to KTX2 when a scene is published, in the publisher's
export worker (`app/workers/publish-export.worker.ts`).

## Contents

Sourced from `node_modules/ktx2-encoder/dist/basis/`. The worker bundles that
package's JavaScript glue and fetches this wasm, so the two must come from the
same version; `tests/public-codec-files.spec.ts` fails when they drift.

* `basis_encoder.wasm` — WebAssembly encoder, about 3.3 MB, fetched only when
  someone publishes with GPU-compressed textures on.

Served with a one-day cache, at the origin and at Cloudflare. After replacing
it, purge `/basis-encoder/*` at the edge.

## License

`ktx2-encoder` is MIT. The encoder it redistributes is Basis Universal, under
the Apache License 2.0, whose attribution notice is reproduced as §4(d)
requires:

```
Basis Universal™ Supercompressed GPU Texture Compression Library

Copyright © 2016–2026 Binomial LLC.
All rights reserved except as granted under the Apache 2.0 license
(https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE).
"Basis Universal" is a trademark of Binomial LLC.

The documents in the Basis Universal wiki, and the Basis Universal library,
example, and tool source code, fall under the Apache 2.0 license, unless
otherwise explicitly indicated.

Redistributions or derivative works must include a readable copy of the
attribution notices from this NOTICE file (see Apache License 2.0 §4(d)).
```

The build also links Zstandard (BSD-3-Clause, © Meta Platforms, Inc.) and
tinyexr, tiny_dds and QOI loaders (MIT). See the upstream
[LICENSES folder](https://github.com/BinomialLLC/basis_universal/tree/master/LICENSES).
