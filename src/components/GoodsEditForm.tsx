import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../store/ThemeContext';
import { Goods, GoodsInput, GoodsStatus } from '../types';
import { GoodsImageField } from './GoodsImageField';

type Props = {
  item: Goods;
  onCancel: () => void;
  onSave: (input: GoodsInput) => Promise<void>;
};

const statuses: Array<[GoodsStatus, string]> = [
  ['owned', '所持'],
  ['reserved', '予約済み'],
  ['wanted', '欲しい'],
  ['unorganized', '未整理'],
];

export function GoodsEditForm({ item, onCancel, onSave }: Props) {
  const { colors } = useAppTheme();
  const [janCode, setJanCode] = useState(item.janCode ?? '');
  const [boxName, setBoxName] = useState(item.boxName);
  const [seriesName, setSeriesName] = useState(item.seriesName);
  const [characterName, setCharacterName] = useState(item.characterName);
  const [variantName, setVariantName] = useState(item.variantName);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [status, setStatus] = useState<GoodsStatus>(item.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setJanCode(item.janCode ?? '');
    setBoxName(item.boxName);
    setSeriesName(item.seriesName);
    setCharacterName(item.characterName);
    setVariantName(item.variantName);
    setImageUrl(item.imageUrl ?? '');
    setQuantity(String(item.quantity));
    setStatus(item.status);
  }, [item]);

  const disabled = !boxName.trim() || saving;

  const save = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSave({
        janCode: janCode.trim() || null,
        boxName: boxName.trim(),
        seriesName: seriesName.trim() || 'シリーズ未設定',
        characterName: characterName.trim() || '未分類',
        variantName: variantName.trim() || '通常版',
        quantity: Math.max(0, Number(quantity) || 0),
        imageUrl: imageUrl.trim() || null,
        status,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: colors.muted }]}>JANコード</Text>
      <TextInput
        value={janCode}
        onChangeText={setJanCode}
        keyboardType="number-pad"
        placeholder="未設定"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>商品名</Text>
      <TextInput
        value={boxName}
        onChangeText={setBoxName}
        placeholder="商品名"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>シリーズ</Text>
      <TextInput
        value={seriesName}
        onChangeText={setSeriesName}
        placeholder="シリーズ未設定"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>キャラクター</Text>
      <TextInput
        value={characterName}
        onChangeText={setCharacterName}
        placeholder="空欄なら未分類"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>バリエーション</Text>
      <TextInput
        value={variantName}
        onChangeText={setVariantName}
        placeholder="通常版"
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>画像</Text>
      <GoodsImageField value={imageUrl} onChange={setImageUrl} />

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

      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel="編集をキャンセル"
          onPress={onCancel}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>キャンセル</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="編集内容を保存"
          disabled={disabled}
          onPress={save}
          style={[styles.saveButton, { backgroundColor: disabled ? colors.border : colors.primary }]}
        >
          <Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: {
    borderRadius: 8,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  statusText: { fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '800' },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
