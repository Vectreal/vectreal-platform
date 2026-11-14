# Changelog

## [3.5.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v3.4.0...sdk-v3.5.0) (2026-11-14)


### Features

* **cli:** make cameras and hotspots writable through update_scene_settings ([#1288](https://github.com/Vectreal/vectreal-platform/issues/1288)) ([540b469](https://github.com/Vectreal/vectreal-platform/commit/540b469292818708e8fc1f7159007b880107b8e8))
* load environment maps compressed as gain map JPEGs ([#1315](https://github.com/Vectreal/vectreal-platform/issues/1315)) ([619e7c6](https://github.com/Vectreal/vectreal-platform/commit/619e7c650c20813d4826b286c215db8be256e3b7))
* **viewer:** accessible name, keyboard orbit and zoom, still auto-rotate under reduced motion ([#1290](https://github.com/Vectreal/vectreal-platform/issues/1290)) ([0683046](https://github.com/Vectreal/vectreal-platform/commit/06830460e14d29766378ce571f9a7f1c152f426f))
* **viewer:** double-click or double-tap to focus ([#1292](https://github.com/Vectreal/vectreal-platform/issues/1292)) ([a5935a7](https://github.com/Vectreal/vectreal-platform/commit/a5935a7b89b325debd1645dd2d8e864b72b8fe3b))
* **viewer:** first-time interaction hint and How to move in the info popover ([#1309](https://github.com/Vectreal/vectreal-platform/issues/1309)) ([c6d36f7](https://github.com/Vectreal/vectreal-platform/commit/c6d36f7be4ec989cf08c468b3f4f7f1d81c37a7b))
* **viewer:** no bare stage when a scene scrolls back into view, and Unload when off-screen as a publish setting ([#1347](https://github.com/Vectreal/vectreal-platform/issues/1347)) ([0df7936](https://github.com/Vectreal/vectreal-platform/commit/0df7936b7a65ea25a1bcb9eff04401174f067851))
* **viewer:** one typed message catalog for the viewer's words, each language loaded only when shown ([#1348](https://github.com/Vectreal/vectreal-platform/issues/1348)) ([55eed3a](https://github.com/Vectreal/vectreal-platform/commit/55eed3a5151742cddfe56ac1524f017ec4846a9b))
* **viewer:** optional full screen button for published scenes ([#1291](https://github.com/Vectreal/vectreal-platform/issues/1291)) ([4795e89](https://github.com/Vectreal/vectreal-platform/commit/4795e8939d570f9f2087362481e5781b22c34f0c))
* **viewer:** tap to activate, chosen per scene in Publish &gt; Viewer ([#1344](https://github.com/Vectreal/vectreal-platform/issues/1344)) ([0c1e1f5](https://github.com/Vectreal/vectreal-platform/commit/0c1e1f5e7b4ae18e35d2177526454522c2c23add))


### Bug Fixes

* **api:** answer every v1 refusal in the coded envelope ([#1375](https://github.com/Vectreal/vectreal-platform/issues/1375)) ([15aaf2f](https://github.com/Vectreal/vectreal-platform/commit/15aaf2fe2526321c582f4538958a73e6c9596434))
* **api:** hold camera writes to the core camera schema, and repair stored cameras on every read a client sends back ([#1392](https://github.com/Vectreal/vectreal-platform/issues/1392)) ([a418311](https://github.com/Vectreal/vectreal-platform/commit/a418311ee4e0dd439c80a7667066ed3558c356bb))

## [3.4.0](https://github.com/Vectreal/vectreal-platform/compare/sdk-v3.3.0...sdk-v3.4.0) (2026-11-04)


### Miscellaneous Chores

* **sdk:** Synchronize vectreal-monorepo versions

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
