# Changelog

## [3.3.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v3.2.0...sdk-v3.3.0) (2026-11-01)


### Features

* bake ambient occlusion into the published GLB when the lighting says baked ([#1223](https://github.com/Vectreal/vectreal-platform/issues/1223)) ([4aac0f1](https://github.com/Vectreal/vectreal-platform/commit/4aac0f12f379a3ce770f0d9bd9144a50e34dd302))
* **core:** add the lighting scene setting and resolveLighting ([#1216](https://github.com/Vectreal/vectreal-platform/issues/1216)) ([a614386](https://github.com/Vectreal/vectreal-platform/commit/a614386c5a3984c68c4baca6870bf1d4d2549fd2))
* **lighting:** bake the studio lights into a light map at publish ([#1225](https://github.com/Vectreal/vectreal-platform/issues/1225)) ([54f093c](https://github.com/Vectreal/vectreal-platform/commit/54f093c74423eadd6a98ac0c3d71dfd9ef48e0b6))
* **publisher:** one Lighting tool replaces Environment and Shadows ([#1221](https://github.com/Vectreal/vectreal-platform/issues/1221)) ([d575394](https://github.com/Vectreal/vectreal-platform/commit/d575394c6d5ed92a8515f7206bf1bab4f296b1e0))

## [3.2.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v3.1.0...sdk-v3.2.0) (2026-10-30)


### Miscellaneous Chores

* **sdk:** Synchronize vectreal-monorepo versions

## [3.1.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v3.0.0...sdk-v3.1.0) (2026-10-27)


### Miscellaneous Chores

* **sdk:** Synchronize vectreal-monorepo versions

## [3.0.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v2.1.0...sdk-v3.0.0) (2026-10-23)


### Features

* **api:** create a scene from one GLB for agents ([#1142](https://github.com/Vectreal/vectreal-platform/issues/1142)) ([4a22a38](https://github.com/Vectreal/vectreal-platform/commit/4a22a38c92d033b61818811c45dd159dd2269af7))
* **api:** create projects for agents with idempotency keys and an audit row ([#1135](https://github.com/Vectreal/vectreal-platform/issues/1135)) ([9964ce0](https://github.com/Vectreal/vectreal-platform/commit/9964ce0cf00015302e31e1f64c00659f5949428d))
* **api:** embed keys, allowed domains and the scene embed for agents ([#1148](https://github.com/Vectreal/vectreal-platform/issues/1148)) ([2e88742](https://github.com/Vectreal/vectreal-platform/commit/2e887427744ed37b43e3d3d5aadad083bbd5ff4c))
* **api:** list projects for agents through one v1 request gate ([#1094](https://github.com/Vectreal/vectreal-platform/issues/1094)) ([e82bcc8](https://github.com/Vectreal/vectreal-platform/commit/e82bcc899d63256a6404570c60141081a39d56cc))
* **api:** publish and unpublish scenes for agents ([#1143](https://github.com/Vectreal/vectreal-platform/issues/1143)) ([285f1dd](https://github.com/Vectreal/vectreal-platform/commit/285f1dd77bf2b1ec0b96acb5542cd08f6e6a4fbd))
* **api:** v1 scene listing and scene settings read and update ([#1173](https://github.com/Vectreal/vectreal-platform/issues/1173)) ([3cd90e0](https://github.com/Vectreal/vectreal-platform/commit/3cd90e02f3c0aeade96d3b93c53d0dde8c2c3d08))
* **cli:** vectreal login, logout, whoami and init ([#1161](https://github.com/Vectreal/vectreal-platform/issues/1161)) ([e890607](https://github.com/Vectreal/vectreal-platform/commit/e890607ed309a0043b041ce8d1f850bad0051353))
* **cli:** vectreal mcp, a stdio MCP server over one operations module ([#1174](https://github.com/Vectreal/vectreal-platform/issues/1174)) ([d476f1b](https://github.com/Vectreal/vectreal-platform/commit/d476f1b5d691d730539c121007eeadd488043c8d))
* publish @vctrl/sdk and @vctrl/cli to npm ([#1180](https://github.com/Vectreal/vectreal-platform/issues/1180)) ([f2384cd](https://github.com/Vectreal/vectreal-platform/commit/f2384cdedd5006cdde2f283531ea001908305b75))
* **sdk:** own the v1 contract in a private @vctrl/sdk package ([#1084](https://github.com/Vectreal/vectreal-platform/issues/1084)) ([420732a](https://github.com/Vectreal/vectreal-platform/commit/420732ac65e1b7a7ec6c8bc91cb08f058044c182))


### Bug Fixes

* **scene:** validate bounds, controls, environment, shadows and normalization on every save ([#1164](https://github.com/Vectreal/vectreal-platform/issues/1164)) ([20ec64a](https://github.com/Vectreal/vectreal-platform/commit/20ec64ac25ee09cf4403e0fd9b1c679f1269b140))
