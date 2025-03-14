import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  presetsObj,
  PresetsType,
} from '@react-three/drei/helpers/environment-assets';

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  MenubarSub,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
} from '@vctrl/shared/components';
import { useModelContext } from '@vctrl/hooks/use-load-model';
import { useExportModel } from '@vctrl/hooks/use-export-model';

import { useAcceptPattern } from '../../lib/hooks';
import { useEditorContext } from '../../components/providers';
import ColorPicker from './color-picker';
import Reports from './reports';
import LoadingOverlay from './loading-overlay';

type TextureSize = 256 | 512 | 768 | 1024 | 2048 | 4096;
type TextureFormat = 'webp' | 'jpeg' | 'png';

function handleExportSuccess() {
  toast.info('Successfully exported model.');
}

function handleExportError(error: ErrorEvent) {
  toast.error(error.message);
}

const FileMenu = () => {
  const acceptPattern = useAcceptPattern();
  const { file, load, reset, optimize } = useModelContext();
  const {
    simplifyOptimization,
    dedupOptimization,
    quantizeOptimization,
    normalsOptimization,
    texturesCompressOptimization,
  } = optimize;

  const { handleGltfExport } = useExportModel(
    handleExportSuccess,
    handleExportError,
  );

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [textureFormat, setTextureFormat] = useState<TextureFormat>('webp');

  const {
    autoRotate,
    setAutoRotateEnabled,
    setAutoRotateSpeed,
    hdr,
    setHdrBluriness,
    setHdrExposure,
    setHdrPreset,
    setShowAsBackground,
    setBackgroundIntensity,
    setLightingStagePreset,
    showGrid,
    setShowGrid,
  } = useEditorContext();

  const inputRef = useRef<HTMLInputElement | null>(null);

  // File menu

  function handleNewFilesClick() {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }

  function handleLoadNewFiles(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();

    const files = event.target.files;

    if (files) {
      load(Array.from(files));
    }
  }

  function handleReset() {
    reset();
  }

  // View menu

  function handleToggleColorPicker() {
    setShowColorPicker(!showColorPicker);
  }

  function handleToggleGrid() {
    setShowGrid(!showGrid);
  }

  function handleToggleAutoRotate() {
    setAutoRotateEnabled(!autoRotate.enabled);
  }

  function handleToggleHdrBackground() {
    // hide the color picker if it's open and the HDR background is shown
    !hdr.asBackground && showColorPicker && setShowColorPicker(false);
    setShowAsBackground(!hdr.asBackground);
  }

  function handleToggleReports() {
    setShowReports(!showReports);
  }

  // Edit menu

  async function handleOptimization(
    optimizationName: string,
    description: string | null,
    optimization: () => void | Promise<void>,
  ) {
    setOptimizeLoading(true);

    await optimization();

    setOptimizeLoading(false);

    !showReports && handleToggleReports();
    toast.info(
      <>
        Applied optimization:{' '}
        <span className="capitalize">{optimizationName}</span>
      </>,
      {
        duration: 10000,
        description,
      },
    );
  }

  function handleSimplifyClick() {
    handleOptimization('simplify', null, simplifyOptimization);
  }

  async function handleTexturesOptimizeClick(size: TextureSize) {
    await handleOptimization(
      'textures',
      `Target: ${size}x${size}, Format: ${textureFormat}, Quality: 80`,
      async () =>
        await texturesCompressOptimization({
          targetFormat: textureFormat,
          quality: 80,
          resize: [size, size],
        }),
    );
  }

  async function handleQuantizeClick() {
    await handleOptimization('quantize', null, quantizeOptimization);
  }

  async function handleNormalsClick() {
    await handleOptimization(
      'normals',
      'Overriding normals',
      async () => await normalsOptimization({ overwrite: true }),
    );
  }

  async function handleDedupClick() {
    await handleOptimization('deduplication', null, dedupOptimization);
  }

  // Export menu

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  function handleUsdzExport() {}

  return (
    file && (
      <>
        {/* Keep input mounted for upload */}

        <input
          type="file"
          onChange={handleLoadNewFiles}
          ref={inputRef}
          accept={acceptPattern}
          style={{ display: 'none' }}
          multiple
        />

        {optimizeLoading && <LoadingOverlay />}

        <ColorPicker show={showColorPicker} setShow={setShowColorPicker} />
        <Reports show={showReports} setShow={setShowReports} />

        <Menubar className="absolute bottom-[2rem] right-[50%] translate-x-[50%]">
          <MenubarMenu>
            <MenubarTrigger key="file">File</MenubarTrigger>
            <MenubarContent align="center">
              <MenubarItem onClick={handleNewFilesClick}>
                Load new file(s)
              </MenubarItem>

              <MenubarSeparator />

              <MenubarItem onClick={handleReset}>Clear viewer</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger key="file">View</MenubarTrigger>

            <MenubarContent align="center">
              <MenubarCheckboxItem
                onClick={handleToggleGrid}
                checked={showGrid}
              >
                Show Grid
              </MenubarCheckboxItem>

              <MenubarCheckboxItem
                onClick={handleToggleAutoRotate}
                checked={autoRotate.enabled}
              >
                Enable Auto-Rotation
              </MenubarCheckboxItem>

              <MenubarCheckboxItem
                onClick={handleToggleHdrBackground}
                checked={hdr.asBackground}
              >
                Show HDR As Background
              </MenubarCheckboxItem>

              <MenubarSeparator />

              <MenubarSub>
                <MenubarSubTrigger>Auto-Rotation Speed</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(autoRotate.speed)}>
                    {['1', '0.5', '0.25'].map((key) => (
                      <MenubarRadioItem
                        key={key}
                        value={key}
                        onClick={() => setAutoRotateSpeed(Number(key))}
                      >
                        {key !== '1' ? key : key + '.0'}x
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarSeparator />

              <MenubarSub>
                <MenubarSubTrigger>HDR Preset</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(hdr.preset)}>
                    {Object.keys(presetsObj).map((key) => (
                      <MenubarRadioItem
                        className="capitalize"
                        key={key}
                        value={key}
                        onClick={() => setHdrPreset(key as PresetsType)}
                      >
                        {key}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarSub>
                <MenubarSubTrigger disabled={!hdr.asBackground}>
                  HDR Background Blurriness
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(hdr.blurriness)}>
                    {['1', '0.75', '0.5', '0.25', '0.125', '0'].map((key) => (
                      <MenubarRadioItem
                        key={key}
                        value={key}
                        onClick={() => setHdrBluriness(Number(key))}
                      >
                        {key !== '1' ? key : key + '.0'}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarSub>
                <MenubarSubTrigger>HDR Intensity</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(hdr.exposure)}>
                    {['1', '0.75', '0.5', '0.25', '0.125', '0'].map((key) => (
                      <MenubarRadioItem
                        key={key}
                        value={key}
                        onClick={() => setHdrExposure(Number(key))}
                      >
                        {key !== '1' ? key : key + '.0'}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarSub>
                <MenubarSubTrigger>Lighting Preset</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(hdr.stagePreset)}>
                    {['rembrandt', 'portrait', 'upfront', 'soft'].map((key) => (
                      <MenubarRadioItem
                        className="capitalize"
                        key={key}
                        value={key}
                        onClick={() =>
                          setLightingStagePreset(key as typeof hdr.stagePreset)
                        }
                      >
                        {key}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarSeparator />

              <MenubarSub>
                <MenubarSubTrigger disabled={!hdr.asBackground}>
                  Background Intensity
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(hdr.backgroundIntensity)}>
                    {['1', '0.75', '0.5', '0.25', '0.125', '0'].map((key) => (
                      <MenubarRadioItem
                        key={key}
                        value={key}
                        onClick={() => setBackgroundIntensity(Number(key))}
                      >
                        {key !== '1' ? key : key + '.0'}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarItem
                onClick={handleToggleColorPicker}
                disabled={hdr.asBackground}
              >
                {showColorPicker ? 'Hide' : 'Show'} Color-Picker
                <MenubarShortcut className="ml-8">BG color</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleToggleReports}>
                {showReports ? 'Hide' : 'Show'} Reports
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger key="edit">Edit</MenubarTrigger>
            <MenubarContent align="center">
              <MenubarItem onClick={handleSimplifyClick}>Simplify</MenubarItem>
              <MenubarItem onClick={handleNormalsClick}>
                Override Normals
              </MenubarItem>

              <MenubarSub>
                <MenubarSubTrigger>Optimize textures</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={textureFormat}>
                    {['webp', 'jpeg', 'png'].map((key) => (
                      <MenubarRadioItem
                        key={key}
                        value={key}
                        onClick={() => setTextureFormat(key as TextureFormat)}
                      >
                        {key}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => handleTexturesOptimizeClick(256)}>
                    256x256
                  </MenubarItem>
                  <MenubarItem onClick={() => handleTexturesOptimizeClick(512)}>
                    512x512
                  </MenubarItem>
                  <MenubarItem onClick={() => handleTexturesOptimizeClick(768)}>
                    768x768
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => handleTexturesOptimizeClick(1024)}
                  >
                    1024x1024
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => handleTexturesOptimizeClick(2048)}
                  >
                    2048x2048
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => handleTexturesOptimizeClick(4096)}
                  >
                    4096x4096
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>

              <MenubarItem onClick={handleQuantizeClick}>Quantize</MenubarItem>
              <MenubarItem onClick={handleDedupClick}>
                Remove duplicates
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger key="edit">Export</MenubarTrigger>
            <MenubarContent align="center">
              <MenubarSub>
                <MenubarSubTrigger>glTF</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => handleGltfExport(file, true)}>
                    glTF-Binary
                    <pre className="text-muted-foreground"> .glb</pre>
                  </MenubarItem>
                  <MenubarItem onClick={() => handleGltfExport(file, false)}>
                    glTF-JSON
                    <pre className="text-muted-foreground"> .gltf</pre>
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger disabled>USD (WIP)</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={handleUsdzExport}>
                    USDZ
                    <pre className="text-muted-foreground"> .usdz (ASCII)</pre>
                  </MenubarItem>
                  <MenubarItem onClick={handleUsdzExport}>
                    USDZ
                    <pre className="text-muted-foreground"> .usdz (BINARY)</pre>
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </>
    )
  );
};

export default FileMenu;
