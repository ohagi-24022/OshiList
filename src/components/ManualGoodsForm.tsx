import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useGoods } from '../store/GoodsContext';
import { useRegistrationPresets } from '../store/RegistrationPresetContext';
import { useAppTheme } from '../store/ThemeContext';
import { GoodsInput, GoodsStatus } from '../types';
import { GoodsImageField } from './GoodsImageField';

type Props = {
  initialJanCode?: string | null;
  initialBoxName?: string;
  initialSeriesName?: string;
  initialCharacterName?: string;
  initialVariantName?: string;
  initialImageUrl?: string | null;
  initialIsRandom?: boolean;
  initialStatus?: GoodsStatus;
  onSubmit: (input: GoodsInput) => Promise<void>;
};

const statuses: Array<[GoodsStatus, string]> = [
  ['owned', '所持'],
  ['reserved', '予約済み'],
  ['ordered', '発送済み'],
  ['shipped', '到着待ち'],
  ['arrived', '到着'],
  ['wanted', '欲しい'],
  ['unorganized', '未整理'],
];

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

export function ManualGoodsForm({
  initialJanCode,
  initialBoxName = '',
  initialSeriesName = '',
  initialCharacterName = '',
  initialVariantName = '通常版',
  initialImageUrl = null,
  initialIsRandom = false,
  initialStatus = 'owned',
  onSubmit,
}: Props) {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const { presets, addPreset, removePreset } = useRegistrationPresets();
  const [boxName, setBoxName] = useState(initialBoxName);
  const [seriesName, setSeriesName] = useState(initialSeriesName);
  const [characterName, setCharacterName] = useState(initialCharacterName);
  const [variantName, setVariantName] = useState(initialVariantName);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? '');
  const [isRandom, setIsRandom] = useState(initialIsRandom);
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState<GoodsStatus>(initialStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBoxName(initialBoxName);
    setSeriesName(initialSeriesName);
    setCharacterName(initialCharacterName);
    setVariantName(initialVariantName);
    setImageUrl(initialImageUrl ?? '');
    setIsRandom(initialIsRandom);
    setStatus(initialStatus);
  }, [initialBoxName, initialSeriesName, initialCharacterName, initialVariantName, initialImageUrl, initialIsRandom, initialStatus]);

  const seriesSuggestions = useMemo(() => unique(goods.map((item) => item.seriesName)), [goods]);
  const characterSuggestions = useMemo(() => unique(goods.map((item) => item.characterName)), [goods]);
  const variantSuggestions = useMemo(() => unique(goods.map((item) => item.variantName)), [goods]);

  const disabled = !boxName.trim() || saving;
  const canSavePreset = !!seriesName.trim() || !!characterName.trim();

  const savePreset = async () => {
    if (!canSavePreset) return;
    const nextSeriesName = seriesName.trim() || 'シリーズ未設定';
    const nextCharacterName = characterName.trim() || '未分類';
    const nextVariantName = variantName.trim() || '通常版';
    await addPreset({
      name: [nextSeriesName, nextCharacterName, nextVariantName].filter(Boolean).join(' / '),
      seriesName: nextSeriesName,
      characterName: nextCharacterName,
      variantName: nextVariantName,
    });
    Alert.alert('プリセットを保存しました', '次回以降の登録でこの組み合わせを呼び出せます。');
  };

  const save = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSubmit({
        janCode: initialJanCode ?? null,
        boxName: boxName.trim(),
        seriesName: seriesName.trim() || 'シリーズ未設定',
        characterName: characterName.trim() || '未分類',
        variantName: variantName.trim() || '通常版',
        quantity: Math.max(0, Number(quantity) || 0),
        imageUrl: imageUrl.trim() || null,
        isRandom,
        status,
      });
      setBoxName('');
      setSeriesName('');
      setCharacterName('');
      setVariantName('通常版');
      setImageUrl('');
      setIsRandom(initialIsRandom);
      setQuantity('1');
      setStatus(initialStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!!initialJanCode && <Text style={[styles.jan, { color: colors.muted }]}>JAN: {initialJanCode}</Text>}

      {!!presets.length && (
        <View style={styles.presetBlock}>
          <Text style={[styles.label, { color: colors.muted }]}>登録プリセット</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {presets.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => {
                  setSeriesName(preset.seriesName);
                  setCharacterName(preset.characterName);
                  setVariantName(preset.variantName);
                }}
                onLongPress={() =>
                  Alert.alert('プリセットを削除しますか？', preset.name, [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '削除', style: 'destructive', onPress: () => removePreset(preset.id) },
                  ])
                }
                style={[styles.presetChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
              >
                <Ionicons color={colors.primary} name="bookmark-outline" size={14} />
                <Text numberOfLines={1} style={[styles.presetChipText, { color: colors.text }]}>
                  {preset.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.helper, { color: colors.muted }]}>長押しでプリセットを削除できます。</Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.muted }]}>商品名</Text>
      <TextInput
        value={boxName}
        onChangeText={setBoxName}
        placeholder="例: トレーディング缶バッジ"
        placeholderTextColor={colors.muted}
        returnKeyType="next"
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>シリーズ</Text>
      <TextInput
        value={seriesName}
        onChangeText={setSeriesName}
        placeholder="例: スーパーかぐや姫！"
        placeholderTextColor={colors.muted}
        returnKeyType="next"
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />
      <SuggestionChips values={seriesSuggestions} onSelect={setSeriesName} />

      <Text style={[styles.label, { color: colors.muted }]}>キャラクター</Text>
      <TextInput
        value={characterName}
        onChangeText={setCharacterName}
        placeholder="空欄なら未分類"
        placeholderTextColor={colors.muted}
        returnKeyType="next"
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />
      <SuggestionChips values={characterSuggestions} onSelect={setCharacterName} />
      <Text style={[styles.helper, { color: colors.muted }]}>過去に登録した名前は候補として表示されます。</Text>

      <Text style={[styles.label, { color: colors.muted }]}>バリエーション</Text>
      <TextInput
        value={variantName}
        onChangeText={setVariantName}
        placeholder="例: ホログラム仕様"
        placeholderTextColor={colors.muted}
        returnKeyType="next"
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />
      <SuggestionChips values={variantSuggestions} onSelect={setVariantName} />

      <Pressable
        disabled={!canSavePreset}
        onPress={savePreset}
        style={[styles.presetSaveButton, { borderColor: colors.border, opacity: canSavePreset ? 1 : 0.5 }]}
      >
        <Ionicons color={colors.text} name="bookmark-outline" size={17} />
        <Text style={[styles.presetSaveText, { color: colors.text }]}>この入力をプリセット保存</Text>
      </Pressable>

      <Text style={[styles.label, { color: colors.muted }]}>画像</Text>
      <GoodsImageField value={imageUrl} onChange={setImageUrl} />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isRandom }}
        onPress={() => setIsRandom((current) => !current)}
        style={[styles.checkRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}
      >
        <Ionicons color={isRandom ? colors.primary : colors.muted} name={isRandom ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
        <View style={styles.checkTextBlock}>
          <Text style={[styles.checkTitle, { color: colors.text }]}>ランダムグッズ</Text>
          <Text style={[styles.checkHelp, { color: colors.muted }]}>交換可能グッズや収集率の対象にします。</Text>
        </View>
      </Pressable>

      <Text style={[styles.label, { color: colors.muted }]}>所持数</Text>
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        returnKeyType="done"
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

function SuggestionChips({ values, onSelect }: { values: string[]; onSelect: (value: string) => void }) {
  const { colors } = useAppTheme();
  if (!values.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.suggestionChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
        >
          <Text numberOfLines={1} style={[styles.suggestionText, { color: colors.text }]}>
            {value}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  jan: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  presetBlock: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  input: {
    borderRadius: 8,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  chipRow: { gap: 8, paddingVertical: 8 },
  suggestionChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    maxWidth: 180,
    paddingHorizontal: 12,
  },
  suggestionText: { fontSize: 12, fontWeight: '800' },
  presetChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: 34,
    maxWidth: 220,
    paddingHorizontal: 12,
  },
  presetChipText: { fontSize: 12, fontWeight: '800' },
  presetSaveButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
    marginTop: 12,
  },
  presetSaveText: { fontSize: 13, fontWeight: '900' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    height: 38,
    justifyContent: 'center',
  },
  statusText: { fontSize: 13, fontWeight: '800' },
  checkRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  checkTextBlock: { flex: 1 },
  checkTitle: { fontSize: 14, fontWeight: '900' },
  checkHelp: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 2 },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    marginTop: 14,
  },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
