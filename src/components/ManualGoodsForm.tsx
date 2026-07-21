import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../store/ThemeContext';
import { GoodsInput, GoodsStatus } from '../types';

type Props = {
  initialJanCode?: string | null;
  initialBoxName?: string;
  initialCharacterName?: string;
  initialVariantName?: string;
  initialImageUrl?: string | null;
  onSubmit: (input: GoodsInput) => Promise<void>;
};

const statuses: Array<[GoodsStatus, string]> = [
  ['owned', '所持'],
  ['reserved', '予約済み'],
  ['wanted', '欲しい'],
];

export function ManualGoodsForm({
  initialJanCode,
  initialBoxName = '',
  initialCharacterName = '',
  initialVariantName = '通常版',
  initialImageUrl = null,
  onSubmit,
}: Props) {
  const { colors } = useAppTheme();
  const [boxName, setBoxName] = useState(initialBoxName);
  const [characterName, setCharacterName] = useState(initialCharacterName);
  const [variantName, setVariantName] = useState(initialVariantName);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? '');
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState<GoodsStatus>('owned');
  const [saving, setSaving] = useState(false);

  const disabled = !boxName.trim() || !characterName.trim() || saving;

  const save = async () => {
    if (disabled) return;
    setSaving(true);
    await onSubmit({
      janCode: initialJanCode ?? null,
      boxName,
      characterName,
      variantName,
      quantity: Math.max(0, Number(quantity) || 0),
      imageUrl: imageUrl.trim() || null,
      status,
    });
    setSaving(false);
    setBoxName('');
    setCharacterName('');
    setVariantName('通常版');
    setImageUrl('');
    setQuantity('1');
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!!initialJanCode && <Text style={[styles.jan, { color: colors.muted }]}>JAN: {initialJanCode}</Text>}

      <Text style={[styles.label, { color: colors.muted }]}>商品名</Text>
      <TextInput
        value={boxName}
        onChangeText={setBoxName}
        placeholder="例: スーパーかぐや姫！ トレーディング缶バッジ"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>キャラクター</Text>
      <TextInput
        value={characterName}
        onChangeText={setCharacterName}
        placeholder="例: 酒寄彩葉"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>バリエーション</Text>
      <TextInput
        value={variantName}
        onChangeText={setVariantName}
        placeholder="例: ホログラム仕様"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>画像URL</Text>
      <View style={styles.imageRow}>
        <View style={[styles.preview, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          {imageUrl.trim() ? <Image source={{ uri: imageUrl.trim() }} style={styles.previewImage} /> : null}
        </View>
        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.imageInput, { backgroundColor: colors.input, color: colors.text }]}
        />
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>所持数</Text>
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <View style={styles.statusRow}>
        {statuses.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setStatus(value)}
            style={[
              styles.statusButton,
              { borderColor: colors.border },
              status === value && { backgroundColor: colors.text, borderColor: colors.text },
            ]}
          >
            <Text style={[styles.statusText, { color: status === value ? colors.background : colors.text }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityLabel="グッズを保存"
        disabled={disabled}
        onPress={save}
        style={[styles.saveButton, { backgroundColor: disabled ? colors.border : colors.primary }]}
      >
        <Text style={styles.saveText}>{saving ? '保存中' : 'コレクションに追加'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  jan: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: {
    borderRadius: 8,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  imageRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  preview: {
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    overflow: 'hidden',
    width: 58,
  },
  previewImage: { height: '100%', width: '100%' },
  imageInput: {
    borderRadius: 8,
    flex: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  statusText: { fontSize: 13, fontWeight: '800' },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    marginTop: 14,
  },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
