import JSZip from 'jszip';
import { ImageDataObject, TexturesObject, URIBufferObject } from '../types';
import dataURItoBlob from './data-uri-to-blob';
import { getFileExtension } from './file-helpers';

/**
 * Handles processing and adding images to a zip file.
 *
 * @param images The images property of the GLTF model's asset.
 * @param textures The textures property of the GLTF model's asset.
 * @param zip The zip file to add images to.
 */
export const handleImages = (
  images: Array<ImageDataObject>,
  textures: Array<TexturesObject>,
  zip: JSZip,
): void => {
  textures.forEach((texture, index) => {
    const image = images[texture.source];
    if (!image.uri) return;

    const extension = getFileExtension(image.uri, image.mimeType);
    const textureName = texture.name || `texture_${index}`;
    const fileName = `${textureName}.${extension}`;

    if (image.data instanceof ArrayBuffer || image.data instanceof Uint8Array) {
      const buffer =
        image.data instanceof Uint8Array ? image.data.buffer : image.data;
      const uint8Array = new Uint8Array(buffer);
      zip.file(fileName, uint8Array, { binary: true });
    } else if (image.uri.startsWith('data:')) {
      // Handle data URIs
      const binaryData = dataURItoBlob(image.uri);
      zip.file(fileName, binaryData, { binary: true });
    } else {
      console.warn(`Image at index ${index} has unsupported data format`);
    }
  });
};

/**
 * Handles processing and adding buffers to a zip file.
 *
 * @param buffers The buffers property of the GLTF model's asset.
 * @param zip The zip file to add buffers to.
 * @param baseFileName The base file name to use for the exported file.
 *
 * Only ArrayBuffers and URIBufferObjects with a uri of type data URL are supported.
 * If the buffer is not an ArrayBuffer, it must have a uri that starts with 'data:'.
 * If the buffer is not an ArrayBuffer and does not have a uri, a warning is logged
 * to the console.
 */
export const handleBuffers = (
  buffers: Array<URIBufferObject | ArrayBuffer>,
  zip: JSZip,
  baseFileName: string,
): void => {
  buffers.forEach((buffer, index) => {
    const fileName = `${baseFileName}.bin`;
    if (buffer instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(buffer);
      zip.file(fileName, uint8Array, { binary: true });
    } else if (buffer.uri) {
      // If buffer.uri is a data URL, we need to convert it to binary data
      const binaryData = dataURItoBlob(buffer.uri);
      zip.file(fileName, binaryData, { binary: true });
    } else {
      console.warn(
        `Buffer at index ${index} is not an ArrayBuffer or does not have a URI`,
      );
    }
  });
};
