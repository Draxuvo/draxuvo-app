import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Lado mayor y peso máximo de una foto que sube la app (FR-010, FR-018). */
export const MAX_SIDE = 1600;
export const MAX_BYTES = 10 * 1024 * 1024;

export class NotAnImageError extends Error {}
export class ImageTooLargeError extends Error {}
export class PermissionDeniedError extends Error {
  constructor(readonly source: "camera" | "library") {
    super(`permission_${source}`);
  }
}

export interface PreparedImage {
  uri: string;
  name: string;
  type: string;
}

/** Tamaño de salida con el lado mayor en `max` como tope; no agranda. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width?: number; height?: number } {
  if (Math.max(width, height) <= max) return {};
  return width >= height ? { width: max } : { height: max };
}

/** Abre cámara o galería. `null` si la persona cancela; lanza `PermissionDeniedError` si niega el permiso. */
export async function pickImage(source: "camera" | "library"): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission =
    source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError(source);

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0] ?? null);
}

/** Valida que sea imagen y la reduce (por defecto a 1600 px y menos de 10 MB), siempre como JPEG. */
export async function prepareImage(
  asset: ImagePicker.ImagePickerAsset,
  { maxSide = MAX_SIDE, maxBytes = MAX_BYTES }: { maxSide?: number; maxBytes?: number } = {},
): Promise<PreparedImage> {
  const isImage = (asset.type ? asset.type === "image" : true) && (asset.mimeType ? asset.mimeType.startsWith("image/") : true);
  if (!isImage) throw new NotAnImageError();

  const context = ImageManipulator.manipulate(asset.uri);
  const size = fitWithin(asset.width, asset.height, maxSide);
  if (size.width || size.height) context.resize(size);
  const rendered = await context.renderAsync();

  for (const compress of [0.8, 0.6, 0.4]) {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
    if ((new File(saved.uri).size ?? 0) <= maxBytes) {
      return { uri: saved.uri, name: `foto-${Date.now()}.jpg`, type: "image/jpeg" };
    }
  }
  throw new ImageTooLargeError();
}
