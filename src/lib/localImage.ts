import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const IMAGE_DIR = `${FileSystem.documentDirectory ?? ''}goods-images/`;

export function isManagedLocalImage(uri: string | null | undefined) {
  return !!uri && !!FileSystem.documentDirectory && uri.startsWith(IMAGE_DIR);
}

async function ensureImageDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('画像の保存先を準備できませんでした。');
  }

  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

function extensionFromUri(uri: string) {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.includes('.') ? cleanUri.split('.').pop() : null;
  return extension && extension.length <= 5 ? extension : 'jpg';
}

export async function persistPickedImage(uri: string) {
  await ensureImageDir();
  const extension = extensionFromUri(uri);
  const suffix = Math.random().toString(36).slice(2, 8);
  const destination = `${IMAGE_DIR}${Date.now()}-${suffix}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function deleteManagedLocalImage(uri: string | null | undefined) {
  const localUri = uri ?? '';
  if (!isManagedLocalImage(localUri)) return;
  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
}

async function persistPickerResult(result: ImagePicker.ImagePickerResult) {
  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }
  return persistPickedImage(result.assets[0].uri);
}

export async function requestPhotoLibraryPermission() {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (permission.granted) return;

  permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) return;

  if (permission.canAskAgain) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) return;
  }

  throw new Error('写真ライブラリの許可を確認してください。端末側で再表示できない場合は、設定アプリから写真へのアクセスを許可してください。');
}

export async function requestPhotoCameraPermission() {
  let permission = await ImagePicker.getCameraPermissionsAsync();
  if (permission.granted) return;

  permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.granted) return;

  if (permission.canAskAgain) {
    permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) return;
  }

  throw new Error('カメラの許可を確認してください。端末側で再表示できない場合は、設定アプリからカメラへのアクセスを許可してください。');
}

export async function pickGoodsImage() {
  await requestPhotoLibraryPermission();

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.65,
  });

  return persistPickerResult(result);
}

export async function takeGoodsPhoto() {
  await requestPhotoCameraPermission();

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.65,
  });

  return persistPickerResult(result);
}
