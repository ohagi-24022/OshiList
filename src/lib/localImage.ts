import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const IMAGE_DIR = `${FileSystem.documentDirectory ?? ''}goods-images/`;

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

async function persistPickedImage(uri: string) {
  await ensureImageDir();
  const extension = extensionFromUri(uri);
  const destination = `${IMAGE_DIR}${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

async function persistPickerResult(result: ImagePicker.ImagePickerResult) {
  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }
  return persistPickedImage(result.assets[0].uri);
}

export async function pickGoodsImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('写真ライブラリの使用が許可されていません。');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.85,
  });

  return persistPickerResult(result);
}

export async function takeGoodsPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('カメラの使用が許可されていません。');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.85,
  });

  return persistPickerResult(result);
}
