import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/** Pick a photo and shrink it to the 256px square JPEG the server stores, as a data URL. */
export async function pickProfilePhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const side = Math.min(a.width, a.height);
  const out = await manipulateAsync(
    a.uri,
    [{ crop: { originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side } }, { resize: { width: 256, height: 256 } }],
    { compress: 0.82, format: SaveFormat.JPEG, base64: true },
  );
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}
