# Changelog

## [0.18.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.17.0...workspace-v0.18.0) (2026-04-30)


### Features

* add camera transition and snapshot functionality ([#435](https://github.com/Vectreal/vectreal-platform/issues/435)) ([da2de12](https://github.com/Vectreal/vectreal-platform/commit/da2de12c51376877b1cbf6e87066383024aff78a))
* add Truchet tile mosaic thumbnail generator for articles ([#427](https://github.com/Vectreal/vectreal-platform/issues/427)) ([65bc727](https://github.com/Vectreal/vectreal-platform/commit/65bc727782697be4a1034c4f990e6768268df3d4))
* enhance UI components with improved animations and accessibility features ([#420](https://github.com/Vectreal/vectreal-platform/issues/420)) ([291bb74](https://github.com/Vectreal/vectreal-platform/commit/291bb744b356090ccc35bc6e0d649f71a5d36e83))
* publisher dropzone loading indicators via useNavigation and useTransition ([#417](https://github.com/Vectreal/vectreal-platform/issues/417)) ([e9a4ef7](https://github.com/Vectreal/vectreal-platform/commit/e9a4ef79dfa1d9bd348d2650eb1ef590c04f82ed))
* update cover and thumbnail images for launch article and publisher walkthrough ([#429](https://github.com/Vectreal/vectreal-platform/issues/429)) ([b514185](https://github.com/Vectreal/vectreal-platform/commit/b514185334c0eb9404e295dd071898175b6e4652))


### Bug Fixes

* improve layout and styling of OptimizationModal component ([#421](https://github.com/Vectreal/vectreal-platform/issues/421)) ([dd16ede](https://github.com/Vectreal/vectreal-platform/commit/dd16ede1eb7360de90bfa7287629ed728746ab6d))
* preserve dirty state during concurrent saves and post-save navigation ([#416](https://github.com/Vectreal/vectreal-platform/issues/416)) ([f9a9721](https://github.com/Vectreal/vectreal-platform/commit/f9a972168f97086746c4ca97f64ce2f8ffab3301))

## [0.17.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.16.2...workspace-v0.17.0) (2026-04-13)


### Features

* add vectreal-brand-ux-design and vectreal-extension-architecture skills documentation ([#400](https://github.com/Vectreal/vectreal-platform/issues/400)) ([a891cec](https://github.com/Vectreal/vectreal-platform/commit/a891cec048427c8c9c17b97cbddaebd1b8858f7b))
* update dashboard action buttons and sidebar links ([#403](https://github.com/Vectreal/vectreal-platform/issues/403)) ([c144470](https://github.com/Vectreal/vectreal-platform/commit/c1444705dce5bd9a625880d0a8d9535f240aa353))

## [0.16.2](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.16.1...workspace-v0.16.2) (2026-04-12)


### Bug Fixes

* set frameloop to always for consistent rendering in VectrealViewer ([#396](https://github.com/Vectreal/vectreal-platform/issues/396)) ([53475a4](https://github.com/Vectreal/vectreal-platform/commit/53475a4263706d80db8a3b75957f56d7342f8052))
* update npm registry URL and add missing built dependencies in workspace configuration ([#394](https://github.com/Vectreal/vectreal-platform/issues/394)) ([575620c](https://github.com/Vectreal/vectreal-platform/commit/575620c65dac8a9e408c735116df2c622e3ee3a1))

## [0.16.1](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.16.0...workspace-v0.16.1) (2026-04-11)


### Bug Fixes

* correct output reference for root release creation in CI workflow ([#390](https://github.com/Vectreal/vectreal-platform/issues/390)) ([22b9179](https://github.com/Vectreal/vectreal-platform/commit/22b91796a710b744affbf1aa9f0ab8138652a2eb))

## [0.16.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.15.0...workspace-v0.16.0) (2026-04-11)


### Features

* **posthog:** add support for PostHog UI host in environment configuration and deployment scripts ([#379](https://github.com/Vectreal/vectreal-platform/issues/379)) ([83ca6e6](https://github.com/Vectreal/vectreal-platform/commit/83ca6e6fde42b169b1bf9cf5beef46251eda26db))
* refactor publisher sidebar components and enhance post-processing options ([#387](https://github.com/Vectreal/vectreal-platform/issues/387)) ([d79a062](https://github.com/Vectreal/vectreal-platform/commit/d79a062f7fd83b3cd34ec579415eb3484438f331))
* refactor publisher sidebar components and enhance post-processing options ([#388](https://github.com/Vectreal/vectreal-platform/issues/388)) ([620e17a](https://github.com/Vectreal/vectreal-platform/commit/620e17a53281721afcbf913c0604471abc317435))
* remove ground configuration and related components from environ… ([#386](https://github.com/Vectreal/vectreal-platform/issues/386)) ([55f65ad](https://github.com/Vectreal/vectreal-platform/commit/55f65ad9230be108e85fc3c3b717821674f3f16b))


### Bug Fixes

* enhance scene bootstrap logic to handle file model presence and ensure initialization completion ([#383](https://github.com/Vectreal/vectreal-platform/issues/383)) ([ff4a7c8](https://github.com/Vectreal/vectreal-platform/commit/ff4a7c8e7933d8c86baa83c278462d29fe359aa5))

## [0.15.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.14.0...workspace-v0.15.0) (2026-04-08)


### Features

* **auth:** implement rate limiting for sign-in and sign-up actions ([#376](https://github.com/Vectreal/vectreal-platform/issues/376)) ([b4b1eba](https://github.com/Vectreal/vectreal-platform/commit/b4b1eba20a2ed36ee5e5ee12fa4cf540439e14c1))
* **contact:** implement contact form, webhook processing, and security hardening ([#370](https://github.com/Vectreal/vectreal-platform/issues/370)) ([4c92039](https://github.com/Vectreal/vectreal-platform/commit/4c920399f7531bd1c196407076403bcb8e5809e3))


### Bug Fixes

* **dashboard:** simplify layout structure by removing unnecessary divs ([#369](https://github.com/Vectreal/vectreal-platform/issues/369)) ([64ba8f8](https://github.com/Vectreal/vectreal-platform/commit/64ba8f8a18e9f436e514553f20c14ff9a3fb4116))
* **dashboard:** simplify layout structure by removing unnecessary divs ([#371](https://github.com/Vectreal/vectreal-platform/issues/371)) ([655395f](https://github.com/Vectreal/vectreal-platform/commit/655395fdb06dbfd06035bda83e9c40c6c7cc9019))

## [0.14.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.13.0...workspace-v0.14.0) (2026-04-07)


### Features

* add @swc-node/register dependency for improved TypeScript support ([9a9fe65](https://github.com/Vectreal/vectreal-platform/commit/9a9fe651f787d38956800bc5adc809a96a691514))
* add advanced optimization panel with toggle settings for quantization, deduplication, and normals optimization ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
* Add authentication callback route for handling OAuth code exchange ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* add autoComplete attributes to input fields in signup and signin pages ([b65fcd2](https://github.com/Vectreal/vectreal-platform/commit/b65fcd27ed03d2ca9e5f02e47971b9907bd20c29))
* add billing dashboard route and loader ([51fdba7](https://github.com/Vectreal/vectreal-platform/commit/51fdba742dca3713cfe0695898a8f54ff185a233))
* add billing upgrade and success pages, enhance pricing page with new components ([#349](https://github.com/Vectreal/vectreal-platform/issues/349)) ([71e1ab2](https://github.com/Vectreal/vectreal-platform/commit/71e1ab2f8cd24c2bcee29c9e043a864240e8b40c))
* add build arguments for CSRF secret, database URL, and Supabase credentials in Docker and CI workflows for prerender building ([c14f77a](https://github.com/Vectreal/vectreal-platform/commit/c14f77a1ad774f210de8af82a3d7f618d59ca978))
* add build-and-push-image input to shared deployment workflow and update related conditions ([7334df0](https://github.com/Vectreal/vectreal-platform/commit/7334df066956d260c11c89fad22b112f9a7ed0f0))
* add build-ci target for CI-specific build commands in project configuration ([c82e701](https://github.com/Vectreal/vectreal-platform/commit/c82e701fc5e8c6f506dd2939f255777fd7b9226d))
* Add camera controls settings panel and enhance shadow settings configuration ([b552f6e](https://github.com/Vectreal/vectreal-platform/commit/b552f6ebc5f0cf552b5265d90cf3e850be56d8f2))
* add CI/CD workflows for Chromatic, package release, and Google Cloud deployment; refactor shared deployment logic ([fc865cf](https://github.com/Vectreal/vectreal-platform/commit/fc865cfe31cb3420cf972da002bd257c944b663e))
* add documentation links and improve footer with rotating text; enhance home page with FAQ section ([9c54eec](https://github.com/Vectreal/vectreal-platform/commit/9c54eec28837879acabda00e1673915ccf33afe2))
* add EPIC-1 product contracts PRD and Copilot agent configuration ([fa5d645](https://github.com/Vectreal/vectreal-platform/commit/fa5d64537f450ab6e450fcbaeddaecc3979aae98))
* Add GitHub App release identity and update release workflow configuration ([#330](https://github.com/Vectreal/vectreal-platform/issues/330)) ([c80cb95](https://github.com/Vectreal/vectreal-platform/commit/c80cb951545f235b737176bc78a4d9597632fbd4))
* add Google Cloud Storage integration and update dependencies ([f7e5a16](https://github.com/Vectreal/vectreal-platform/commit/f7e5a16a6ce067286fd4a2f11333f3aba48fadd6))
* Add Google logo SVG asset ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Add GridBg component and integrate it into the HomePage; enhance scene bounds and camera options in VectrealViewer ([8c1dc8d](https://github.com/Vectreal/vectreal-platform/commit/8c1dc8da997b774314e83468fe7cf6248baada84))
* Add migration journal for version 7 with security hardening and migrations ([2ce9194](https://github.com/Vectreal/vectreal-platform/commit/2ce9194abffcc4c78bfb8f5915bd9fbd416ef303))
* add mobile detection to loader and pass to OverlayControls ([e4eadef](https://github.com/Vectreal/vectreal-platform/commit/e4eadefeae31f20d0ab0b49f360e3a521eb9cbc9))
* add model exporter, loader, and optimizer modules as core package ([3725193](https://github.com/Vectreal/vectreal-platform/commit/372519345f5cd6d3d0be4011e7addd23e947202e))
* Add new project creation page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* add new texture size option and enhance optimization panel ([f67f823](https://github.com/Vectreal/vectreal-platform/commit/f67f8237507b9caeb5dc0c9e1c25cfab2c6742a4))
* add news room layout and pages, including article and listing functionality ([964347c](https://github.com/Vectreal/vectreal-platform/commit/964347cee67c1ca5e5940083c2e341725f994d68))
* add news room layout and pages, including article and listing functionality ([3e2c6ea](https://github.com/Vectreal/vectreal-platform/commit/3e2c6ea5f13b468c885329f10b204b51d30a4fa1))
* add onboarding flow, docs site (/docs), and update READMEs ([9db1688](https://github.com/Vectreal/vectreal-platform/commit/9db1688ad51a9c568b5bd71b75c32dc53ddf176e))
* add organization management features and written confirmation modal ([#341](https://github.com/Vectreal/vectreal-platform/issues/341)) ([15366a6](https://github.com/Vectreal/vectreal-platform/commit/15366a61cae778d5821ed6e39aec96ae36f4d004))
* add platform app ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
* add privacy policy and terms of service pages; implement global and MDX styles ([38022e6](https://github.com/Vectreal/vectreal-platform/commit/38022e6be2f392bf47f937dfbd0e3e169bf528ab))
* add project and scene table columns, error boundary, global navigation loader, and skeleton loaders ([1cd169b](https://github.com/Vectreal/vectreal-platform/commit/1cd169b8c7d3cdf6103a79d6fdf83f8c96f9d5a2))
* add project edit route reusing creation drawer ([5a858d1](https://github.com/Vectreal/vectreal-platform/commit/5a858d1d302349fa192db22b8e024795a3f289bf))
* add publish sidebar components for embedding, saving, and sharing scenes ([c846642](https://github.com/Vectreal/vectreal-platform/commit/c846642585db690738d5a8a11a29981750ff9d23))
* Add publisher buttons for 3D model processing ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Add release-please configuration and manifest for package publishing ([3dab8d3](https://github.com/Vectreal/vectreal-platform/commit/3dab8d3044f4e836e24a2e54ad2679484e932ea9))
* Add release-please configuration and manifest for package publishing ([8fdc57b](https://github.com/Vectreal/vectreal-platform/commit/8fdc57baa84c912d2ae4da3316870ad2afedd5bf))
* add routeDiscovery configuration to react-router setup ([30759e5](https://github.com/Vectreal/vectreal-platform/commit/30759e5aac24947518eb0af8e0bc264c30636e32))
* add SaveButton component and integrate scene saving functionality ([df2657f](https://github.com/Vectreal/vectreal-platform/commit/df2657f982d7e0b1a75159d165b57e9bbdedd40e))
* add scene asset utilities for URI normalization, MIME type detection, and base64 handling ([d81826d](https://github.com/Vectreal/vectreal-platform/commit/d81826d4c8d416ac4e187d3300c5aa6d4eae4a0a))
* add scene metadata update functionality and enhance scene details UI ([58d0187](https://github.com/Vectreal/vectreal-platform/commit/58d01876a43c6dee1c087317873678083080d651))
* add scene preview repository and update routes for scene previews ([7a98a0d](https://github.com/Vectreal/vectreal-platform/commit/7a98a0d8f85fa368429a384902af63ffffafc470))
* add scene thumbnail capture and loading thumbnail support in viewer ([5f97695](https://github.com/Vectreal/vectreal-platform/commit/5f9769547a96fc60c62dfbc497baa25747d1ff45))
* add scene thumbnail capture and loading thumbnail support in viewer ([c295065](https://github.com/Vectreal/vectreal-platform/commit/c2950657ea8fcf137afeb1913ca5510019ab19e8))
* Add social sign-in route for Google and GitHub authentication ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* add Stripe dependency for billing integration ([f06a55b](https://github.com/Vectreal/vectreal-platform/commit/f06a55bab250002518e18a282a772393db9d24fd))
* Add Terraform configurations for Vectreal Platform on Google Cloud ([#150](https://github.com/Vectreal/vectreal-platform/issues/150)) ([fd86ffd](https://github.com/Vectreal/vectreal-platform/commit/fd86ffd2115640ddfbb3c7ba06cf7f61e058c9d3))
* add type-check step to CI workflow and enhance project configuration ([a41b2d0](https://github.com/Vectreal/vectreal-platform/commit/a41b2d05c41531df6f4791584aa729fe53d17082))
* add UI components ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
* add useAuthResumeRevalidation hook for improved session revalidation in layouts ([d21d017](https://github.com/Vectreal/vectreal-platform/commit/d21d017e28b6d9d8f4752c27de4d78e4afd542ea))
* add various asset files including icons, manifest, and browser config for improved web app support ([a53bc24](https://github.com/Vectreal/vectreal-platform/commit/a53bc2417c05626b25ffbfbc338bf824b5c62981))
* Add view transitions to various dashboard and project links for improved navigation experience ([7d9c1fb](https://github.com/Vectreal/vectreal-platform/commit/7d9c1fbdcbe08ce0b967e892cc47eeea44b3f21b))
* adjust scene details skeleton layout for improved responsiveness ([2988b8f](https://github.com/Vectreal/vectreal-platform/commit/2988b8fd8c11a0c5b6cf63aa95b177ab1866bffb))
* **api-keys:** add API key management functionality ([3ad1301](https://github.com/Vectreal/vectreal-platform/commit/3ad1301b8583a272f40c51efa0d50ea2e094eea0))
* **api-keys:** add API key management functionality ([6ee98f6](https://github.com/Vectreal/vectreal-platform/commit/6ee98f6eeda3618f85572de245be5cb200d49b81))
* **api:** add existingAssetIds parameter to CreateSceneSettingsParams interface ([e1f86b4](https://github.com/Vectreal/vectreal-platform/commit/e1f86b45f5b56850715408512ef5d9c7cc0675f9))
* **apps/official-website:** add color picker hex value input ([41812d5](https://github.com/Vectreal/vectreal-platform/commit/41812d5f436e5bd195f010f57d7c67db0dbec48d))
* **apps/official-website:** enable offline Google Analytics in Vite config ([9b25a2f](https://github.com/Vectreal/vectreal-platform/commit/9b25a2f4e658d7ea4bd770a5ab85a98e3fc45cf7))
* **apps/official-website:** integrate texture compression optimization ([c3933d3](https://github.com/Vectreal/vectreal-platform/commit/c3933d335b47d3abd9e43a1713d25b8aacfe4891))
* **apps/official-website:** move ga initialization to `base-layout` & add custom event tracking ([660e847](https://github.com/Vectreal/vectreal-platform/commit/660e84774d62c23f8f5358060872a722fa85755c))
* **apps/official-website:** unify optimization handler in editor file-menu ([714197e](https://github.com/Vectreal/vectreal-platform/commit/714197e1b575ec616566da13d2580cb30d4574cf))
* **billing:** EPIC-2 billing and entitlement data model foundation ([98e8f06](https://github.com/Vectreal/vectreal-platform/commit/98e8f069b4bdd139d6f2129f109a15ef5a37088c))
* Build project page with content overview ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* Create a basic dashboard page component ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Create folder page for project organization ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* Create logout route to handle user sign-out ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Create sign-in layout with social login options ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Create sign-up page with username, email, and password registration ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Create Supabase client for server-side requests ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* **dashboard:** refactor component imports and enhance dashboard layout with new features ([#364](https://github.com/Vectreal/vectreal-platform/issues/364)) ([f3c782b](https://github.com/Vectreal/vectreal-platform/commit/f3c782bf1f9c2fb84b63e6e9566c3ffe1d1e1150))
* Develop projects overview page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* enable cross-tab draft restoration with draft ID in auth redirects ([1753ccf](https://github.com/Vectreal/vectreal-platform/commit/1753ccf1ca429e3cd72a8ec9de5a3d00b0763d3f))
* enable cross-tab draft restoration with draft ID in auth redirects ([8133333](https://github.com/Vectreal/vectreal-platform/commit/8133333f0332829d47c130f07156ae6920749e83))
* enhance about page content and improve styling for better readability ([6148b15](https://github.com/Vectreal/vectreal-platform/commit/6148b1500b9e306b9231a7ccc04a16cc7eadf761))
* enhance asset display in scene page with collapsible section and embed options ([#353](https://github.com/Vectreal/vectreal-platform/issues/353)) ([64e9af4](https://github.com/Vectreal/vectreal-platform/commit/64e9af44f2f760c62ac7bd1644b64745ce32ea5b))
* enhance asset handling by integrating asset normalization and lookup functionality ([571eabf](https://github.com/Vectreal/vectreal-platform/commit/571eabf01865afb0d1a86014119bdc06ca9a32ec))
* enhance asset handling by integrating asset normalization and lookup functionality ([a802fee](https://github.com/Vectreal/vectreal-platform/commit/a802fee7fb28b8624928fe0bdf124852fb2e476b))
* enhance breadcrumb functionality with folder ancestry support ([8c7d75d](https://github.com/Vectreal/vectreal-platform/commit/8c7d75d9d3d45bfb168c2f1188079f8f07f40ae8))
* enhance camera configuration and management across scene components ([fd218e6](https://github.com/Vectreal/vectreal-platform/commit/fd218e69bf476dd2011bba94f81f98a1b2ae51ff))
* enhance CI/CD workflows with quality gate and build steps ([b5ad615](https://github.com/Vectreal/vectreal-platform/commit/b5ad6156cb051d9b623f98a2b6ca589dbf5a89f2))
* enhance CI/CD workflows with quality gate and build steps ([1b7030b](https://github.com/Vectreal/vectreal-platform/commit/1b7030be629b5bffdf5a95ae05893950f76fac68))
* enhance dashboard components with dynamic organization handling and layout improvements ([35840fd](https://github.com/Vectreal/vectreal-platform/commit/35840fd235c4361a2779239a2ed280a8bc45dd9d))
* enhance dashboard components with new StatCard and improved layouts ([567e914](https://github.com/Vectreal/vectreal-platform/commit/567e9140a92feca69b66488fe6861e3617f73a90))
* Enhance dashboard sidebar with recent projects and new links ([#338](https://github.com/Vectreal/vectreal-platform/issues/338)) ([5d7ac6b](https://github.com/Vectreal/vectreal-platform/commit/5d7ac6b2a8642be29d6774e49ed737c2eecab1d1))
* enhance dashboard with overview component and improved scene handling ([89ac1af](https://github.com/Vectreal/vectreal-platform/commit/89ac1afe37e750add3475b68cce2414572a88a3d))
* enhance DataTable cell title handling and improve project data transformation logic to avoid hydration mismatch ([b0b8b6a](https://github.com/Vectreal/vectreal-platform/commit/b0b8b6aeca3dfb10e231c003bc9d92bd2d8a5477))
* enhance deployment workflows and configurations for Cloud Run services, add caching and access control improvements ([249da35](https://github.com/Vectreal/vectreal-platform/commit/249da3514d827c1268fd52ef9989b22743f42b8a))
* enhance embed options with domain validation and UI improvements ([40ca015](https://github.com/Vectreal/vectreal-platform/commit/40ca0152a50ea1ac6cf2a963478f93e06b6e9e2d))
* Enhance environment settings panel with ground configuration and sliders ([2393a51](https://github.com/Vectreal/vectreal-platform/commit/2393a518149b87f232cf7c5d083e6f86f8b089b5))
* enhance footer component with dynamic styling and add animated logo prop ([648c8e4](https://github.com/Vectreal/vectreal-platform/commit/648c8e40a4a5665d3fe74f6fb2ae59a712fbd1f1))
* enhance InfoPopover and Overlay components with new stories and improved styles ([e34163a](https://github.com/Vectreal/vectreal-platform/commit/e34163a33ebb0a3fe1dd0bfc818316f168b2c94d))
* enhance model optimization and texture handling ([089f27a](https://github.com/Vectreal/vectreal-platform/commit/089f27a29a7f4160d1c2fd6b7c3c8e0a14941033))
* enhance model optimization and texture handling ([a98bb0c](https://github.com/Vectreal/vectreal-platform/commit/a98bb0c2fa6cfdf123835be7c093175b2ba1ae5b))
* enhance model optimization hooks and UI components ([e90bb5d](https://github.com/Vectreal/vectreal-platform/commit/e90bb5d009ed7f3559427f604d3096867a4cce90))
* Enhance navigation and layout components with user menu and sidebar integration ([0ca734e](https://github.com/Vectreal/vectreal-platform/commit/0ca734e807a4447217565442c676f7fbb504545a))
* enhance OverlayControls with dropdown actions and refactor side… ([e2ffc9e](https://github.com/Vectreal/vectreal-platform/commit/e2ffc9e05116a30df3026a588c2123d0aa592181))
* enhance OverlayControls with dropdown actions and refactor sidebar for user integration ([5676a0c](https://github.com/Vectreal/vectreal-platform/commit/5676a0ccb0ccc993dbb3f0b5e53134cd4718c0ca))
* enhance project and scene management with new folder creation and content actions ([93df463](https://github.com/Vectreal/vectreal-platform/commit/93df463fbd4c615d6c5e19bb3c9188b689654bb2))
* enhance project configuration with ESLint, Vite, and Drizzle setup ([2f520c6](https://github.com/Vectreal/vectreal-platform/commit/2f520c6f2e052b40d75b575224a23b6dec51a680))
* enhance publish sidebar with scene and project ID handling, improve embed options, and add validation for saving and publishing ([a7146fe](https://github.com/Vectreal/vectreal-platform/commit/a7146febdd7adf49714add09f9b367bcaffcf315))
* enhance save button functionality with availability states ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
* enhance scene and stats schemas with RLS policies and indexing ([186f319](https://github.com/Vectreal/vectreal-platform/commit/186f3190b733e24cbf5f0f3f8212372fa6198609))
* enhance scene asset utilities with improved MIME type handling and base64 normalization ([3f410b8](https://github.com/Vectreal/vectreal-platform/commit/3f410b871ecb23580e56a8b4d5f4feae3f547c31))
* enhance scene data handling with base64 encoding and optimize request management ([880007f](https://github.com/Vectreal/vectreal-platform/commit/880007feb3685b5849916dafe3aac2743b8123f2))
* enhance scene metadata handling and settings management ([8ffc99b](https://github.com/Vectreal/vectreal-platform/commit/8ffc99b2eabd7fd83c78c0b581c6cf8c7f7e1073))
* Enhance scene persistence and statistics tracking ([58735f6](https://github.com/Vectreal/vectreal-platform/commit/58735f6d8f1738630ab4d2e749f44ae77508a125))
* enhance shared components and utils, add mobile navigation for docs ([b424033](https://github.com/Vectreal/vectreal-platform/commit/b4240331d005009a424be6058fe4db152775b950))
* enhance Supabase client handling with error management for stale refresh tokens ([57f084b](https://github.com/Vectreal/vectreal-platform/commit/57f084bd6bd4d0ea9f41ec730a85170d2897243a))
* enhance Supabase client handling with error management for stale refresh tokens ([ea81e59](https://github.com/Vectreal/vectreal-platform/commit/ea81e59c60809b367897e753a4cc75dc7956dd19))
* enhance texture optimization API with new request structure and error handling ([6ac4d16](https://github.com/Vectreal/vectreal-platform/commit/6ac4d16b120c2178b22528d4d7045615e468982d))
* enhance viewer loading and model handling with improved state m… ([7ce3e42](https://github.com/Vectreal/vectreal-platform/commit/7ce3e42c6282fa479a5bbb6d64d3c8a00d36507f))
* enhance viewer loading and model handling with improved state management and transitions ([00871ee](https://github.com/Vectreal/vectreal-platform/commit/00871ee4da9c5efbef6b8d18d139c1c0904696f5))
* enhance viewer loading and model handling with improved state management and transitions ([8ef422d](https://github.com/Vectreal/vectreal-platform/commit/8ef422df7fe2092873856428f34a2ee8db6983e0))
* first-run onboarding wizard + /docs site with Edit on GitHub ([15c48d9](https://github.com/Vectreal/vectreal-platform/commit/15c48d94eec13df39ee2077745e6e8f3d2aaa3e4))
* **footer, mock-shop-section, home-page:** adjust layout for mobile and improve structure ([a36d574](https://github.com/Vectreal/vectreal-platform/commit/a36d57426d71d99d315634b8bd9d98b721b28960))
* Implement advanced and basic optimization panels with toggle settings ([8e0bad2](https://github.com/Vectreal/vectreal-platform/commit/8e0bad2eeefd9a97dd61603518645c91bf2dc0bd))
* implement apply optimizations button in the sidebar with loading state ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
* Implement Asset Storage Service for managing GLTF scene assets in Google Cloud Storage ([d0761bc](https://github.com/Vectreal/vectreal-platform/commit/d0761bc689fd74d3ffdf9d29ec606a6264237e61))
* Implement authentication context and hooks for user management ([267f546](https://github.com/Vectreal/vectreal-platform/commit/267f54655f12ddeb9bf1dadcba911f40b85e46fa))
* Implement authentication layout with user redirection ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* implement bulk delete functionality for projects and scenes with confirmation dialog ([6f19267](https://github.com/Vectreal/vectreal-platform/commit/6f192679faba775db309b784bc53cb452e16db54))
* implement bulk delete functionality for projects and scenes with confirmation dialog ([fb737e0](https://github.com/Vectreal/vectreal-platform/commit/fb737e0e215c6f67778ba6f012777bea5328dadb))
* implement CSRF protection and guest optimization quota management ([fcd2669](https://github.com/Vectreal/vectreal-platform/commit/fcd266987fcd41b123e801150a94e6cc96cd8dc6))
* implement CSRF protection and guest optimization quota management ([1d7a9a4](https://github.com/Vectreal/vectreal-platform/commit/1d7a9a48465a04e7dcfc4fd2458586860b00ba03))
* implement dashboard table state management and dialog handling ([edf76dc](https://github.com/Vectreal/vectreal-platform/commit/edf76dc689b01980ba8106bd0dde434f0aa017ef))
* Implement email OTP confirmation route for user sign-up ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* implement EPIC-3 Stripe billing integration ([bb27591](https://github.com/Vectreal/vectreal-platform/commit/bb275917b04f88cd9d5f1496f0764aadfcea9e79))
* Implement hook for capturing scene screenshots in 3D environment ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* implement pricing page, upgrade modal, limit enforcement, and billing settings ([3980abe](https://github.com/Vectreal/vectreal-platform/commit/3980abe415f8887d1b5b7dbf536f7da07d65257e))
* implement save location configuration for scene publishing and … ([89c8c68](https://github.com/Vectreal/vectreal-platform/commit/89c8c68fe8d95a0c10c7b2ee0481ff687eb62307))
* implement save location configuration for scene publishing and enhance scene settings handling ([514cacf](https://github.com/Vectreal/vectreal-platform/commit/514cacfde9da60737183a463765766ea032da69d))
* Implement scene detail page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* implement scene publication and revocation functionality ([cf4619f](https://github.com/Vectreal/vectreal-platform/commit/cf4619fbb324a2929bcf88c2ff10e1f139524ebe))
* Implement scene saving ([d292e95](https://github.com/Vectreal/vectreal-platform/commit/d292e9506efec4e3e2b3ba21c7fd0e46b1c9aeda))
* implement scene size initialization and optimize asset list ren… ([#352](https://github.com/Vectreal/vectreal-platform/issues/352)) ([3c7f3ae](https://github.com/Vectreal/vectreal-platform/commit/3c7f3ae5e6fcbdf1cd2a8b91b06f7d8e420fd85d))
* Implement sign-in page with email and password authentication ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* implement staging edge with CDN support and multi-region Cloud Run services ([431119a](https://github.com/Vectreal/vectreal-platform/commit/431119ace05f8e078190448f84b22a4271cf2cbc))
* Implement theme session management with cookie storage ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
* Implement user service for managing users, organizations, and projects ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
* implement utility functions for API responses and styling ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
* improve dashboard components and add scene details skeleton ([be252df](https://github.com/Vectreal/vectreal-platform/commit/be252df4ed3b843723d7de359a324be6510911e8))
* improve dashboard components and add scene details skeleton; update skeleton styles ([6bd686e](https://github.com/Vectreal/vectreal-platform/commit/6bd686e7b3d3e57c269000394d2a3c5e66d7d0c5))
* improve optimization sidebar with animations ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
* init platform app ([7601719](https://github.com/Vectreal/vectreal-platform/commit/7601719074a305aec443a7f71a95a3e9abfa222b))
* integrate Stripe secret keys for production and staging environments ([f7c135c](https://github.com/Vectreal/vectreal-platform/commit/f7c135c532775dc32c45eafcccffd3ba4bda4e42))
* integrate Stripe secret keys for production and staging environments ([d623999](https://github.com/Vectreal/vectreal-platform/commit/d62399905f03e5ce912dc9b9926a85924f6f6ba0))
* **official-website:** add hdr bluriness control to file-menu ([8a32492](https://github.com/Vectreal/vectreal-platform/commit/8a324929d354dbe3038c89ae1bf94c0d625e1c83))
* **official-website:** rework the reports modal of the editor ([1808e07](https://github.com/Vectreal/vectreal-platform/commit/1808e07c82e67bde74aebf5aa80dff87b5d518ee))
* **onboarding:** enhance onboarding experience with new visuals and steps ([#362](https://github.com/Vectreal/vectreal-platform/issues/362)) ([ca0fdca](https://github.com/Vectreal/vectreal-platform/commit/ca0fdcac10d97293b64a9c80bbb4640e4af92145))
* Optimize Docker build process with multi-stage builds and stati… ([42c7df3](https://github.com/Vectreal/vectreal-platform/commit/42c7df32bf19c503b153920baea0ce2e2b4fdf27))
* Optimize Docker build process with multi-stage builds and static asset handling ([4378d55](https://github.com/Vectreal/vectreal-platform/commit/4378d55856666cc6bafab2a7e2439d7eccb56304))
* Optimize GLTF loading and model transformation processes for improved performance ([8060d9d](https://github.com/Vectreal/vectreal-platform/commit/8060d9ddd24651a0bac11058b5df563228f4a9bd))
* **packages/hooks:** add tetxure compression optimization ([41555ad](https://github.com/Vectreal/vectreal-platform/commit/41555ad10d6a25d01b02ea943e57eaaeafd7d90c))
* **packages/hooks:** optimize model and add normals optimization ([6f0bde1](https://github.com/Vectreal/vectreal-platform/commit/6f0bde1c5a47b9be555405f547cc186749c581fc))
* **packages/viewer:** add info popover to display additional info ([5547fb1](https://github.com/Vectreal/vectreal-platform/commit/5547fb1934f08f3ee2fc907e975c77006a176f36))
* **packages/viewer:** enhance Storybook configuration with deep controls and auto-generated documentation ([7df00eb](https://github.com/Vectreal/vectreal-platform/commit/7df00eb30a83c747109b79c5234f6a17791946d1))
* **packages/viewer:** update peer dependencies, add Storybook configuration, implement robust styling and remove postcss config files ([df8359a](https://github.com/Vectreal/vectreal-platform/commit/df8359a4824d265282634267683e8e4b007f423d))
* **project:** added github actions and nx grouping to dependabot ([7ffc248](https://github.com/Vectreal/vectreal-platform/commit/7ffc2481f8499f9370e889b4f329e5e69c572747))
* **publisher-signup:** add signup flow with temporary scene save in indexedDB ([8a65726](https://github.com/Vectreal/vectreal-platform/commit/8a6572671a24320198ceaf7bbfdfb1240161b544))
* Refactor and enhance publisher settings components ([2a1eb68](https://github.com/Vectreal/vectreal-platform/commit/2a1eb687e157637d346a89f9ae97333e7265efcc))
* refactor authentication handling to use loadAuthenticatedSession and improve session management across dashboard routes ([e787c5d](https://github.com/Vectreal/vectreal-platform/commit/e787c5dd89f8855ff7af64289448f8e3763018b3))
* Refactor publisher layout and sidebar components ([2c43273](https://github.com/Vectreal/vectreal-platform/commit/2c43273b239a5d3f60de1d6b79cc417bea8154bf))
* refactor publisher sidebar components; replace PublishDrawer with PublishSidebar, add DynamicSidebar, and update related imports ([#351](https://github.com/Vectreal/vectreal-platform/issues/351)) ([1c5a679](https://github.com/Vectreal/vectreal-platform/commit/1c5a679cd810de166c07046bcd1c4a2611bea8f7))
* refactor scene and asset handling with improved type definitions and payload resolution ([99e743b](https://github.com/Vectreal/vectreal-platform/commit/99e743b574c158c79af151c1465eb957df7a350a))
* refactor scene and asset handling, improve loading logic and UI components ([31e02bc](https://github.com/Vectreal/vectreal-platform/commit/31e02bc3914666c714c2e8af07d8e816e72cd817))
* refactor scene metrics and details components; improve structure and responsiveness ([fb3a342](https://github.com/Vectreal/vectreal-platform/commit/fb3a34275236c7e53953cd345509c11a5238f8f1))
* Remove official-website in favor of vectreal-platform app ([e805770](https://github.com/Vectreal/vectreal-platform/commit/e805770e672100cb5c026e55f914587d543c3a27))
* Remove official-website in favor of vectreal-platform app ([#198](https://github.com/Vectreal/vectreal-platform/issues/198)) ([3c1019e](https://github.com/Vectreal/vectreal-platform/commit/3c1019ea1950ce1c99247c957e983078b563ce80))
* Remove settings components and integrate stepper functionality into publisher layout ([0cb3e8f](https://github.com/Vectreal/vectreal-platform/commit/0cb3e8fc59d9cc101c2d1b4008d5ebbbda8623a6))
* remove userId prop from PublishDrawer and SaveOptions components ([75c3e9d](https://github.com/Vectreal/vectreal-platform/commit/75c3e9d10ff0aaddfb27069a49d0fb0a605982fb))
* replace LoadingSpinner with CenteredSpinner in HeroScene and Model components ([678a20e](https://github.com/Vectreal/vectreal-platform/commit/678a20e82d4491be7122dbd60e467426f606a8e3))
* replace SceneNameInput with SceneNameAndLocation component; implement location state management ([#347](https://github.com/Vectreal/vectreal-platform/issues/347)) ([8d3a11a](https://github.com/Vectreal/vectreal-platform/commit/8d3a11a229308403f7ce50bee8b65a3a31bb8292))
* Reuse project creation drawer for editing at `/dashboard/projects/:projectId/edit` ([61879eb](https://github.com/Vectreal/vectreal-platform/commit/61879eb484a4c4c87ac131ec68bb94220b86f414))
* **scene-settings:** add type definitions for scene settings and optimization report; refactor createNewSettingsVersion parameters ([c55e126](https://github.com/Vectreal/vectreal-platform/commit/c55e126a3553eddb2e0e387f1a6b442946de55d6))
* **scene-settings:** refactor save and get scene settings operations; streamline validation and response handling ([7605fae](https://github.com/Vectreal/vectreal-platform/commit/7605fae57dbffda748d4cf062e059b35ec6131df))
* **scene-settings:** update optimizationReport type in SceneSettingsRequest and parser ([0158cf6](https://github.com/Vectreal/vectreal-platform/commit/0158cf6e5cd4afd1291f9348f9bf60c1d66c3273))
* update button labels for SignUpButton and PublisherButton components ([fb71bb3](https://github.com/Vectreal/vectreal-platform/commit/fb71bb370d50d1863a8a2c80964171b4e322c31f))
* update CI workflow to remove push triggers and enhance typecheck command in project configuration ([88822f7](https://github.com/Vectreal/vectreal-platform/commit/88822f71909cebaaf9c4d187b930c33e6de4da25))
* update CI workflows for improved naming consistency and add lint/typecheck job ([7faede1](https://github.com/Vectreal/vectreal-platform/commit/7faede13459b5da798d6fd37dc4abd684a5faef5))
* update CI workflows to trigger on workflow_run events and enhance deployment configurations ([0efb775](https://github.com/Vectreal/vectreal-platform/commit/0efb77516266a14129017e8124cd868195de64a3))
* update CI/CD workflows for improved deployment and quality checks ([30703ce](https://github.com/Vectreal/vectreal-platform/commit/30703ce2858700fbe18936f9f0b2081bea527a82))
* update CI/CD workflows for improved deployment and quality checks ([6ffadec](https://github.com/Vectreal/vectreal-platform/commit/6ffadeceae3db38b50597b0c06494f385a53f89a))
* update components configuration and add ButtonGroup component with variants ([4067aeb](https://github.com/Vectreal/vectreal-platform/commit/4067aebb455d521426aaaa8a688f79d3c420f203))
* update dashboard components for improved styling and performance ([088247b](https://github.com/Vectreal/vectreal-platform/commit/088247ba235c8b2988aed7510e0846d5cfd78b87))
* update embed options and API response handling for scene previews ([1c0eeea](https://github.com/Vectreal/vectreal-platform/commit/1c0eeeaea5ea6c711e61535c8b9a1f9b101fccca))
* update embed options and API response handling for scene previews ([aacf567](https://github.com/Vectreal/vectreal-platform/commit/aacf567be2cb6ebb7909c03faea4191b12476ea9))
* update FloatingPillWrapper styles and add LogIn icon to navigation ([920fb96](https://github.com/Vectreal/vectreal-platform/commit/920fb96084ef073d6ad755b54f5fd82147f18f0b))
* update FloatingPillWrapper styles and add LogIn icon to navigation ([64a1b0b](https://github.com/Vectreal/vectreal-platform/commit/64a1b0b8c79a6561183f9e73bf0e8b19754e65ae))
* Update GitHub secrets setup to use RELEASE_APP_PRIVATE_KEY_FILE and adjust paths ([#331](https://github.com/Vectreal/vectreal-platform/issues/331)) ([1eb9115](https://github.com/Vectreal/vectreal-platform/commit/1eb911566c44acec6dd600c395d0f1a1dbd770fc))
* Update Google Cloud Storage integration and environment configuration ([efa2675](https://github.com/Vectreal/vectreal-platform/commit/efa26754859f4e6cba17a37537a377d87e9ec1b0))
* update layout and styling for footer, hero background, and sections ([0e2fc15](https://github.com/Vectreal/vectreal-platform/commit/0e2fc15175596d94feed4e3db5b78c506554c6c5))
* Update News Room page layout and content for improved user engagement ([c18469c](https://github.com/Vectreal/vectreal-platform/commit/c18469c2aba301329744a934993412cb8cb983e1))
* Update News Room page layout and content for improved user engagement ([a6ce4b8](https://github.com/Vectreal/vectreal-platform/commit/a6ce4b8f8399a199a463d359fb1adbd16ad1fdab))
* Update package publishing process to use 'publish' target and add preflight checks ([ccfe373](https://github.com/Vectreal/vectreal-platform/commit/ccfe3736521555e3fd6f23334248dbc3251cbf98))
* update release-please configuration to include merge option for node-workspace plugin ([#342](https://github.com/Vectreal/vectreal-platform/issues/342)) ([50ced1e](https://github.com/Vectreal/vectreal-platform/commit/50ced1e2de57df804e4a9d1ef295160fc483ab1f))
* update scene details to use texture and mesh byte sizes, enhancing metrics display ([83ec1da](https://github.com/Vectreal/vectreal-platform/commit/83ec1da766ed1511af2520e87ed71470d09a4b4a))
* update scene loader to manage save availability ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
* update SceneShadows component to accept partial shadow configuration options ([0fd186a](https://github.com/Vectreal/vectreal-platform/commit/0fd186a71e6d87273a7fb7695e43a787edface0d))
* update staging deployment configuration to use europe-west3 region and enhance Cloud Run service definitions ([3c12a29](https://github.com/Vectreal/vectreal-platform/commit/3c12a29d7daa7e226477aa53757f80bd48e5fa54))
* update staging edge URL map to use backend service and add path rules for static assets ([da5753b](https://github.com/Vectreal/vectreal-platform/commit/da5753b3c621512c711aa482f97e33273e14c6f7))
* **viewer:** enhance canvas component with viewport detection and loading states ([542ce70](https://github.com/Vectreal/vectreal-platform/commit/542ce707225856c7704bfa1ce744b4322c4d42e8))
* **viewer:** implement InfoPopover component and integrate it into VectrealViewer; refactor overlay handling and loading states ([6d833dd](https://github.com/Vectreal/vectreal-platform/commit/6d833dd0809f1b018559b0d3d33244e98f46bf62))


### Bug Fixes

* add link to small vectreal logo ([04ac84c](https://github.com/Vectreal/vectreal-platform/commit/04ac84cae6bdb701f73ee7c30f3f5e74298cca8f))
* add link to small vectreal logo ([182de0c](https://github.com/Vectreal/vectreal-platform/commit/182de0ce696478322e846604e02122dfc2b05700))
* address code review — correct docs sourcePaths, icon semantics, personalised onboarding title ([b212794](https://github.com/Vectreal/vectreal-platform/commit/b212794ef5f99f1f160d439e0b3a0cfa13492687))
* address code review feedback - correct plan derivation, type assertion, Fragment key, and usage labels ([0a5b266](https://github.com/Vectreal/vectreal-platform/commit/0a5b26656667481175d84f7177fb9d390e2e4f03))
* address PR review feedback on reconcile endpoint ([fa99fd1](https://github.com/Vectreal/vectreal-platform/commit/fa99fd1e00ad103db1a8da1b9cdb897cf407d520))
* adjust CSS formatting for blockquote and pre elements for improved readability ([f4896bd](https://github.com/Vectreal/vectreal-platform/commit/f4896bd54c00119cddd1d24495735f3d2ac26d93))
* adjust ESLint configuration to ignore Storybook files and update Storybook main configuration ([a53bc24](https://github.com/Vectreal/vectreal-platform/commit/a53bc2417c05626b25ffbfbc338bf824b5c62981))
* Adjust routing for publisher layout to include optional sceneId parameter ([d0761bc](https://github.com/Vectreal/vectreal-platform/commit/d0761bc689fd74d3ffdf9d29ec606a6264237e61))
* Adjust shadow settings and post-processing effects in the viewer; refine scene settings store for better state management ([8c1dc8d](https://github.com/Vectreal/vectreal-platform/commit/8c1dc8da997b774314e83468fe7cf6248baada84))
* allow unauthenticated access for staging deployments ([8e80bea](https://github.com/Vectreal/vectreal-platform/commit/8e80bea8052b9326acec23f5dc22cf04b446bac3))
* **apps/official-website/editor:** fix accept pattern and remove webkitdirectory attribute ([7c0f653](https://github.com/Vectreal/vectreal-platform/commit/7c0f6538bdaddebbdc7cbc28a32d17746071643b))
* **apps/official-website/editor:** missing import for useState and improved loading state handling ([7b37f54](https://github.com/Vectreal/vectreal-platform/commit/7b37f54b64a33c707364ac77f920c15a0ee6c32f))
* **apps/official-website:** Editor Model loading ([c041f2a](https://github.com/Vectreal/vectreal-platform/commit/c041f2a2cf5c4864b3670faf394ad28db78b2f38))
* **apps/official-website:** remove dev check in ga hook ([2aecde4](https://github.com/Vectreal/vectreal-platform/commit/2aecde4f265b2e9f99207a465cc14e1ef7151ff5))
* **apps/official-website:** remove useInitGA hook from app component ([c5a7ec1](https://github.com/Vectreal/vectreal-platform/commit/c5a7ec18659f15cbcc6939df35657b5126bf8a94))
* **billing:** address PR review feedback on entitlements and schema constraints ([9a858fc](https://github.com/Vectreal/vectreal-platform/commit/9a858fc3d069fed374541f91ce057e50e85bead5))
* **billing:** apply second-pass reviewer feedback ([20c6413](https://github.com/Vectreal/vectreal-platform/commit/20c64133b8b47718cbc15d5d6a9e8090590b72f5))
* correct branch syntax in CI workflow for pull request triggers ([3bc4d8b](https://github.com/Vectreal/vectreal-platform/commit/3bc4d8b259bb9b7a3e4539f38d5aadae8788d8e4))
* correct CHANGELOG.md version ordering and add header anchor ([#348](https://github.com/Vectreal/vectreal-platform/issues/348)) ([f357cf0](https://github.com/Vectreal/vectreal-platform/commit/f357cf0fcf7df696e06558b71392413a7fb3bf10))
* correct search parameter handling and improve dependency array formatting ([bbd15c2](https://github.com/Vectreal/vectreal-platform/commit/bbd15c23430d7e4bd39fc9fdbd7bafab1ccc32dd))
* enhance dashboard content loading behavior ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
* global css reference in mdx css module ([ada18b3](https://github.com/Vectreal/vectreal-platform/commit/ada18b36543a28a6a641ca79ed89eccf8e8d3b2c))
* global css reference in mdx css module ([b2fbaf5](https://github.com/Vectreal/vectreal-platform/commit/b2fbaf52bbca60978525dc24d5ef900eb18b1c41))
* global css reference in mdx css module ([b94b5a9](https://github.com/Vectreal/vectreal-platform/commit/b94b5a9dadce3208235bf860d52975e0b176eaa3))
* imports in scene-settings-assets.server.ts ([b2d82f6](https://github.com/Vectreal/vectreal-platform/commit/b2d82f6b0b3149705ca3966d935645377609e576))
* improve health check logic for Cloud Run deployment ([3f2b6bc](https://github.com/Vectreal/vectreal-platform/commit/3f2b6bc0e92019fd7868d85d2f3fc985348a29eb))
* improve layout and styling in ScenePage component ([f3e4159](https://github.com/Vectreal/vectreal-platform/commit/f3e41599eda04aafe3708cbaddbe06813f0c97ce))
* improve layout and styling in Signin and Signup pages ([001f21e](https://github.com/Vectreal/vectreal-platform/commit/001f21e5017a45693e4fdc110e3778ea4a6d3429))
* improve redirect URL handling in social signin action ([2644b6b](https://github.com/Vectreal/vectreal-platform/commit/2644b6bf989ff14053f7d163594502b3be7e5d69))
* minor layout adjustments in scene name input and tooltip button ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
* **pacakges/official-website:** normalize action string for upload event ([94035cb](https://github.com/Vectreal/vectreal-platform/commit/94035cb35c6351ec22be8c9707111acf3a555847))
* **packages/hooks:** ensure buffers are converted to Uint8Array before adding to zip file ([4e1f99d](https://github.com/Vectreal/vectreal-platform/commit/4e1f99dcd54e45e2549df3ee6c0b3bda25b18a74))
* **packages/hooks:** loading of model buffer failed because of wrong types in development ([1c4e734](https://github.com/Vectreal/vectreal-platform/commit/1c4e7345984f1c751a04ea28b44d8151945dcafd))
* **packages/hooks:** optimize hook volumne + emission material extension registration ([6ec7915](https://github.com/Vectreal/vectreal-platform/commit/6ec79153d07d097df608d064ff0a16473a1fb1e7))
* **packages/viewer:** add 'storybook-addon-deep-controls' to ignoredDependencies in ESLint configuration ([bedcaf6](https://github.com/Vectreal/vectreal-platform/commit/bedcaf60a5f201d8f5ca63d35a40b8a5dac06fbf))
* **packages/viewer:** add manual dark mode support in VectrealViewer component using js ([aaf5a14](https://github.com/Vectreal/vectreal-platform/commit/aaf5a14cecfe3468f031a44aa5dab7d2025a6293))
* **packages/viewer:** adjust grid component to snap to bottom of model ([2e1a294](https://github.com/Vectreal/vectreal-platform/commit/2e1a294be481363310ac5abaa6e5c012041d780c))
* **packages/viewer:** adjust loading spinner styles ([286ccc7](https://github.com/Vectreal/vectreal-platform/commit/286ccc72ae7d6b043ca50f9182b7e6d821585161))
* **packages/viewer:** change tailwind styling to css modules styling ([273ec59](https://github.com/Vectreal/vectreal-platform/commit/273ec59d928e7f9018a36727860fa9d362e0cece))
* **packages/viewer:** dedup div with "vctrl-viewer" classname and add vctrl classnames to popover ([a00be5b](https://github.com/Vectreal/vectreal-platform/commit/a00be5b9186ad697d548d5b526af47bb04f29445))
* **packages/viewer:** default env preset + optional background color ([5ecc5d0](https://github.com/Vectreal/vectreal-platform/commit/5ecc5d0dd86afc24ecbc476d5a9599bee9223239))
* **packages/viewer:** disabled/stuttering SceneControls component ([361f6a1](https://github.com/Vectreal/vectreal-platform/commit/361f6a141499590dfe7b105b7a775bc64411dec8))
* **packages/viewer:** remove cross dependency to vctrl/hooks ([f150b31](https://github.com/Vectreal/vectreal-platform/commit/f150b310260f4461cc3bbffa50aaad1da255b679))
* **packages/viewer:** styling in info-popover component ([dfdd977](https://github.com/Vectreal/vectreal-platform/commit/dfdd97743943e5c1ffdcdc1166abe0978eb06b6c))
* **packages/viewer:** the clickable area of the info-popover footer ([de4c3d7](https://github.com/Vectreal/vectreal-platform/commit/de4c3d7bc17a6a36ac41b9121937478b218ceca2))
* **packages/viewer:** update className description and apply it to the outermost container ([3c5c3c1](https://github.com/Vectreal/vectreal-platform/commit/3c5c3c15238a16187ed8ae170d857786abb71ec8))
* **packages/viewer:** update CSS selectors for light and dark mode variables ([f1d43cd](https://github.com/Vectreal/vectreal-platform/commit/f1d43cd56dc267d35f508e585e5882d1bf0c5db9))
* **packages:** cross dependencies ([4fbe8b3](https://github.com/Vectreal/vectreal-platform/commit/4fbe8b3e07c09976758d7906a23a8780127b7479))
* **packages:** update dependencies in `package.json` with eslint nx plugin ([1eab9b7](https://github.com/Vectreal/vectreal-platform/commit/1eab9b718b821d3292d90e8b0e6ee1c3f72175b2))
* Potential fix for code scanning alert no. 8: Workflow does not contain permissions ([3463f31](https://github.com/Vectreal/vectreal-platform/commit/3463f31b6ce4a6ada30041133eed5c0b6bbc95be))
* **project:** tailwind setup for packages + apps ([3240e01](https://github.com/Vectreal/vectreal-platform/commit/3240e01232d044b1dedcc50ae2634849e8f4aeb3))
* **project:** update dependencies and remove obsolete entries ([356b1c4](https://github.com/Vectreal/vectreal-platform/commit/356b1c49d78dc1d3f78f1d358b1dddaec574622c))
* **project:** update postcss configuration in vite ([3dad878](https://github.com/Vectreal/vectreal-platform/commit/3dad878a62c9a63801c5ce26e184f4ed582ee6d9))
* Refactor CSRF origin checks to enhance security and support forwarded headers ([0b6f97d](https://github.com/Vectreal/vectreal-platform/commit/0b6f97d7a7f6cd29dd9c909fb1f18a0df595f5da))
* remove --skip-pooler option from Supabase link commands in project.json ([2e927a5](https://github.com/Vectreal/vectreal-platform/commit/2e927a528c8cd5923b059c907046309a188006c8))
* remove --skip-pooler option from Supabase link commands in project.json ([bd59e1e](https://github.com/Vectreal/vectreal-platform/commit/bd59e1e6ff88831450d7e4114297d865ca39bfc0))
* remove root path from cacheable public paths ([b8867dc](https://github.com/Vectreal/vectreal-platform/commit/b8867dcff951cbb64ceafc5f7bd99eadfb573d88))
* remove unnecessary blank line in EmptyProjectsState component ([069e70b](https://github.com/Vectreal/vectreal-platform/commit/069e70bc50f42ef82a0843b7e88b7375d77c2be6))
* reorder setup steps in CD workflow for pnpm to work ([2cb3735](https://github.com/Vectreal/vectreal-platform/commit/2cb3735fdd25da98c57e835aef0ecb3f96d2332d))
* reorder setup steps in CD workflow for pnpm to work ([2e0896e](https://github.com/Vectreal/vectreal-platform/commit/2e0896e716931b3ed1b4492486d7d3436e7a0e58))
* resolve TypeScript error for undefined url in quickLinks sidebar ([6dd3b0b](https://github.com/Vectreal/vectreal-platform/commit/6dd3b0baa14abbfe409cc2837d5eaeb31afeab08))
* resolve TypeScript error for undefined URL in quickLinks sidebar ([51d19ab](https://github.com/Vectreal/vectreal-platform/commit/51d19ab2ee1213827425e5c17d242283ddee1e26))
* **styles:** unify font family to 'DM Sans Variable' across components ([f241cf9](https://github.com/Vectreal/vectreal-platform/commit/f241cf9d7f532d0e272ca662a2d17d1ee3ec6414))
* **styles:** unify font family to 'DM Sans Variable' across components ([4f0ba88](https://github.com/Vectreal/vectreal-platform/commit/4f0ba880c63af986fb0ddb4cad598ea67feebad6))
* Update API key management messages and adjust plan limits in doc… ([#337](https://github.com/Vectreal/vectreal-platform/issues/337)) ([22e6a4b](https://github.com/Vectreal/vectreal-platform/commit/22e6a4bde82e60d8932faeef3a8155faaa321ea5))
* update concurrency group naming for deployment workflows ([d4c12dc](https://github.com/Vectreal/vectreal-platform/commit/d4c12dc7bae39aaf6ef2e5298932dc8e48d96aa4))
* update concurrency group naming for deployment workflows ([a374dd1](https://github.com/Vectreal/vectreal-platform/commit/a374dd12f78c18d6ad09ccb68155ddd4d02a1202))
* update decodeBase64ToUint8Array return type and improve asset data handling in reconstructGltfFiles ([3aa7170](https://github.com/Vectreal/vectreal-platform/commit/3aa71709268f386fd3b49f966fc4f88a15647a2c))
* update deployment conditions to trigger on push events in staging workflow ([249364d](https://github.com/Vectreal/vectreal-platform/commit/249364d13be1d0b9a8f11183a420d05e2e3d024c))
* update ESLint configuration to remove CSS linting and adjust VSCode settings ([04f56c7](https://github.com/Vectreal/vectreal-platform/commit/04f56c7d27fcfc816e4593a1a33b6d31574ad268))
* update ESLint configuration to remove CSS linting and adjust VSCode settings ([a82786f](https://github.com/Vectreal/vectreal-platform/commit/a82786fb3640df1992aac4a73374f23bfe405830))
* update homepage URLs and repository type in package.json files ([#343](https://github.com/Vectreal/vectreal-platform/issues/343)) ([b8d8c69](https://github.com/Vectreal/vectreal-platform/commit/b8d8c691cd632ee95e54708b76630d6194f4a06f))
* update loading spinner class and restore loadingThumbnail in LoadingWithThumbnail story ([010992a](https://github.com/Vectreal/vectreal-platform/commit/010992a5f920b824643a0910cbd7a2efb8963534))
* Update output paths in project.json to use 'vctrl' prefix ([9737edb](https://github.com/Vectreal/vectreal-platform/commit/9737edb73174db26ee788660fd1bf2d22aaf8d03))
* update release-please configuration to skip GitHub releases for core, hooks, and viewer packages ([#344](https://github.com/Vectreal/vectreal-platform/issues/344)) ([61dd7d7](https://github.com/Vectreal/vectreal-platform/commit/61dd7d76f27c8b6b351970abcc48928be70179da))
* Update repository URLs in package.json files to point to vectreal-platform ([07e2864](https://github.com/Vectreal/vectreal-platform/commit/07e28644fd331a3c85ce2bbde2dd8bac446546bf))
* update session secret handling for CSRF protection in production ([f3fb87d](https://github.com/Vectreal/vectreal-platform/commit/f3fb87dcbc596797f4d4c3cacbf35c35cfe658f7))
* update sidebar layout and add close button for better user experience ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
* update sidebar links and modify footer navigation ([c727090](https://github.com/Vectreal/vectreal-platform/commit/c7270909d746746eaf965f981834e93e178a6d74))
* update sidebar links and modify footer navigation ([c73c9a2](https://github.com/Vectreal/vectreal-platform/commit/c73c9a244c3ece60318cd0b7f58fa146c752cf86))
* update styles and layout for improved responsiveness and consist… ([8247a25](https://github.com/Vectreal/vectreal-platform/commit/8247a25b252032da041f8f24ec549d72de8f2071))
* update styles and layout for improved responsiveness and consistency ([2f5ac4e](https://github.com/Vectreal/vectreal-platform/commit/2f5ac4e2a00e399e35a237377c946a54e2930378))
* update types for optimization presets and ensure consistent prop usage ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
* URL param substitution in dashboard actions and match edit drawer fields ([3117919](https://github.com/Vectreal/vectreal-platform/commit/3117919b2e82a225373e5008cd1d725fac1c3ca1))
* **workflows:** update Chromatic workflow to ignore chore branches ([4f937a7](https://github.com/Vectreal/vectreal-platform/commit/4f937a76a52d0941aaeb70be4d0518e7795a62e8))


### Reverts

* remove release-please generated v0.14.0 changelog entry ([#366](https://github.com/Vectreal/vectreal-platform/issues/366)) ([4ef3b61](https://github.com/Vectreal/vectreal-platform/commit/4ef3b617e7b0a14fe5001b5371f67f2d65cdf819))

## [0.13.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.12.1...workspace-v0.13.0) (2026-04-07)


### Features

* add billing upgrade and success pages, enhance pricing page with new components ([#349](https://github.com/Vectreal/vectreal-platform/issues/349)) ([71e1ab2](https://github.com/Vectreal/vectreal-platform/commit/71e1ab2f8cd24c2bcee29c9e043a864240e8b40c))
* **dashboard:** refactor component imports and enhance dashboard layout with new features ([#364](https://github.com/Vectreal/vectreal-platform/issues/364)) ([f3c782b](https://github.com/Vectreal/vectreal-platform/commit/f3c782bf1f9c2fb84b63e6e9566c3ffe1d1e1150))
* enhance asset display in scene page with collapsible section and embed options ([#353](https://github.com/Vectreal/vectreal-platform/issues/353)) ([64e9af4](https://github.com/Vectreal/vectreal-platform/commit/64e9af44f2f760c62ac7bd1644b64745ce32ea5b))
* implement scene size initialization and optimize asset list ren… ([#352](https://github.com/Vectreal/vectreal-platform/issues/352)) ([3c7f3ae](https://github.com/Vectreal/vectreal-platform/commit/3c7f3ae5e6fcbdf1cd2a8b91b06f7d8e420fd85d))
* **onboarding:** enhance onboarding experience with new visuals and steps ([#362](https://github.com/Vectreal/vectreal-platform/issues/362)) ([ca0fdca](https://github.com/Vectreal/vectreal-platform/commit/ca0fdcac10d97293b64a9c80bbb4640e4af92145))
* refactor publisher sidebar components; replace PublishDrawer with PublishSidebar, add DynamicSidebar, and update related imports ([#351](https://github.com/Vectreal/vectreal-platform/issues/351)) ([1c5a679](https://github.com/Vectreal/vectreal-platform/commit/1c5a679cd810de166c07046bcd1c4a2611bea8f7))
* replace SceneNameInput with SceneNameAndLocation component; implement location state management ([#347](https://github.com/Vectreal/vectreal-platform/issues/347)) ([8d3a11a](https://github.com/Vectreal/vectreal-platform/commit/8d3a11a229308403f7ce50bee8b65a3a31bb8292))

## [0.12.1](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.12.0...workspace-v0.12.1) (2026-04-04)

### Bug Fixes

- update release-please configuration to skip GitHub releases for core, hooks, and viewer packages ([#344](https://github.com/Vectreal/vectreal-platform/issues/344)) ([61dd7d7](https://github.com/Vectreal/vectreal-platform/commit/61dd7d76f27c8b6b351970abcc48928be70179da))

## [0.12.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.11.1...workspace-v0.12.0) (2026-04-04)

### Features

- add organization management features and written confirmation modal ([#341](https://github.com/Vectreal/vectreal-platform/issues/341)) ([15366a6](https://github.com/Vectreal/vectreal-platform/commit/15366a61cae778d5821ed6e39aec96ae36f4d004))
- Enhance dashboard sidebar with recent projects and new links ([#338](https://github.com/Vectreal/vectreal-platform/issues/338)) ([5d7ac6b](https://github.com/Vectreal/vectreal-platform/commit/5d7ac6b2a8642be29d6774e49ed737c2eecab1d1))
- update release-please configuration to include merge option for node-workspace plugin ([#342](https://github.com/Vectreal/vectreal-platform/issues/342)) ([50ced1e](https://github.com/Vectreal/vectreal-platform/commit/50ced1e2de57df804e4a9d1ef295160fc483ab1f))

### Bug Fixes

- Update API key management messages and adjust plan limits in doc… ([#337](https://github.com/Vectreal/vectreal-platform/issues/337)) ([22e6a4b](https://github.com/Vectreal/vectreal-platform/commit/22e6a4bde82e60d8932faeef3a8155faaa321ea5))
- update homepage URLs and repository type in package.json files ([#343](https://github.com/Vectreal/vectreal-platform/issues/343)) ([b8d8c69](https://github.com/Vectreal/vectreal-platform/commit/b8d8c691cd632ee95e54708b76630d6194f4a06f))

## [0.11.1](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.11.0...workspace-v0.11.1) (2026-04-02)

### Bug Fixes

- Update repository URLs in package.json files to point to vectreal-platform ([07e2864](https://github.com/Vectreal/vectreal-platform/commit/07e28644fd331a3c85ce2bbde2dd8bac446546bf))

## [0.11.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.10.1...workspace-v0.11.0) (2026-04-02)

### Features

- Update package publishing process to use 'publish' target and add preflight checks ([ccfe373](https://github.com/Vectreal/vectreal-platform/commit/ccfe3736521555e3fd6f23334248dbc3251cbf98))

## [0.10.1](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.10.0...workspace-v0.10.1) (2026-04-02)

### Bug Fixes

- Update output paths in project.json to use 'vctrl' prefix ([9737edb](https://github.com/Vectreal/vectreal-platform/commit/9737edb73174db26ee788660fd1bf2d22aaf8d03))

## [0.10.0](https://github.com/Vectreal/vectreal-platform/compare/workspace-v0.9.5...workspace-v0.10.0) (2026-04-02)

### Features

- add @swc-node/register dependency for improved TypeScript support ([9a9fe65](https://github.com/Vectreal/vectreal-platform/commit/9a9fe651f787d38956800bc5adc809a96a691514))
- add advanced optimization panel with toggle settings for quantization, deduplication, and normals optimization ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
- Add authentication callback route for handling OAuth code exchange ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- add autoComplete attributes to input fields in signup and signin pages ([b65fcd2](https://github.com/Vectreal/vectreal-platform/commit/b65fcd27ed03d2ca9e5f02e47971b9907bd20c29))
- add billing dashboard route and loader ([51fdba7](https://github.com/Vectreal/vectreal-platform/commit/51fdba742dca3713cfe0695898a8f54ff185a233))
- add build arguments for CSRF secret, database URL, and Supabase credentials in Docker and CI workflows for prerender building ([c14f77a](https://github.com/Vectreal/vectreal-platform/commit/c14f77a1ad774f210de8af82a3d7f618d59ca978))
- add build-and-push-image input to shared deployment workflow and update related conditions ([7334df0](https://github.com/Vectreal/vectreal-platform/commit/7334df066956d260c11c89fad22b112f9a7ed0f0))
- add build-ci target for CI-specific build commands in project configuration ([c82e701](https://github.com/Vectreal/vectreal-platform/commit/c82e701fc5e8c6f506dd2939f255777fd7b9226d))
- Add camera controls settings panel and enhance shadow settings configuration ([b552f6e](https://github.com/Vectreal/vectreal-platform/commit/b552f6ebc5f0cf552b5265d90cf3e850be56d8f2))
- add CI/CD workflows for Chromatic, package release, and Google Cloud deployment; refactor shared deployment logic ([fc865cf](https://github.com/Vectreal/vectreal-platform/commit/fc865cfe31cb3420cf972da002bd257c944b663e))
- add documentation links and improve footer with rotating text; enhance home page with FAQ section ([9c54eec](https://github.com/Vectreal/vectreal-platform/commit/9c54eec28837879acabda00e1673915ccf33afe2))
- add EPIC-1 product contracts PRD and Copilot agent configuration ([fa5d645](https://github.com/Vectreal/vectreal-platform/commit/fa5d64537f450ab6e450fcbaeddaecc3979aae98))
- Add GitHub App release identity and update release workflow configuration ([#330](https://github.com/Vectreal/vectreal-platform/issues/330)) ([c80cb95](https://github.com/Vectreal/vectreal-platform/commit/c80cb951545f235b737176bc78a4d9597632fbd4))
- add Google Cloud Storage integration and update dependencies ([f7e5a16](https://github.com/Vectreal/vectreal-platform/commit/f7e5a16a6ce067286fd4a2f11333f3aba48fadd6))
- Add Google logo SVG asset ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Add GridBg component and integrate it into the HomePage; enhance scene bounds and camera options in VectrealViewer ([8c1dc8d](https://github.com/Vectreal/vectreal-platform/commit/8c1dc8da997b774314e83468fe7cf6248baada84))
- Add migration journal for version 7 with security hardening and migrations ([2ce9194](https://github.com/Vectreal/vectreal-platform/commit/2ce9194abffcc4c78bfb8f5915bd9fbd416ef303))
- add mobile detection to loader and pass to OverlayControls ([e4eadef](https://github.com/Vectreal/vectreal-platform/commit/e4eadefeae31f20d0ab0b49f360e3a521eb9cbc9))
- add model exporter, loader, and optimizer modules as core package ([3725193](https://github.com/Vectreal/vectreal-platform/commit/372519345f5cd6d3d0be4011e7addd23e947202e))
- Add new project creation page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- add new texture size option and enhance optimization panel ([f67f823](https://github.com/Vectreal/vectreal-platform/commit/f67f8237507b9caeb5dc0c9e1c25cfab2c6742a4))
- add news room layout and pages, including article and listing functionality ([964347c](https://github.com/Vectreal/vectreal-platform/commit/964347cee67c1ca5e5940083c2e341725f994d68))
- add news room layout and pages, including article and listing functionality ([3e2c6ea](https://github.com/Vectreal/vectreal-platform/commit/3e2c6ea5f13b468c885329f10b204b51d30a4fa1))
- add onboarding flow, docs site (/docs), and update READMEs ([9db1688](https://github.com/Vectreal/vectreal-platform/commit/9db1688ad51a9c568b5bd71b75c32dc53ddf176e))
- add platform app ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
- add privacy policy and terms of service pages; implement global and MDX styles ([38022e6](https://github.com/Vectreal/vectreal-platform/commit/38022e6be2f392bf47f937dfbd0e3e169bf528ab))
- add project and scene table columns, error boundary, global navigation loader, and skeleton loaders ([1cd169b](https://github.com/Vectreal/vectreal-platform/commit/1cd169b8c7d3cdf6103a79d6fdf83f8c96f9d5a2))
- add project edit route reusing creation drawer ([5a858d1](https://github.com/Vectreal/vectreal-platform/commit/5a858d1d302349fa192db22b8e024795a3f289bf))
- add publish sidebar components for embedding, saving, and sharing scenes ([c846642](https://github.com/Vectreal/vectreal-platform/commit/c846642585db690738d5a8a11a29981750ff9d23))
- Add publisher buttons for 3D model processing ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Add release-please configuration and manifest for package publishing ([3dab8d3](https://github.com/Vectreal/vectreal-platform/commit/3dab8d3044f4e836e24a2e54ad2679484e932ea9))
- Add release-please configuration and manifest for package publishing ([8fdc57b](https://github.com/Vectreal/vectreal-platform/commit/8fdc57baa84c912d2ae4da3316870ad2afedd5bf))
- add routeDiscovery configuration to react-router setup ([30759e5](https://github.com/Vectreal/vectreal-platform/commit/30759e5aac24947518eb0af8e0bc264c30636e32))
- add SaveButton component and integrate scene saving functionality ([df2657f](https://github.com/Vectreal/vectreal-platform/commit/df2657f982d7e0b1a75159d165b57e9bbdedd40e))
- add scene asset utilities for URI normalization, MIME type detection, and base64 handling ([d81826d](https://github.com/Vectreal/vectreal-platform/commit/d81826d4c8d416ac4e187d3300c5aa6d4eae4a0a))
- add scene metadata update functionality and enhance scene details UI ([58d0187](https://github.com/Vectreal/vectreal-platform/commit/58d01876a43c6dee1c087317873678083080d651))
- add scene preview repository and update routes for scene previews ([7a98a0d](https://github.com/Vectreal/vectreal-platform/commit/7a98a0d8f85fa368429a384902af63ffffafc470))
- add scene thumbnail capture and loading thumbnail support in viewer ([5f97695](https://github.com/Vectreal/vectreal-platform/commit/5f9769547a96fc60c62dfbc497baa25747d1ff45))
- add scene thumbnail capture and loading thumbnail support in viewer ([c295065](https://github.com/Vectreal/vectreal-platform/commit/c2950657ea8fcf137afeb1913ca5510019ab19e8))
- Add social sign-in route for Google and GitHub authentication ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- add Stripe dependency for billing integration ([f06a55b](https://github.com/Vectreal/vectreal-platform/commit/f06a55bab250002518e18a282a772393db9d24fd))
- Add Terraform configurations for Vectreal Platform on Google Cloud ([#150](https://github.com/Vectreal/vectreal-platform/issues/150)) ([fd86ffd](https://github.com/Vectreal/vectreal-platform/commit/fd86ffd2115640ddfbb3c7ba06cf7f61e058c9d3))
- add type-check step to CI workflow and enhance project configuration ([a41b2d0](https://github.com/Vectreal/vectreal-platform/commit/a41b2d05c41531df6f4791584aa729fe53d17082))
- add UI components ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
- add useAuthResumeRevalidation hook for improved session revalidation in layouts ([d21d017](https://github.com/Vectreal/vectreal-platform/commit/d21d017e28b6d9d8f4752c27de4d78e4afd542ea))
- add various asset files including icons, manifest, and browser config for improved web app support ([a53bc24](https://github.com/Vectreal/vectreal-platform/commit/a53bc2417c05626b25ffbfbc338bf824b5c62981))
- Add view transitions to various dashboard and project links for improved navigation experience ([7d9c1fb](https://github.com/Vectreal/vectreal-platform/commit/7d9c1fbdcbe08ce0b967e892cc47eeea44b3f21b))
- adjust scene details skeleton layout for improved responsiveness ([2988b8f](https://github.com/Vectreal/vectreal-platform/commit/2988b8fd8c11a0c5b6cf63aa95b177ab1866bffb))
- **api-keys:** add API key management functionality ([3ad1301](https://github.com/Vectreal/vectreal-platform/commit/3ad1301b8583a272f40c51efa0d50ea2e094eea0))
- **api-keys:** add API key management functionality ([6ee98f6](https://github.com/Vectreal/vectreal-platform/commit/6ee98f6eeda3618f85572de245be5cb200d49b81))
- **api:** add existingAssetIds parameter to CreateSceneSettingsParams interface ([e1f86b4](https://github.com/Vectreal/vectreal-platform/commit/e1f86b45f5b56850715408512ef5d9c7cc0675f9))
- **apps/official-website:** add `Reports` card component to editor ([3b43ac7](https://github.com/Vectreal/vectreal-platform/commit/3b43ac7b4b819ef03eb420a41443cd4aa9209b01))
- **apps/official-website:** add basic env controls inside editor file menu ([8c64913](https://github.com/Vectreal/vectreal-platform/commit/8c649132f38f4566d0badd7257a398c090286951))
- **apps/official-website:** add color picker hex value input ([41812d5](https://github.com/Vectreal/vectreal-platform/commit/41812d5f436e5bd195f010f57d7c67db0dbec48d))
- **apps/official-website:** add environment controls to `file-menu` ([f93f461](https://github.com/Vectreal/vectreal-platform/commit/f93f461f3a66f4eeac256e0cd21424c1200b8ba3))
- **apps/official-website:** add vite-PWA ([2765158](https://github.com/Vectreal/vectreal-platform/commit/27651589a65707dd45fb92b1a2433b4852ec4b43))
- **apps/official-website:** enable offline Google Analytics in Vite config ([9b25a2f](https://github.com/Vectreal/vectreal-platform/commit/9b25a2f4e658d7ea4bd770a5ab85a98e3fc45cf7))
- **apps/official-website:** integrate texture compression optimization ([c3933d3](https://github.com/Vectreal/vectreal-platform/commit/c3933d335b47d3abd9e43a1713d25b8aacfe4891))
- **apps/official-website:** move ga initialization to `base-layout` & add custom event tracking ([660e847](https://github.com/Vectreal/vectreal-platform/commit/660e84774d62c23f8f5358060872a722fa85755c))
- **apps/official-website:** unify optimization handler in editor file-menu ([714197e](https://github.com/Vectreal/vectreal-platform/commit/714197e1b575ec616566da13d2580cb30d4574cf))
- **billing:** EPIC-2 billing and entitlement data model foundation ([98e8f06](https://github.com/Vectreal/vectreal-platform/commit/98e8f069b4bdd139d6f2129f109a15ef5a37088c))
- Build project page with content overview ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- Create a basic dashboard page component ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Create folder page for project organization ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- Create logout route to handle user sign-out ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Create sign-in layout with social login options ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Create sign-up page with username, email, and password registration ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Create Supabase client for server-side requests ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Develop projects overview page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- enable cross-tab draft restoration with draft ID in auth redirects ([1753ccf](https://github.com/Vectreal/vectreal-platform/commit/1753ccf1ca429e3cd72a8ec9de5a3d00b0763d3f))
- enable cross-tab draft restoration with draft ID in auth redirects ([8133333](https://github.com/Vectreal/vectreal-platform/commit/8133333f0332829d47c130f07156ae6920749e83))
- enhance about page content and improve styling for better readability ([6148b15](https://github.com/Vectreal/vectreal-platform/commit/6148b1500b9e306b9231a7ccc04a16cc7eadf761))
- enhance asset handling by integrating asset normalization and lookup functionality ([571eabf](https://github.com/Vectreal/vectreal-platform/commit/571eabf01865afb0d1a86014119bdc06ca9a32ec))
- enhance asset handling by integrating asset normalization and lookup functionality ([a802fee](https://github.com/Vectreal/vectreal-platform/commit/a802fee7fb28b8624928fe0bdf124852fb2e476b))
- enhance breadcrumb functionality with folder ancestry support ([8c7d75d](https://github.com/Vectreal/vectreal-platform/commit/8c7d75d9d3d45bfb168c2f1188079f8f07f40ae8))
- enhance camera configuration and management across scene components ([fd218e6](https://github.com/Vectreal/vectreal-platform/commit/fd218e69bf476dd2011bba94f81f98a1b2ae51ff))
- enhance CI/CD workflows with quality gate and build steps ([b5ad615](https://github.com/Vectreal/vectreal-platform/commit/b5ad6156cb051d9b623f98a2b6ca589dbf5a89f2))
- enhance CI/CD workflows with quality gate and build steps ([1b7030b](https://github.com/Vectreal/vectreal-platform/commit/1b7030be629b5bffdf5a95ae05893950f76fac68))
- enhance dashboard components with dynamic organization handling and layout improvements ([35840fd](https://github.com/Vectreal/vectreal-platform/commit/35840fd235c4361a2779239a2ed280a8bc45dd9d))
- enhance dashboard components with new StatCard and improved layouts ([567e914](https://github.com/Vectreal/vectreal-platform/commit/567e9140a92feca69b66488fe6861e3617f73a90))
- enhance dashboard with overview component and improved scene handling ([89ac1af](https://github.com/Vectreal/vectreal-platform/commit/89ac1afe37e750add3475b68cce2414572a88a3d))
- enhance DataTable cell title handling and improve project data transformation logic to avoid hydration mismatch ([b0b8b6a](https://github.com/Vectreal/vectreal-platform/commit/b0b8b6aeca3dfb10e231c003bc9d92bd2d8a5477))
- enhance deployment workflows and configurations for Cloud Run services, add caching and access control improvements ([249da35](https://github.com/Vectreal/vectreal-platform/commit/249da3514d827c1268fd52ef9989b22743f42b8a))
- enhance embed options with domain validation and UI improvements ([40ca015](https://github.com/Vectreal/vectreal-platform/commit/40ca0152a50ea1ac6cf2a963478f93e06b6e9e2d))
- Enhance environment settings panel with ground configuration and sliders ([2393a51](https://github.com/Vectreal/vectreal-platform/commit/2393a518149b87f232cf7c5d083e6f86f8b089b5))
- enhance footer component with dynamic styling and add animated logo prop ([648c8e4](https://github.com/Vectreal/vectreal-platform/commit/648c8e40a4a5665d3fe74f6fb2ae59a712fbd1f1))
- enhance InfoPopover and Overlay components with new stories and improved styles ([e34163a](https://github.com/Vectreal/vectreal-platform/commit/e34163a33ebb0a3fe1dd0bfc818316f168b2c94d))
- enhance model optimization and texture handling ([089f27a](https://github.com/Vectreal/vectreal-platform/commit/089f27a29a7f4160d1c2fd6b7c3c8e0a14941033))
- enhance model optimization and texture handling ([a98bb0c](https://github.com/Vectreal/vectreal-platform/commit/a98bb0c2fa6cfdf123835be7c093175b2ba1ae5b))
- enhance model optimization hooks and UI components ([e90bb5d](https://github.com/Vectreal/vectreal-platform/commit/e90bb5d009ed7f3559427f604d3096867a4cce90))
- Enhance navigation and layout components with user menu and sidebar integration ([0ca734e](https://github.com/Vectreal/vectreal-platform/commit/0ca734e807a4447217565442c676f7fbb504545a))
- enhance OverlayControls with dropdown actions and refactor side… ([e2ffc9e](https://github.com/Vectreal/vectreal-platform/commit/e2ffc9e05116a30df3026a588c2123d0aa592181))
- enhance OverlayControls with dropdown actions and refactor sidebar for user integration ([5676a0c](https://github.com/Vectreal/vectreal-platform/commit/5676a0ccb0ccc993dbb3f0b5e53134cd4718c0ca))
- enhance project and scene management with new folder creation and content actions ([93df463](https://github.com/Vectreal/vectreal-platform/commit/93df463fbd4c615d6c5e19bb3c9188b689654bb2))
- enhance project configuration with ESLint, Vite, and Drizzle setup ([2f520c6](https://github.com/Vectreal/vectreal-platform/commit/2f520c6f2e052b40d75b575224a23b6dec51a680))
- enhance publish sidebar with scene and project ID handling, improve embed options, and add validation for saving and publishing ([a7146fe](https://github.com/Vectreal/vectreal-platform/commit/a7146febdd7adf49714add09f9b367bcaffcf315))
- enhance save button functionality with availability states ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
- enhance scene and stats schemas with RLS policies and indexing ([186f319](https://github.com/Vectreal/vectreal-platform/commit/186f3190b733e24cbf5f0f3f8212372fa6198609))
- enhance scene asset utilities with improved MIME type handling and base64 normalization ([3f410b8](https://github.com/Vectreal/vectreal-platform/commit/3f410b871ecb23580e56a8b4d5f4feae3f547c31))
- enhance scene data handling with base64 encoding and optimize request management ([880007f](https://github.com/Vectreal/vectreal-platform/commit/880007feb3685b5849916dafe3aac2743b8123f2))
- enhance scene metadata handling and settings management ([8ffc99b](https://github.com/Vectreal/vectreal-platform/commit/8ffc99b2eabd7fd83c78c0b581c6cf8c7f7e1073))
- Enhance scene persistence and statistics tracking ([58735f6](https://github.com/Vectreal/vectreal-platform/commit/58735f6d8f1738630ab4d2e749f44ae77508a125))
- enhance shared components and utils, add mobile navigation for docs ([b424033](https://github.com/Vectreal/vectreal-platform/commit/b4240331d005009a424be6058fe4db152775b950))
- enhance Supabase client handling with error management for stale refresh tokens ([57f084b](https://github.com/Vectreal/vectreal-platform/commit/57f084bd6bd4d0ea9f41ec730a85170d2897243a))
- enhance Supabase client handling with error management for stale refresh tokens ([ea81e59](https://github.com/Vectreal/vectreal-platform/commit/ea81e59c60809b367897e753a4cc75dc7956dd19))
- enhance texture optimization API with new request structure and error handling ([6ac4d16](https://github.com/Vectreal/vectreal-platform/commit/6ac4d16b120c2178b22528d4d7045615e468982d))
- enhance viewer loading and model handling with improved state m… ([7ce3e42](https://github.com/Vectreal/vectreal-platform/commit/7ce3e42c6282fa479a5bbb6d64d3c8a00d36507f))
- enhance viewer loading and model handling with improved state management and transitions ([00871ee](https://github.com/Vectreal/vectreal-platform/commit/00871ee4da9c5efbef6b8d18d139c1c0904696f5))
- enhance viewer loading and model handling with improved state management and transitions ([8ef422d](https://github.com/Vectreal/vectreal-platform/commit/8ef422df7fe2092873856428f34a2ee8db6983e0))
- first-run onboarding wizard + /docs site with Edit on GitHub ([15c48d9](https://github.com/Vectreal/vectreal-platform/commit/15c48d94eec13df39ee2077745e6e8f3d2aaa3e4))
- **footer, mock-shop-section, home-page:** adjust layout for mobile and improve structure ([a36d574](https://github.com/Vectreal/vectreal-platform/commit/a36d57426d71d99d315634b8bd9d98b721b28960))
- Implement advanced and basic optimization panels with toggle settings ([8e0bad2](https://github.com/Vectreal/vectreal-platform/commit/8e0bad2eeefd9a97dd61603518645c91bf2dc0bd))
- implement apply optimizations button in the sidebar with loading state ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
- Implement Asset Storage Service for managing GLTF scene assets in Google Cloud Storage ([d0761bc](https://github.com/Vectreal/vectreal-platform/commit/d0761bc689fd74d3ffdf9d29ec606a6264237e61))
- Implement authentication context and hooks for user management ([267f546](https://github.com/Vectreal/vectreal-platform/commit/267f54655f12ddeb9bf1dadcba911f40b85e46fa))
- Implement authentication layout with user redirection ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- implement bulk delete functionality for projects and scenes with confirmation dialog ([6f19267](https://github.com/Vectreal/vectreal-platform/commit/6f192679faba775db309b784bc53cb452e16db54))
- implement bulk delete functionality for projects and scenes with confirmation dialog ([fb737e0](https://github.com/Vectreal/vectreal-platform/commit/fb737e0e215c6f67778ba6f012777bea5328dadb))
- implement CSRF protection and guest optimization quota management ([fcd2669](https://github.com/Vectreal/vectreal-platform/commit/fcd266987fcd41b123e801150a94e6cc96cd8dc6))
- implement CSRF protection and guest optimization quota management ([1d7a9a4](https://github.com/Vectreal/vectreal-platform/commit/1d7a9a48465a04e7dcfc4fd2458586860b00ba03))
- implement dashboard table state management and dialog handling ([edf76dc](https://github.com/Vectreal/vectreal-platform/commit/edf76dc689b01980ba8106bd0dde434f0aa017ef))
- Implement email OTP confirmation route for user sign-up ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- implement EPIC-3 Stripe billing integration ([bb27591](https://github.com/Vectreal/vectreal-platform/commit/bb275917b04f88cd9d5f1496f0764aadfcea9e79))
- Implement hook for capturing scene screenshots in 3D environment ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- implement pricing page, upgrade modal, limit enforcement, and billing settings ([3980abe](https://github.com/Vectreal/vectreal-platform/commit/3980abe415f8887d1b5b7dbf536f7da07d65257e))
- implement save location configuration for scene publishing and … ([89c8c68](https://github.com/Vectreal/vectreal-platform/commit/89c8c68fe8d95a0c10c7b2ee0481ff687eb62307))
- implement save location configuration for scene publishing and enhance scene settings handling ([514cacf](https://github.com/Vectreal/vectreal-platform/commit/514cacfde9da60737183a463765766ea032da69d))
- Implement scene detail page ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- implement scene publication and revocation functionality ([cf4619f](https://github.com/Vectreal/vectreal-platform/commit/cf4619fbb324a2929bcf88c2ff10e1f139524ebe))
- Implement scene saving ([d292e95](https://github.com/Vectreal/vectreal-platform/commit/d292e9506efec4e3e2b3ba21c7fd0e46b1c9aeda))
- Implement sign-in page with email and password authentication ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- implement staging edge with CDN support and multi-region Cloud Run services ([431119a](https://github.com/Vectreal/vectreal-platform/commit/431119ace05f8e078190448f84b22a4271cf2cbc))
- Implement theme session management with cookie storage ([64bd29c](https://github.com/Vectreal/vectreal-platform/commit/64bd29cc0ad178ddf4057e6b5da7fde5a2af504a))
- Implement user service for managing users, organizations, and projects ([b4f5041](https://github.com/Vectreal/vectreal-platform/commit/b4f5041cb5a9d4b20fb739ca5f27d700493f36cf))
- implement utility functions for API responses and styling ([5a42716](https://github.com/Vectreal/vectreal-platform/commit/5a427161eb1757187ced8f4e590abe373fb131ea))
- improve dashboard components and add scene details skeleton ([be252df](https://github.com/Vectreal/vectreal-platform/commit/be252df4ed3b843723d7de359a324be6510911e8))
- improve dashboard components and add scene details skeleton; update skeleton styles ([6bd686e](https://github.com/Vectreal/vectreal-platform/commit/6bd686e7b3d3e57c269000394d2a3c5e66d7d0c5))
- improve optimization sidebar with animations ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
- init platform app ([7601719](https://github.com/Vectreal/vectreal-platform/commit/7601719074a305aec443a7f71a95a3e9abfa222b))
- integrate Stripe secret keys for production and staging environments ([f7c135c](https://github.com/Vectreal/vectreal-platform/commit/f7c135c532775dc32c45eafcccffd3ba4bda4e42))
- integrate Stripe secret keys for production and staging environments ([d623999](https://github.com/Vectreal/vectreal-platform/commit/d62399905f03e5ce912dc9b9926a85924f6f6ba0))
- **official-website:** add hdr bluriness control to file-menu ([8a32492](https://github.com/Vectreal/vectreal-platform/commit/8a324929d354dbe3038c89ae1bf94c0d625e1c83))
- **official-website:** add lazy loading for page components ([fe63d3d](https://github.com/Vectreal/vectreal-platform/commit/fe63d3d9ed01ba85b4ffc3c247bb50927e326179))
- **official-website:** rework the reports modal of the editor ([1808e07](https://github.com/Vectreal/vectreal-platform/commit/1808e07c82e67bde74aebf5aa80dff87b5d518ee))
- Optimize Docker build process with multi-stage builds and stati… ([42c7df3](https://github.com/Vectreal/vectreal-platform/commit/42c7df32bf19c503b153920baea0ce2e2b4fdf27))
- Optimize Docker build process with multi-stage builds and static asset handling ([4378d55](https://github.com/Vectreal/vectreal-platform/commit/4378d55856666cc6bafab2a7e2439d7eccb56304))
- Optimize GLTF loading and model transformation processes for improved performance ([8060d9d](https://github.com/Vectreal/vectreal-platform/commit/8060d9ddd24651a0bac11058b5df563228f4a9bd))
- **packages/hooks:** add tetxure compression optimization ([41555ad](https://github.com/Vectreal/vectreal-platform/commit/41555ad10d6a25d01b02ea943e57eaaeafd7d90c))
- **packages/hooks:** advance on `use-optimize-model` hook ([0c0b57e](https://github.com/Vectreal/vectreal-platform/commit/0c0b57e8009026ea96c53a50e848b8a937cf2c5d))
- **packages/hooks:** optimize model and add normals optimization ([6f0bde1](https://github.com/Vectreal/vectreal-platform/commit/6f0bde1c5a47b9be555405f547cc186749c581fc))
- **packages/hooks:** rework optimizations hook integration ([2121bb5](https://github.com/Vectreal/vectreal-platform/commit/2121bb55edf0b2ac2f5ff7a16e1c166edfde0e6a))
- **packages/viewer:** add environment controls to `VectrealViewer` ([218abdd](https://github.com/Vectreal/vectreal-platform/commit/218abddac263cf2effeecf3c1196d5cad52acf5d))
- **packages/viewer:** add info popover to display additional info ([5547fb1](https://github.com/Vectreal/vectreal-platform/commit/5547fb1934f08f3ee2fc907e975c77006a176f36))
- **packages/viewer:** enhance Storybook configuration with deep controls and auto-generated documentation ([7df00eb](https://github.com/Vectreal/vectreal-platform/commit/7df00eb30a83c747109b79c5234f6a17791946d1))
- **packages/viewer:** update peer dependencies, add Storybook configuration, implement robust styling and remove postcss config files ([df8359a](https://github.com/Vectreal/vectreal-platform/commit/df8359a4824d265282634267683e8e4b007f423d))
- **project:** added github actions and nx grouping to dependabot ([7ffc248](https://github.com/Vectreal/vectreal-platform/commit/7ffc2481f8499f9370e889b4f329e5e69c572747))
- **publisher-signup:** add signup flow with temporary scene save in indexedDB ([8a65726](https://github.com/Vectreal/vectreal-platform/commit/8a6572671a24320198ceaf7bbfdfb1240161b544))
- Refactor and enhance publisher settings components ([2a1eb68](https://github.com/Vectreal/vectreal-platform/commit/2a1eb687e157637d346a89f9ae97333e7265efcc))
- refactor authentication handling to use loadAuthenticatedSession and improve session management across dashboard routes ([e787c5d](https://github.com/Vectreal/vectreal-platform/commit/e787c5dd89f8855ff7af64289448f8e3763018b3))
- Refactor publisher layout and sidebar components ([2c43273](https://github.com/Vectreal/vectreal-platform/commit/2c43273b239a5d3f60de1d6b79cc417bea8154bf))
- refactor scene and asset handling with improved type definitions and payload resolution ([99e743b](https://github.com/Vectreal/vectreal-platform/commit/99e743b574c158c79af151c1465eb957df7a350a))
- refactor scene and asset handling, improve loading logic and UI components ([31e02bc](https://github.com/Vectreal/vectreal-platform/commit/31e02bc3914666c714c2e8af07d8e816e72cd817))
- refactor scene metrics and details components; improve structure and responsiveness ([fb3a342](https://github.com/Vectreal/vectreal-platform/commit/fb3a34275236c7e53953cd345509c11a5238f8f1))
- Remove official-website in favor of vectreal-platform app ([e805770](https://github.com/Vectreal/vectreal-platform/commit/e805770e672100cb5c026e55f914587d543c3a27))
- Remove official-website in favor of vectreal-platform app ([#198](https://github.com/Vectreal/vectreal-platform/issues/198)) ([3c1019e](https://github.com/Vectreal/vectreal-platform/commit/3c1019ea1950ce1c99247c957e983078b563ce80))
- Remove settings components and integrate stepper functionality into publisher layout ([0cb3e8f](https://github.com/Vectreal/vectreal-platform/commit/0cb3e8fc59d9cc101c2d1b4008d5ebbbda8623a6))
- remove userId prop from PublishDrawer and SaveOptions components ([75c3e9d](https://github.com/Vectreal/vectreal-platform/commit/75c3e9d10ff0aaddfb27069a49d0fb0a605982fb))
- replace LoadingSpinner with CenteredSpinner in HeroScene and Model components ([678a20e](https://github.com/Vectreal/vectreal-platform/commit/678a20e82d4491be7122dbd60e467426f606a8e3))
- Reuse project creation drawer for editing at `/dashboard/projects/:projectId/edit` ([61879eb](https://github.com/Vectreal/vectreal-platform/commit/61879eb484a4c4c87ac131ec68bb94220b86f414))
- **scene-settings:** add type definitions for scene settings and optimization report; refactor createNewSettingsVersion parameters ([c55e126](https://github.com/Vectreal/vectreal-platform/commit/c55e126a3553eddb2e0e387f1a6b442946de55d6))
- **scene-settings:** refactor save and get scene settings operations; streamline validation and response handling ([7605fae](https://github.com/Vectreal/vectreal-platform/commit/7605fae57dbffda748d4cf062e059b35ec6131df))
- **scene-settings:** update optimizationReport type in SceneSettingsRequest and parser ([0158cf6](https://github.com/Vectreal/vectreal-platform/commit/0158cf6e5cd4afd1291f9348f9bf60c1d66c3273))
- **shared:** add tooltip component ([fede1b2](https://github.com/Vectreal/vectreal-platform/commit/fede1b24b3343d982eae7e1dafc4c4f9a3586f53))
- update button labels for SignUpButton and PublisherButton components ([fb71bb3](https://github.com/Vectreal/vectreal-platform/commit/fb71bb370d50d1863a8a2c80964171b4e322c31f))
- update CI workflow to remove push triggers and enhance typecheck command in project configuration ([88822f7](https://github.com/Vectreal/vectreal-platform/commit/88822f71909cebaaf9c4d187b930c33e6de4da25))
- update CI workflows for improved naming consistency and add lint/typecheck job ([7faede1](https://github.com/Vectreal/vectreal-platform/commit/7faede13459b5da798d6fd37dc4abd684a5faef5))
- update CI workflows to trigger on workflow_run events and enhance deployment configurations ([0efb775](https://github.com/Vectreal/vectreal-platform/commit/0efb77516266a14129017e8124cd868195de64a3))
- update CI/CD workflows for improved deployment and quality checks ([30703ce](https://github.com/Vectreal/vectreal-platform/commit/30703ce2858700fbe18936f9f0b2081bea527a82))
- update CI/CD workflows for improved deployment and quality checks ([6ffadec](https://github.com/Vectreal/vectreal-platform/commit/6ffadeceae3db38b50597b0c06494f385a53f89a))
- update components configuration and add ButtonGroup component with variants ([4067aeb](https://github.com/Vectreal/vectreal-platform/commit/4067aebb455d521426aaaa8a688f79d3c420f203))
- update dashboard components for improved styling and performance ([088247b](https://github.com/Vectreal/vectreal-platform/commit/088247ba235c8b2988aed7510e0846d5cfd78b87))
- update embed options and API response handling for scene previews ([1c0eeea](https://github.com/Vectreal/vectreal-platform/commit/1c0eeeaea5ea6c711e61535c8b9a1f9b101fccca))
- update embed options and API response handling for scene previews ([aacf567](https://github.com/Vectreal/vectreal-platform/commit/aacf567be2cb6ebb7909c03faea4191b12476ea9))
- update FloatingPillWrapper styles and add LogIn icon to navigation ([920fb96](https://github.com/Vectreal/vectreal-platform/commit/920fb96084ef073d6ad755b54f5fd82147f18f0b))
- update FloatingPillWrapper styles and add LogIn icon to navigation ([64a1b0b](https://github.com/Vectreal/vectreal-platform/commit/64a1b0b8c79a6561183f9e73bf0e8b19754e65ae))
- Update GitHub secrets setup to use RELEASE_APP_PRIVATE_KEY_FILE and adjust paths ([#331](https://github.com/Vectreal/vectreal-platform/issues/331)) ([1eb9115](https://github.com/Vectreal/vectreal-platform/commit/1eb911566c44acec6dd600c395d0f1a1dbd770fc))
- Update Google Cloud Storage integration and environment configuration ([efa2675](https://github.com/Vectreal/vectreal-platform/commit/efa26754859f4e6cba17a37537a377d87e9ec1b0))
- update layout and styling for footer, hero background, and sections ([0e2fc15](https://github.com/Vectreal/vectreal-platform/commit/0e2fc15175596d94feed4e3db5b78c506554c6c5))
- Update News Room page layout and content for improved user engagement ([c18469c](https://github.com/Vectreal/vectreal-platform/commit/c18469c2aba301329744a934993412cb8cb983e1))
- Update News Room page layout and content for improved user engagement ([a6ce4b8](https://github.com/Vectreal/vectreal-platform/commit/a6ce4b8f8399a199a463d359fb1adbd16ad1fdab))
- update scene details to use texture and mesh byte sizes, enhancing metrics display ([83ec1da](https://github.com/Vectreal/vectreal-platform/commit/83ec1da766ed1511af2520e87ed71470d09a4b4a))
- update scene loader to manage save availability ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
- update SceneShadows component to accept partial shadow configuration options ([0fd186a](https://github.com/Vectreal/vectreal-platform/commit/0fd186a71e6d87273a7fb7695e43a787edface0d))
- update staging deployment configuration to use europe-west3 region and enhance Cloud Run service definitions ([3c12a29](https://github.com/Vectreal/vectreal-platform/commit/3c12a29d7daa7e226477aa53757f80bd48e5fa54))
- update staging edge URL map to use backend service and add path rules for static assets ([da5753b](https://github.com/Vectreal/vectreal-platform/commit/da5753b3c621512c711aa482f97e33273e14c6f7))
- **viewer:** enhance canvas component with viewport detection and loading states ([542ce70](https://github.com/Vectreal/vectreal-platform/commit/542ce707225856c7704bfa1ce744b4322c4d42e8))
- **viewer:** implement InfoPopover component and integrate it into VectrealViewer; refactor overlay handling and loading states ([6d833dd](https://github.com/Vectreal/vectreal-platform/commit/6d833dd0809f1b018559b0d3d33244e98f46bf62))

### Bug Fixes

- add link to small vectreal logo ([04ac84c](https://github.com/Vectreal/vectreal-platform/commit/04ac84cae6bdb701f73ee7c30f3f5e74298cca8f))
- add link to small vectreal logo ([182de0c](https://github.com/Vectreal/vectreal-platform/commit/182de0ce696478322e846604e02122dfc2b05700))
- address code review — correct docs sourcePaths, icon semantics, personalised onboarding title ([b212794](https://github.com/Vectreal/vectreal-platform/commit/b212794ef5f99f1f160d439e0b3a0cfa13492687))
- address code review feedback - correct plan derivation, type assertion, Fragment key, and usage labels ([0a5b266](https://github.com/Vectreal/vectreal-platform/commit/0a5b26656667481175d84f7177fb9d390e2e4f03))
- address PR review feedback on reconcile endpoint ([fa99fd1](https://github.com/Vectreal/vectreal-platform/commit/fa99fd1e00ad103db1a8da1b9cdb897cf407d520))
- adjust CSS formatting for blockquote and pre elements for improved readability ([f4896bd](https://github.com/Vectreal/vectreal-platform/commit/f4896bd54c00119cddd1d24495735f3d2ac26d93))
- adjust ESLint configuration to ignore Storybook files and update Storybook main configuration ([a53bc24](https://github.com/Vectreal/vectreal-platform/commit/a53bc2417c05626b25ffbfbc338bf824b5c62981))
- Adjust routing for publisher layout to include optional sceneId parameter ([d0761bc](https://github.com/Vectreal/vectreal-platform/commit/d0761bc689fd74d3ffdf9d29ec606a6264237e61))
- Adjust shadow settings and post-processing effects in the viewer; refine scene settings store for better state management ([8c1dc8d](https://github.com/Vectreal/vectreal-platform/commit/8c1dc8da997b774314e83468fe7cf6248baada84))
- allow unauthenticated access for staging deployments ([8e80bea](https://github.com/Vectreal/vectreal-platform/commit/8e80bea8052b9326acec23f5dc22cf04b446bac3))
- **apps/official-website/editor:** fix accept pattern and remove webkitdirectory attribute ([7c0f653](https://github.com/Vectreal/vectreal-platform/commit/7c0f6538bdaddebbdc7cbc28a32d17746071643b))
- **apps/official-website/editor:** missing import for useState and improved loading state handling ([7b37f54](https://github.com/Vectreal/vectreal-platform/commit/7b37f54b64a33c707364ac77f920c15a0ee6c32f))
- **apps/official-website:** add `use-accept-pattern` hook for unified patterns across inputs ([4bf83a8](https://github.com/Vectreal/vectreal-platform/commit/4bf83a8ab22397cd2c8c09aff0a915b31472cd20))
- **apps/official-website:** Editor Model loading ([c041f2a](https://github.com/Vectreal/vectreal-platform/commit/c041f2a2cf5c4864b3670faf394ad28db78b2f38))
- **apps/official-website:** remove dev check in ga hook ([2aecde4](https://github.com/Vectreal/vectreal-platform/commit/2aecde4f265b2e9f99207a465cc14e1ef7151ff5))
- **apps/official-website:** remove link canonical tag from `index.html` ([7c0bb3b](https://github.com/Vectreal/vectreal-platform/commit/7c0bb3bce4098878f30c2ed9084db661bba9274b))
- **apps/official-website:** remove useInitGA hook from app component ([c5a7ec1](https://github.com/Vectreal/vectreal-platform/commit/c5a7ec18659f15cbcc6939df35657b5126bf8a94))
- **apps/official-website:** reset `optimize` on `Reports` dismount ([db5656a](https://github.com/Vectreal/vectreal-platform/commit/db5656aa53ee205226cbdb37b1da20675f41e72c))
- **apps/official-website:** use actual optimizations in editor file-menu ([d56034b](https://github.com/Vectreal/vectreal-platform/commit/d56034b7f8f57284ab1c71e92d1bb5ae2ba0a2f7))
- **billing:** address PR review feedback on entitlements and schema constraints ([9a858fc](https://github.com/Vectreal/vectreal-platform/commit/9a858fc3d069fed374541f91ce057e50e85bead5))
- **billing:** apply second-pass reviewer feedback ([20c6413](https://github.com/Vectreal/vectreal-platform/commit/20c64133b8b47718cbc15d5d6a9e8090590b72f5))
- correct branch syntax in CI workflow for pull request triggers ([3bc4d8b](https://github.com/Vectreal/vectreal-platform/commit/3bc4d8b259bb9b7a3e4539f38d5aadae8788d8e4))
- correct search parameter handling and improve dependency array formatting ([bbd15c2](https://github.com/Vectreal/vectreal-platform/commit/bbd15c23430d7e4bd39fc9fdbd7bafab1ccc32dd))
- enhance dashboard content loading behavior ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
- global css reference in mdx css module ([ada18b3](https://github.com/Vectreal/vectreal-platform/commit/ada18b36543a28a6a641ca79ed89eccf8e8d3b2c))
- global css reference in mdx css module ([b2fbaf5](https://github.com/Vectreal/vectreal-platform/commit/b2fbaf52bbca60978525dc24d5ef900eb18b1c41))
- global css reference in mdx css module ([b94b5a9](https://github.com/Vectreal/vectreal-platform/commit/b94b5a9dadce3208235bf860d52975e0b176eaa3))
- imports in scene-settings-assets.server.ts ([b2d82f6](https://github.com/Vectreal/vectreal-platform/commit/b2d82f6b0b3149705ca3966d935645377609e576))
- improve health check logic for Cloud Run deployment ([3f2b6bc](https://github.com/Vectreal/vectreal-platform/commit/3f2b6bc0e92019fd7868d85d2f3fc985348a29eb))
- improve layout and styling in ScenePage component ([f3e4159](https://github.com/Vectreal/vectreal-platform/commit/f3e41599eda04aafe3708cbaddbe06813f0c97ce))
- improve layout and styling in Signin and Signup pages ([001f21e](https://github.com/Vectreal/vectreal-platform/commit/001f21e5017a45693e4fdc110e3778ea4a6d3429))
- improve redirect URL handling in social signin action ([2644b6b](https://github.com/Vectreal/vectreal-platform/commit/2644b6bf989ff14053f7d163594502b3be7e5d69))
- minor layout adjustments in scene name input and tooltip button ([57175ec](https://github.com/Vectreal/vectreal-platform/commit/57175ec378a474ed239fb6dcdcb5d904a7655cd4))
- **official-website:** font-family ([2a6fca7](https://github.com/Vectreal/vectreal-platform/commit/2a6fca7dbabb73abc54247c246e1c3ace10df31f))
- **pacakges/official-website:** normalize action string for upload event ([94035cb](https://github.com/Vectreal/vectreal-platform/commit/94035cb35c6351ec22be8c9707111acf3a555847))
- **packages/hooks:** dependency externalization ([6364c5d](https://github.com/Vectreal/vectreal-platform/commit/6364c5d3a66461494e6c137815c5eaabebb831c4))
- **packages/hooks:** ensure buffers are converted to Uint8Array before adding to zip file ([4e1f99d](https://github.com/Vectreal/vectreal-platform/commit/4e1f99dcd54e45e2549df3ee6c0b3bda25b18a74))
- **packages/hooks:** export `use-export-model` from hooks package ([f00e75f](https://github.com/Vectreal/vectreal-platform/commit/f00e75ffd973137e137c0af9058967c004939a25))
- **packages/hooks:** loading of model buffer failed because of wrong types in development ([1c4e734](https://github.com/Vectreal/vectreal-platform/commit/1c4e7345984f1c751a04ea28b44d8151945dcafd))
- **packages/hooks:** optimize hook volumne + emission material extension registration ([6ec7915](https://github.com/Vectreal/vectreal-platform/commit/6ec79153d07d097df608d064ff0a16473a1fb1e7))
- **packages/viewer:** add 'storybook-addon-deep-controls' to ignoredDependencies in ESLint configuration ([bedcaf6](https://github.com/Vectreal/vectreal-platform/commit/bedcaf60a5f201d8f5ca63d35a40b8a5dac06fbf))
- **packages/viewer:** add manual dark mode support in VectrealViewer component using js ([aaf5a14](https://github.com/Vectreal/vectreal-platform/commit/aaf5a14cecfe3468f031a44aa5dab7d2025a6293))
- **packages/viewer:** adjust grid component to snap to bottom of model ([2e1a294](https://github.com/Vectreal/vectreal-platform/commit/2e1a294be481363310ac5abaa6e5c012041d780c))
- **packages/viewer:** adjust loading spinner styles ([286ccc7](https://github.com/Vectreal/vectreal-platform/commit/286ccc72ae7d6b043ca50f9182b7e6d821585161))
- **packages/viewer:** center default loading spinner ([6155c54](https://github.com/Vectreal/vectreal-platform/commit/6155c541f4323c9e5036b2537439e664f101bb40))
- **packages/viewer:** change tailwind styling to css modules styling ([273ec59](https://github.com/Vectreal/vectreal-platform/commit/273ec59d928e7f9018a36727860fa9d362e0cece))
- **packages/viewer:** dedup div with "vctrl-viewer" classname and add vctrl classnames to popover ([a00be5b](https://github.com/Vectreal/vectreal-platform/commit/a00be5b9186ad697d548d5b526af47bb04f29445))
- **packages/viewer:** default env preset + optional background color ([5ecc5d0](https://github.com/Vectreal/vectreal-platform/commit/5ecc5d0dd86afc24ecbc476d5a9599bee9223239))
- **packages/viewer:** disabled/stuttering SceneControls component ([361f6a1](https://github.com/Vectreal/vectreal-platform/commit/361f6a141499590dfe7b105b7a775bc64411dec8))
- **packages/viewer:** remove cross dependency to vctrl/hooks ([f150b31](https://github.com/Vectreal/vectreal-platform/commit/f150b310260f4461cc3bbffa50aaad1da255b679))
- **packages/viewer:** styling in info-popover component ([dfdd977](https://github.com/Vectreal/vectreal-platform/commit/dfdd97743943e5c1ffdcdc1166abe0978eb06b6c))
- **packages/viewer:** the clickable area of the info-popover footer ([de4c3d7](https://github.com/Vectreal/vectreal-platform/commit/de4c3d7bc17a6a36ac41b9121937478b218ceca2))
- **packages/viewer:** update className description and apply it to the outermost container ([3c5c3c1](https://github.com/Vectreal/vectreal-platform/commit/3c5c3c15238a16187ed8ae170d857786abb71ec8))
- **packages/viewer:** update CSS selectors for light and dark mode variables ([f1d43cd](https://github.com/Vectreal/vectreal-platform/commit/f1d43cd56dc267d35f508e585e5882d1bf0c5db9))
- **packages:** cross dependencies ([4fbe8b3](https://github.com/Vectreal/vectreal-platform/commit/4fbe8b3e07c09976758d7906a23a8780127b7479))
- **packages:** dependency management on build ([e25cade](https://github.com/Vectreal/vectreal-platform/commit/e25cade6e63e6a89b9913613eeeccc92c7b5ff6c))
- **packages:** update dependencies in `package.json` with eslint nx plugin ([1eab9b7](https://github.com/Vectreal/vectreal-platform/commit/1eab9b718b821d3292d90e8b0e6ee1c3f72175b2))
- Potential fix for code scanning alert no. 8: Workflow does not contain permissions ([3463f31](https://github.com/Vectreal/vectreal-platform/commit/3463f31b6ce4a6ada30041133eed5c0b6bbc95be))
- **project:** remove unused deps and fix nx project with `nx reset` ([c937184](https://github.com/Vectreal/vectreal-platform/commit/c9371840de26111f65cb3c03f95cabef064ba0be))
- **project:** tailwind setup for packages + apps ([3240e01](https://github.com/Vectreal/vectreal-platform/commit/3240e01232d044b1dedcc50ae2634849e8f4aeb3))
- **project:** update dependencies and remove obsolete entries ([356b1c4](https://github.com/Vectreal/vectreal-platform/commit/356b1c49d78dc1d3f78f1d358b1dddaec574622c))
- **project:** update postcss configuration in vite ([3dad878](https://github.com/Vectreal/vectreal-platform/commit/3dad878a62c9a63801c5ce26e184f4ed582ee6d9))
- Refactor CSRF origin checks to enhance security and support forwarded headers ([0b6f97d](https://github.com/Vectreal/vectreal-platform/commit/0b6f97d7a7f6cd29dd9c909fb1f18a0df595f5da))
- remove --skip-pooler option from Supabase link commands in project.json ([2e927a5](https://github.com/Vectreal/vectreal-platform/commit/2e927a528c8cd5923b059c907046309a188006c8))
- remove --skip-pooler option from Supabase link commands in project.json ([bd59e1e](https://github.com/Vectreal/vectreal-platform/commit/bd59e1e6ff88831450d7e4114297d865ca39bfc0))
- remove root path from cacheable public paths ([b8867dc](https://github.com/Vectreal/vectreal-platform/commit/b8867dcff951cbb64ceafc5f7bd99eadfb573d88))
- remove unnecessary blank line in EmptyProjectsState component ([069e70b](https://github.com/Vectreal/vectreal-platform/commit/069e70bc50f42ef82a0843b7e88b7375d77c2be6))
- reorder setup steps in CD workflow for pnpm to work ([2cb3735](https://github.com/Vectreal/vectreal-platform/commit/2cb3735fdd25da98c57e835aef0ecb3f96d2332d))
- reorder setup steps in CD workflow for pnpm to work ([2e0896e](https://github.com/Vectreal/vectreal-platform/commit/2e0896e716931b3ed1b4492486d7d3436e7a0e58))
- resolve TypeScript error for undefined url in quickLinks sidebar ([6dd3b0b](https://github.com/Vectreal/vectreal-platform/commit/6dd3b0baa14abbfe409cc2837d5eaeb31afeab08))
- resolve TypeScript error for undefined URL in quickLinks sidebar ([51d19ab](https://github.com/Vectreal/vectreal-platform/commit/51d19ab2ee1213827425e5c17d242283ddee1e26))
- **shared:** menubar disabled styling ([8f564a5](https://github.com/Vectreal/vectreal-platform/commit/8f564a5b1d1bc2b3d4c81dd1f4f85b649f1c5a72))
- **styles:** unify font family to 'DM Sans Variable' across components ([f241cf9](https://github.com/Vectreal/vectreal-platform/commit/f241cf9d7f532d0e272ca662a2d17d1ee3ec6414))
- **styles:** unify font family to 'DM Sans Variable' across components ([4f0ba88](https://github.com/Vectreal/vectreal-platform/commit/4f0ba880c63af986fb0ddb4cad598ea67feebad6))
- update concurrency group naming for deployment workflows ([d4c12dc](https://github.com/Vectreal/vectreal-platform/commit/d4c12dc7bae39aaf6ef2e5298932dc8e48d96aa4))
- update concurrency group naming for deployment workflows ([a374dd1](https://github.com/Vectreal/vectreal-platform/commit/a374dd12f78c18d6ad09ccb68155ddd4d02a1202))
- update decodeBase64ToUint8Array return type and improve asset data handling in reconstructGltfFiles ([3aa7170](https://github.com/Vectreal/vectreal-platform/commit/3aa71709268f386fd3b49f966fc4f88a15647a2c))
- update deployment conditions to trigger on push events in staging workflow ([249364d](https://github.com/Vectreal/vectreal-platform/commit/249364d13be1d0b9a8f11183a420d05e2e3d024c))
- update ESLint configuration to remove CSS linting and adjust VSCode settings ([04f56c7](https://github.com/Vectreal/vectreal-platform/commit/04f56c7d27fcfc816e4593a1a33b6d31574ad268))
- update ESLint configuration to remove CSS linting and adjust VSCode settings ([a82786f](https://github.com/Vectreal/vectreal-platform/commit/a82786fb3640df1992aac4a73374f23bfe405830))
- update loading spinner class and restore loadingThumbnail in LoadingWithThumbnail story ([010992a](https://github.com/Vectreal/vectreal-platform/commit/010992a5f920b824643a0910cbd7a2efb8963534))
- update session secret handling for CSRF protection in production ([f3fb87d](https://github.com/Vectreal/vectreal-platform/commit/f3fb87dcbc596797f4d4c3cacbf35c35cfe658f7))
- update sidebar layout and add close button for better user experience ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
- update sidebar links and modify footer navigation ([c727090](https://github.com/Vectreal/vectreal-platform/commit/c7270909d746746eaf965f981834e93e178a6d74))
- update sidebar links and modify footer navigation ([c73c9a2](https://github.com/Vectreal/vectreal-platform/commit/c73c9a244c3ece60318cd0b7f58fa146c752cf86))
- update styles and layout for improved responsiveness and consist… ([8247a25](https://github.com/Vectreal/vectreal-platform/commit/8247a25b252032da041f8f24ec549d72de8f2071))
- update styles and layout for improved responsiveness and consistency ([2f5ac4e](https://github.com/Vectreal/vectreal-platform/commit/2f5ac4e2a00e399e35a237377c946a54e2930378))
- update types for optimization presets and ensure consistent prop usage ([75d004e](https://github.com/Vectreal/vectreal-platform/commit/75d004e1b71009e1a8cffbf5e846d56d8d3d6ddc))
- URL param substitution in dashboard actions and match edit drawer fields ([3117919](https://github.com/Vectreal/vectreal-platform/commit/3117919b2e82a225373e5008cd1d725fac1c3ca1))
- **workflows:** update Chromatic workflow to ignore chore branches ([4f937a7](https://github.com/Vectreal/vectreal-platform/commit/4f937a76a52d0941aaeb70be4d0518e7795a62e8))

## 0.9.5 (2025-03-14)

### 🩹 Fixes

- **apps/official-website:** Editor Model loading ([c041f2a](https://github.com/Vectreal/vectreal-platform/commit/c041f2a))
- **apps/official-website/editor:** missing import for useState and improved loading state handling ([7b37f54](https://github.com/Vectreal/vectreal-platform/commit/7b37f54))
- **packages/hooks:** ensure buffers are converted to Uint8Array before adding to zip file ([4e1f99d](https://github.com/Vectreal/vectreal-platform/commit/4e1f99d))

### ❤️ Thank You

- Mo
- Schlomoh

## 0.9.4 (2024-11-24)

### 🩹 Fixes

- **packages/viewer:** add manual dark mode support in VectrealViewer component using js ([aaf5a14](https://github.com/Vectreal/vectreal-core/commit/aaf5a14))

### ❤️ Thank You

- Moritz Becker

## 0.9.3 (2024-11-24)

### 🩹 Fixes

- **packages/viewer:** the clickable area of the info-popover footer ([de4c3d7](https://github.com/Vectreal/vectreal-core/commit/de4c3d7))
- **packages/viewer:** update className description and apply it to the outermost container ([3c5c3c1](https://github.com/Vectreal/vectreal-core/commit/3c5c3c1))
- **packages/viewer:** add 'storybook-addon-deep-controls' to ignoredDependencies in ESLint configuration ([bedcaf6](https://github.com/Vectreal/vectreal-core/commit/bedcaf6))
- **workflows:** update Chromatic workflow to ignore chore branches ([4f937a7](https://github.com/Vectreal/vectreal-core/commit/4f937a7))

### ❤️ Thank You

- Moritz Becker

## 0.9.2 (2024-11-23)

### 🩹 Fixes

- **pacakges/official-website:** normalize action string for upload event ([94035cb](https://github.com/Vectreal/vectreal-core/commit/94035cb))
- **packages/viewer:** update CSS selectors for light and dark mode variables ([f1d43cd](https://github.com/Vectreal/vectreal-core/commit/f1d43cd))
- **project:** update dependencies and remove obsolete entries ([356b1c4](https://github.com/Vectreal/vectreal-core/commit/356b1c4))

### ❤️ Thank You

- Moritz Becker

## 0.9.1 (2024-11-07)

### 🩹 Fixes

- **packages/viewer:** dedup div with "vctrl-viewer" classname and add vctrl classnames to popover ([a00be5b](https://github.com/Vectreal/vectreal-core/commit/a00be5b))

### ❤️ Thank You

- Moritz Becker

## 0.9.0 (2024-11-07)

### 🚀 Features

- **packages/viewer:** update peer dependencies, add Storybook configuration, implement robust styling and remove postcss config files ([df8359a](https://github.com/Vectreal/vectreal-core/commit/df8359a))
- **packages/viewer:** enhance Storybook configuration with deep controls and auto-generated documentation ([7df00eb](https://github.com/Vectreal/vectreal-core/commit/7df00eb))

### 📖 Documentation

- **project:** add Storybook badge to README files for vctrl/viewer documentation ([c0a0659](https://github.com/Vectreal/vectreal-core/commit/c0a0659))

### ❤️ Thank You

- Moritz Becker

## 0.8.0 (2024-11-02)

### 🚀 Features

- **packages/hooks:** optimize model and add normals optimization ([6f0bde1](https://github.com/Vectreal/vectreal-core/commit/6f0bde1))
- **project:** added github actions and nx grouping to dependabot ([7ffc248](https://github.com/Vectreal/vectreal-core/commit/7ffc248))

### 🩹 Fixes

- **packages/viewer:** adjust loading spinner styles ([286ccc7](https://github.com/Vectreal/vectreal-core/commit/286ccc7))
- **packages/viewer:** change tailwind styling to css modules styling ([273ec59](https://github.com/Vectreal/vectreal-core/commit/273ec59))

### 📖 Documentation

- **project:** changed the serve command to vctrl ([b48b34b](https://github.com/Vectreal/vectreal-core/commit/b48b34b))

### ❤️ Thank You

- Mo @Schlomoh
- Moritz Becker
- Nils Ingwersen

## 0.7.8 (2024-10-28)

### 🩹 Fixes

- **packages/viewer:** disabled/stuttering SceneControls component ([361f6a1](https://github.com/Vectreal/vectreal-core/commit/361f6a1))

### ❤️ Thank You

- Moritz Becker

## 0.7.7 (2024-10-26)

### 📖 Documentation

- **packages/viewer:** optimize README.md and add example code ([7b7fce8](https://github.com/Vectreal/vectreal-core/commit/7b7fce8))

### ❤️ Thank You

- Moritz Becker

## 0.7.6 (2024-10-24)

### 📖 Documentation

- **packages/viewer:** add CodeSandbox example link ([9d196fa](https://github.com/Vectreal/vectreal-core/commit/9d196fa))

### ❤️ Thank You

- Moritz Becker

## 0.7.5 (2024-10-22)

### 🩹 Fixes

- **packages/viewer:** styling in info-popover component ([dfdd977](https://github.com/Vectreal/vectreal-core/commit/dfdd977))

### ❤️ Thank You

- Moritz Becker

## 0.7.4 (2024-10-22)

### 🚀 Features

- **apps/official-website:** enable offline Google Analytics in Vite config ([9b25a2f](https://github.com/Vectreal/vectreal-core/commit/9b25a2f))
- **apps/official-website:** move ga initialization to `base-layout` & add custom event tracking ([660e847](https://github.com/Vectreal/vectreal-core/commit/660e847))

### 🩹 Fixes

- **apps/official-website:** remove useInitGA hook from app component ([c5a7ec1](https://github.com/Vectreal/vectreal-core/commit/c5a7ec1))
- **apps/official-website/editor:** fix accept pattern and remove webkitdirectory attribute ([7c0f653](https://github.com/Vectreal/vectreal-core/commit/7c0f653))
- **packages/hooks:** optimize hook volumne + emission material extension registration ([6ec7915](https://github.com/Vectreal/vectreal-core/commit/6ec7915))
- **project:** update postcss configuration in vite ([3dad878](https://github.com/Vectreal/vectreal-core/commit/3dad878))

### ❤️ Thank You

- Moritz Becker

## 0.7.3 (2024-10-20)

### 🩹 Fixes

- **packages/viewer:** remove cross dependency to vctrl/hooks ([f150b31](https://github.com/Vectreal/vectreal-core/commit/f150b31))

### ❤️ Thank You

- Moritz Becker

## 0.7.2 (2024-10-19)

### 🩹 Fixes

- **packages:** cross dependencies ([4fbe8b3](https://github.com/Vectreal/vectreal-core/commit/4fbe8b3))

### ❤️ Thank You

- Moritz Becker

## 0.7.0 (2024-10-19)

### 🚀 Features

- **apps/official-website:** unify optimization handler in editor file-menu ([714197e](https://github.com/Vectreal/vectreal-core/commit/714197e))
- **apps/official-website:** add color picker hex value input ([41812d5](https://github.com/Vectreal/vectreal-core/commit/41812d5))
- **official-website:** add hdr bluriness control to file-menu ([8a32492](https://github.com/Vectreal/vectreal-core/commit/8a32492))
- **packages/viewer:** add info popover to display additional info ([5547fb1](https://github.com/Vectreal/vectreal-core/commit/5547fb1))

### 🩹 Fixes

- **apps/official-website:** remove dev check in ga hook ([2aecde4](https://github.com/Vectreal/vectreal-core/commit/2aecde4))
- **packages:** update dependencies in `package.json` with eslint nx plugin ([1eab9b7](https://github.com/Vectreal/vectreal-core/commit/1eab9b7))
- **packages/viewer:** adjust grid component to snap to bottom of model ([2e1a294](https://github.com/Vectreal/vectreal-core/commit/2e1a294))
- **packages/viewer:** default env preset + optional background color ([5ecc5d0](https://github.com/Vectreal/vectreal-core/commit/5ecc5d0))
- **project:** tailwind setup for packages + apps ([3240e01](https://github.com/Vectreal/vectreal-core/commit/3240e01))

### 📖 Documentation

- **project:** small changes - mainly added/changed links ([b2a9934](https://github.com/Vectreal/vectreal-core/commit/b2a9934))

### ❤️ Thank You

- Moritz Becker

## 0.6.0 (2024-10-11)

### 🚀 Features

- **apps/official-website:** integrate texture compression optimization ([c3933d3](https://github.com/Vectreal/vectreal-core/commit/c3933d3))
- **official-website:** rework the reports modal of the editor ([1808e07](https://github.com/Vectreal/vectreal-core/commit/1808e07))
- **packages/hooks:** add tetxure compression optimization ([41555ad](https://github.com/Vectreal/vectreal-core/commit/41555ad))

### 🩹 Fixes

- **apps/official-website:** reset `optimize` on `Reports` dismount ([db5656a](https://github.com/Vectreal/vectreal-core/commit/db5656a))
- **apps/official-website:** add `use-accept-pattern` hook for unified patterns across inputs ([4bf83a8](https://github.com/Vectreal/vectreal-core/commit/4bf83a8))
- **packages/hooks:** loading of model buffer failed because of wrong types in development ([1c4e734](https://github.com/Vectreal/vectreal-core/commit/1c4e734))

### 📖 Documentation

- **packages/hooks:** add docstrings ([e9465e4](https://github.com/Vectreal/vectreal-core/commit/e9465e4))
- **project:** update readme documentations with viewer `envOptions`, options for optimizations and new texture compression optimization + misc. ([0a1df16](https://github.com/Vectreal/vectreal-core/commit/0a1df16))

### ❤️ Thank You

- Moritz Becker

## 0.5.0 (2024-10-09)

### 🚀 Features

- **apps/official-website:** add vite-PWA ([2765158](https://github.com/Vectreal/vectreal-core/commit/2765158))
- **apps/official-website:** add `Reports` card component to editor ([3b43ac7](https://github.com/Vectreal/vectreal-core/commit/3b43ac7))
- **official-website:** add lazy loading for page components ([fe63d3d](https://github.com/Vectreal/vectreal-core/commit/fe63d3d))
- **packages/hooks:** advance on `use-optimize-model` hook ([0c0b57e](https://github.com/Vectreal/vectreal-core/commit/0c0b57e))
- **packages/hooks:** rework optimizations hook integration + new way of creating `optimize` return object of `use-load-model` + added `load-start` event to event-system ([2121bb5](https://github.com/Vectreal/vectreal-core/commit/2121bb5))

### 🩹 Fixes

- **apps/official-website:** use actual optimizations in editor file-menu ([d56034b](https://github.com/Vectreal/vectreal-core/commit/d56034b))
- **apps/official-website:** remove link canonical tag from `index.html` ([7c0bb3b](https://github.com/Vectreal/vectreal-core/commit/7c0bb3b))
- **packages/hooks:** export `use-export-model` from hooks package ([f00e75f](https://github.com/Vectreal/vectreal-core/commit/f00e75f))

### ❤️ Thank You

- Moritz Becker

## 0.4.0 (2024-10-07)

### 🚀 Features

- **apps/official-website:** add environment controls to `file-menu` ([f93f461](https://github.com/Vectreal/vectreal-core/commit/f93f461))
- **apps/official-website:** add basic env controls inside editor file menu ([8c64913](https://github.com/Vectreal/vectreal-core/commit/8c64913))
- **packages/viewer:** add environment controls to `VectrealViewer` ([218abdd](https://github.com/Vectreal/vectreal-core/commit/218abdd))
- **shared:** add tooltip component ([fede1b2](https://github.com/Vectreal/vectreal-core/commit/fede1b2))

### 🩹 Fixes

- **official-website:** font-family ([2a6fca7](https://github.com/Vectreal/vectreal-core/commit/2a6fca7))
- **packages/hooks:** dependency externalization ([6364c5d](https://github.com/Vectreal/vectreal-core/commit/6364c5d))
- **packages/viewer:** center default loading spinner ([6155c54](https://github.com/Vectreal/vectreal-core/commit/6155c54))
- **shared:** menubar disabled styling ([8f564a5](https://github.com/Vectreal/vectreal-core/commit/8f564a5))

### 📖 Documentation

- **packages/viewer:** add docstring to `VectrealViewer` component ([bf37cf2](https://github.com/Vectreal/vectreal-core/commit/bf37cf2))

### ❤️ Thank You

- Moritz Becker

## 0.3.2 (2024-10-04)

### 🩹 Fixes

- **packages:** dependency management on build ([e25cade](https://github.com/Vectreal/vectreal-core/commit/e25cade))

### ❤️ Thank You

- Moritz Becker

## 0.3.1 (2024-09-22)

### 🩹 Fixes

- **project:** remove unused deps and fix nx project with `nx reset` ([c937184](https://github.com/Vectreal/vectreal-core/commit/c937184))

### ❤️ Thank You

- Moritz Becker

## 0.3.0 (2024-09-22)

### 🚀 Features

- **packages/hooks:** add `use-export-model` ([60964b9](https://github.com/Vectreal/vectreal-core/commit/60964b9))

### 🩹 Fixes

- **packages/hooks:** use `saveAs` instead of custom utils function for saving file ([30d78c1](https://github.com/Vectreal/vectreal-core/commit/30d78c1))

### 📖 Documentation

- **packages/hooks:** add docstrings to new functoins ([7ff1649](https://github.com/Vectreal/vectreal-core/commit/7ff1649))
- **packages/hooks:** add docstrings to functions ([06dd1b3](https://github.com/Vectreal/vectreal-core/commit/06dd1b3))
- **packages/hooks:** update readme ([7449fc4](https://github.com/Vectreal/vectreal-core/commit/7449fc4))
- **packages/hooks:** finalize docs for vctrl/hooks ([8f9d6ca](https://github.com/Vectreal/vectreal-core/commit/8f9d6ca))
- **packages/viewer:** update first example for viewer usage ([eac73ed](https://github.com/Vectreal/vectreal-core/commit/eac73ed))

### ❤️ Thank You

- Moritz Becker

## 0.2.2 (2024-09-13)

This was a version bump only, there were no code changes.

## 0.2.1 (2024-09-13)

### 🩹 Fixes

- **apps/official-website:** change viewer import to use named syntax ([6fd958a](https://github.com/Vectreal/vectreal-core/commit/6fd958a))
- **packages/viewer:** add directory option to file input ([a97d2c9](https://github.com/Vectreal/vectreal-core/commit/a97d2c9))
- **packages/viewer:** extension change of `ìndex` file ([06b030b](https://github.com/Vectreal/vectreal-core/commit/06b030b))
- **packages/viewer:** memoize certain scene options ([0051955](https://github.com/Vectreal/vectreal-core/commit/0051955))
- **project:** extend paths in `tsconfig.json` ([0a19d37](https://github.com/Vectreal/vectreal-core/commit/0a19d37))

### 📖 Documentation

- **packages/viewer:** add WIP info to the top ([3d1d729](https://github.com/Vectreal/vectreal-core/commit/3d1d729))
- **project:** add mention of `use-optimize-model` hook ([4212893](https://github.com/Vectreal/vectreal-core/commit/4212893))

### ❤️ Thank You

- Moritz Becker

## 0.2.0 (2024-09-11)

### 🚀 Features

- **apps/official-website:** add editor context provider ([f42659a](https://github.com/Vectreal/vectreal-core/commit/f42659a))
- **packages/hooks:** add optimizer hook ([78b9cd5](https://github.com/Vectreal/vectreal-core/commit/78b9cd5))
- **project:** Move shadcn components into `shared` library project and modify `tsconfig` paths ([1f15bef](https://github.com/Vectreal/vectreal-core/commit/1f15bef))

### 🩹 Fixes

- **packages:** rework build/publish executors ([bfad14f](https://github.com/Vectreal/vectreal-core/commit/bfad14f))
- **packages/hooks:** add meshopt decoder to gltf loader ([87e2198](https://github.com/Vectreal/vectreal-core/commit/87e2198))
- **packages/viewer:** optimize initial props + rendering ([42bbd6e](https://github.com/Vectreal/vectreal-core/commit/42bbd6e))
- **project:** remove playwright for apps/official-website ([c2d7035](https://github.com/Vectreal/vectreal-core/commit/c2d7035))

### 📖 Documentation

- **packages/hooks:** small changes ([6dae863](https://github.com/Vectreal/vectreal-core/commit/6dae863))
- **packages/hooks:** add hooks/use-optimize-model to documentation ([d5404cf](https://github.com/Vectreal/vectreal-core/commit/d5404cf))

### ❤️ Thank You

- Moritz Becker

## 0.1.0 (2024-09-09)

### 🚀 Features

- **apps/official-website:** add logo to nav-bar ([aef2e1a](https://github.com/Vectreal/vectreal-core/commit/aef2e1a))
- **apps/official-website:** add seo meta information ([14c93e5](https://github.com/Vectreal/vectreal-core/commit/14c93e5))

### 🩹 Fixes

- **packages:** nx release executor configuration ([9539735](https://github.com/Vectreal/vectreal-core/commit/9539735))
- **packages:** publish docs along side build output ([470496c](https://github.com/Vectreal/vectreal-core/commit/470496c))
- **packages/viewer:** release executor package path ([b55d888](https://github.com/Vectreal/vectreal-core/commit/b55d888))

### ❤️ Thank You

- Moritz Becker

## 0.0.9-4 (2024-09-08)

### 🩹 Fixes

- **packages/viewer:** release executor package path ([074af1b](https://github.com/Vectreal/vectreal-core/commit/074af1b))

### ❤️ Thank You

- Moritz Becker

## 0.0.9-3 (2024-09-08)

### 🚀 Features

- **apps/official-website:** add logo to nav-bar ([aef2e1a](https://github.com/Vectreal/vectreal-core/commit/aef2e1a))
- **apps/official-website:** add seo meta information ([14c93e5](https://github.com/Vectreal/vectreal-core/commit/14c93e5))

### 🩹 Fixes

- **packages:** nx release executor configuration ([a6ae69c](https://github.com/Vectreal/vectreal-core/commit/a6ae69c))

### ❤️ Thank You

- Moritz Becker

## 0.0.9-2 (2024-08-29)

### 🩹 Fixes

- **packages:** re-active build executor generating package.json files ([4f34274](https://github.com/Vectreal/vectreal-core/commit/4f34274))

### ❤️ Thank You

- Moritz Becker

## 0.0.9-1 (2024-08-29)

### 🩹 Fixes

- **packages:** prevent nx vite executor from changing `package.json` file ([09fc53e](https://github.com/Vectreal/vectreal-core/commit/09fc53e))

### ❤️ Thank You

- Moritz Becker

## 0.0.9 (2024-08-29)

### 🩹 Fixes

- **packages/hooks:** remove files field from package.json ([028a371](https://github.com/Vectreal/vectreal-core/commit/028a371))

### ❤️ Thank You

- Moritz Becker

## 0.0.8 (2024-08-29)

This was a version bump only, there were no code changes.

## 0.0.7-9 (2024-08-29)

This was a version bump only, there were no code changes.

## 0.0.7-8 (2024-08-29)

### 🩹 Fixes

- **ci/cd:** build command in version release gh workflow ([ee9e3ea](https://github.com/Vectreal/vectreal-core/commit/ee9e3ea))
- **packages:** `Error verifying sigstore provenance bundle`so add `repository.url` to packages `package.json` ([681e94e](https://github.com/Vectreal/vectreal-core/commit/681e94e))
- **packages:** remove git type from repository fields in package.json files ([629c1c8](https://github.com/Vectreal/vectreal-core/commit/629c1c8))
- **packages:** change package.json files repository url type ([db99ba5](https://github.com/Vectreal/vectreal-core/commit/db99ba5))
- **packages:** also add repository.url to root + move `.npmrc` to root ([3598f23](https://github.com/Vectreal/vectreal-core/commit/3598f23))
- **project:** nx version migration ([837419d](https://github.com/Vectreal/vectreal-core/commit/837419d))

### 📖 Documentation

- **packages:** update package descriptions and co. ([b62cf76](https://github.com/Vectreal/vectreal-core/commit/b62cf76))
- **packages/viewer:** add link to github in contributing section ([98499e7](https://github.com/Vectreal/vectreal-core/commit/98499e7))
- **project:** clean up readme files ([eadf146](https://github.com/Vectreal/vectreal-core/commit/eadf146))

### ❤️ Thank You

- Moritz Becker

## 0.0.7-7 (2024-08-29)

### 🩹 Fixes

- **packages:** also add repository.url to root + move `.npmrc` to root ([4410952](https://github.com/Vectreal/vectreal-core/commit/4410952))

### ❤️ Thank You

- Moritz Becker

## 0.0.7-5 (2024-08-28)

### 🩹 Fixes

- **packages:** change package.json files repository url type ([f0aaece](https://github.com/Vectreal/vectreal-core/commit/f0aaece))

### ❤️ Thank You

- Moritz Becker

## 0.0.7-4 (2024-08-28)

### 🩹 Fixes

- **packages:** remove git type from repository fields in package.json files ([f552727](https://github.com/Vectreal/vectreal-core/commit/f552727))

### ❤️ Thank You

- Moritz Becker

## 0.0.7-3 (2024-08-28)

### 🩹 Fixes

- **packages:** `Error verifying sigstore provenance bundle`so add `repository.url` to packages `package.json` ([5c91ad6](https://github.com/Vectreal/vectreal-core/commit/5c91ad6))

### ❤️ Thank You

- Moritz Becker

## 0.0.7-2 (2024-08-28)

### 📖 Documentation

- **packages:** update package descriptions and co. ([1244950](https://github.com/Vectreal/vectreal-core/commit/1244950))

### ❤️ Thank You

- Moritz Becker

## 0.0.7 (2024-08-28)

### 🩹 Fixes

- **ci/cd:** build command in version release gh workflow ([6a02c51](https://github.com/Vectreal/vectreal-core/commit/6a02c51))

### 📖 Documentation

- **packages/viewer:** add link to github in contributing section ([11e6dd8](https://github.com/Vectreal/vectreal-core/commit/11e6dd8))
- **project:** clean up readme files ([fa9bab4](https://github.com/Vectreal/vectreal-core/commit/fa9bab4))

### ❤️ Thank You

- Moritz Becker

## 0.0.6 (2024-08-28)

### 📖 Documentation

- **packages/viewer:** add link to github in contributing section ([ae4c19c](https://github.com/Vectreal/vectreal-core/commit/ae4c19c))

### ❤️ Thank You

- Moritz Becker

## 0.0.3-3 (2024-08-28)

### 🩹 Fixes

- **project:** versioning action ([970f6f9](https://github.com/Vectreal/vectreal-core/commit/970f6f9))
- **project:** npm/git release mechanism ([f373e1f](https://github.com/Vectreal/vectreal-core/commit/f373e1f))

### 📖 Documentation

- **packages:** add `vctrl/hooks` and `vctrl/viewer` documentation readme ([ccb2ddd](https://github.com/Vectreal/vectreal-core/commit/ccb2ddd))
- **packages:** add status badge to packages readme files ([c64afab](https://github.com/Vectreal/vectreal-core/commit/c64afab))
- **project:** add status badges to docs ([1f6ad74](https://github.com/Vectreal/vectreal-core/commit/1f6ad74))
- **project:** clean up readme files ([a0a2f11](https://github.com/Vectreal/vectreal-core/commit/a0a2f11))

### ❤️ Thank You

- Moritz Becker

## 0.0.3-2 (2024-08-27)

### 🩹 Fixes

- **official-website/Dockerfile:** use `npm install` instead of `npm ci` ([fd3a78f](https://github.com/Vectreal/vectreal-core/commit/fd3a78f))
- **package-lock.json:** replace old lock file ([11d5344](https://github.com/Vectreal/vectreal-core/commit/11d5344))

### ❤️ Thank You

- Moritz Becker

## 0.0.3-0 (2024-08-27)

### 🩹 Fixes

- **official-website/Dockerfile:** use `npm install` instead of `npm ci` ([fd3a78f](https://github.com/Vectreal/vectreal-core/commit/fd3a78f))

### ❤️ Thank You

- Moritz Becker

## 0.0.2 (2024-08-27)

This was a version bump only, there were no code changes.

## 0.0.2-4 (2024-08-27)

### 🩹 Fixes

- **package-lock.json:** replace old lock file ([11d5344](https://github.com/Vectreal/vectreal-core/commit/11d5344))

### ❤️ Thank You

- Moritz Becker

## v0.0.2-2 (2024-08-27)

This was a version bump only, there were no code changes.

## 0.0.2-1 (2024-08-27)

This was a version bump only, there were no code changes.

## 0.0.2-0 (2024-08-27)

This was a version bump only, there were no code changes.
