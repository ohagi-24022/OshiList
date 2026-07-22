import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { pickGoodsImage, takeGoodsPhoto } from '../lib/localImage';
import { useAppTheme } from '../store/ThemeContext';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function GoodsImageField({ value, onChange }: Props) {
  const { colors } = useAppTheme();
  const imageUri = value.trim();

  const setLocalImage = async (mode: 'camera' | 'library') => {
    try {
      const uri = mode === 'camera' ? await takeGoodsPhoto() : await pickGoodsImage();
      if (uri) {
        onChange(uri);
      }
    } catch (error) {
      Alert.alert('画像を設定できませんでした', error instanceof Error ? error.message : 'もう一度お試しください。');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.imageRow}>
        <View style={[styles.preview, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <Ionicons color={colors.muted} name="image-outline" size={24} />
          )}
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="画像URL または file://..."
          placeholderTextColor={colors.muted}
          style={[styles.imageInput, { backgroundColor: colors.input, color: colors.text }]}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel="写真を撮影"
          onPress={() => setLocalImage('camera')}
          style={[styles.imageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons color={colors.text} name="camera-outline" size={18} />
          <Text style={[styles.imageButtonText, { color: colors.text }]}>撮影</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="写真を選択"
          onPress={() => setLocalImage('library')}
          style={[styles.imageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons color={colors.text} name="images-outline" size={18} />
          <Text style={[styles.imageButtonText, { color: colors.text }]}>選択</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="画像をクリア"
          onPress={() => onChange('')}
          style={[styles.clearButton, { borderColor: colors.border }]}
        >
          <Ionicons color={colors.muted} name="close-outline" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  imageRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  preview: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  previewImage: { height: '100%', width: '100%' },
  imageInput: {
    borderRadius: 8,
    flex: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  imageButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 42,
    justifyContent: 'center',
  },
  imageButtonText: { fontSize: 13, fontWeight: '800' },
  clearButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 46,
  },
});
