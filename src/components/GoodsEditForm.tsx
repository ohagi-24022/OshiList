import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { uploadSharedImageCandidate } from '../lib/productLookup';
import { useAppTheme } from '../store/ThemeContext';
import { Goods, GoodsInput, GoodsStatus } from '../types';
import { GoodsImageField } from './GoodsImageField';

type Props = {
  item: Goods;
  source?: 'manage' | 'schedule' | 'scan';
  onCancel: () => void;
  onSave: (input: GoodsInput) => Promise<void>;
};

const statuses: Array<[GoodsStatus, string]> = [
  ['owned', '所持'],
  ['reserved', '予約済み'],
  ['ordered', '発送済み'],
  ['shipped', '到着待ち'],
  ['wanted', '欲しい'],
  ['unorganized', '未整理'],
];

const sourceStatusMap: Record<NonNullable<Props['source']>, GoodsStatus[]> = {
  manage: ['owned', 'unorganized'],
  schedule: ['reserved', 'ordered', 'shipped', 'wanted'],
  scan: ['owned', 'reserved', 'unorganized'],
};

const collectionGoalOptions = ['推しだけ収集', '全種コンプ', '無限回収', '各1保管', '交換優先'];
const tagOptions = ['等身', 'ミニキャラ', 'ライブ', '特典', '開封済み', '未開封'];

export function GoodsEditForm({ item, source = 'manage', onCancel, onSave }: Props) {
  const { colors } = useAppTheme();
  const [janCode, setJanCode] = useState(item.janCode ?? '');
  const [boxName, setBoxName] = useState(item.boxName);
  const [seriesName, setSeriesName] = useState(item.seriesName);
  const [characterName, setCharacterName] = useState(item.characterName);
  const [variantName, setVariantName] = useState(item.variantName);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [isRandom, setIsRandom] = useState(item.isRandom);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [status, setStatus] = useState<GoodsStatus>(item.status);
  const [targetQuantity, setTargetQuantity] = useState(String(item.targetQuantity || ''));
  const [keepQuantity, setKeepQuantity] = useState(String(item.keepQuantity || ''));
  const [inUseQuantity, setInUseQuantity] = useState(String(item.inUseQuantity || ''));
  const [exchangeQuantity, setExchangeQuantity] = useState(String(item.exchangeQuantity || ''));
  const [storageLocation, setStorageLocation] = useState(item.storageLocation);
  const [usageLocation, setUsageLocation] = useState(item.usageLocation);
  const [collectionGoal, setCollectionGoal] = useState(item.collectionGoal);
  const [releaseDate, setReleaseDate] = useState(item.releaseDate);
  const [reservationDeadline, setReservationDeadline] = useState(item.reservationDeadline);
  const [pickupDate, setPickupDate] = useState(item.pickupDate);
  const [tags, setTags] = useState(item.tags);
  const [favorite, setFavorite] = useState(item.favorite);
  const [saving, setSaving] = useState(false);
  const [shareImage, setShareImage] = useState(false);

  useEffect(() => {
    setJanCode(item.janCode ?? '');
    setBoxName(item.boxName);
    setSeriesName(item.seriesName);
    setCharacterName(item.characterName);
    setVariantName(item.variantName);
    setImageUrl(item.imageUrl ?? '');
    setIsRandom(item.isRandom);
    setQuantity(String(item.quantity));
    setStatus(item.status);
    setTargetQuantity(String(item.targetQuantity || ''));
    setKeepQuantity(String(item.keepQuantity || ''));
    setInUseQuantity(String(item.inUseQuantity || ''));
    setExchangeQuantity(String(item.exchangeQuantity || ''));
    setStorageLocation(item.storageLocation);
    setUsageLocation(item.usageLocation);
    setCollectionGoal(item.collectionGoal);
    setReleaseDate(item.releaseDate);
    setReservationDeadline(item.reservationDeadline);
    setPickupDate(item.pickupDate);
    setTags(item.tags);
    setFavorite(item.favorite);
    setShareImage(false);
  }, [item]);

  const disabled = !boxName.trim() || saving;
  const visibleStatuses = statuses.filter(([value]) => sourceStatusMap[source].includes(value));
  const showStatusPicker = visibleStatuses.some(([value]) => value !== 'owned' && value !== 'unorganized');
  const tagsList = tags.split(',').map((tag) => tag.trim()).filter(Boolean);

  const toggleTag = (tag: string) => {
    const exists = tagsList.includes(tag);
    const nextTags = exists ? tagsList.filter((value) => value !== tag) : [...tagsList, tag];
    setTags(nextTags.join(', '));
  };

  const save = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSave({
        janCode: janCode.trim() || null,
        boxName: boxName.trim(),
        seriesName: seriesName.trim(),
        characterName: characterName.trim(),
        variantName: variantName.trim() || '通常版',
        quantity: Math.max(0, Number(quantity) || 0),
        imageUrl: imageUrl.trim() || null,
        isRandom,
        status,
        targetQuantity: Math.max(0, Number(targetQuantity) || 0),
        keepQuantity: Math.max(0, Number(keepQuantity) || 0),
        inUseQuantity: Math.max(0, Number(inUseQuantity) || 0),
        exchangeQuantity: Math.max(0, Number(exchangeQuantity) || 0),
        storageLocation,
        usageLocation,
        collectionGoal,
        releaseDate,
        reservationDeadline,
        pickupDate,
        tags,
        favorite,
      });
      if (shareImage && imageUrl.trim().startsWith('file://')) {
        try {
          await uploadSharedImageCandidate({
            janCode: janCode.trim() || null,
            boxName: boxName.trim(),
            seriesName: seriesName.trim(),
            characterName: characterName.trim(),
            variantName: variantName.trim() || '通常版',
            imageKind: characterName.trim() ? 'variant' : 'parent',
            imageUri: imageUrl.trim(),
          });
          setShareImage(false);
        } catch (error) {
          Alert.alert('共有画像を送信できませんでした', error instanceof Error ? error.message : 'ローカル保存は完了しています。');
        }
      }
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
      {imageUrl.trim().startsWith('file://') ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: shareImage }}
          onPress={() => setShareImage((current) => !current)}
          style={[styles.checkRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}
        >
          <Ionicons color={shareImage ? colors.primary : colors.muted} name={shareImage ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
          <View style={styles.checkTextBlock}>
            <Text style={[styles.checkTitle, { color: colors.text }]}>商品画像として共有</Text>
            <Text style={[styles.checkHelp, { color: colors.muted }]}>同じ商品を登録する人の画像候補として、容量制限つきで送信します。</Text>
          </View>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: favorite }}
        onPress={() => setFavorite((current) => !current)}
        style={[styles.checkRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}
      >
        <Ionicons color={favorite ? colors.primary : colors.muted} name={favorite ? 'star' : 'star-outline'} size={22} />
        <View style={styles.checkTextBlock}>
          <Text style={[styles.checkTitle, { color: colors.text }]}>お気に入り</Text>
          <Text style={[styles.checkHelp, { color: colors.muted }]}>よく見返したいグッズとしてホームや検索で見つけやすくします。</Text>
        </View>
      </Pressable>

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
        style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
      />

      <View style={styles.twoColumnRow}>
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>目標数</Text>
          <TextInput value={targetQuantity} onChangeText={setTargetQuantity} keyboardType="number-pad" placeholder="例: 20" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>交換可能数</Text>
          <TextInput value={exchangeQuantity} onChangeText={setExchangeQuantity} keyboardType="number-pad" placeholder="例: 2" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
      </View>

      <View style={styles.twoColumnRow}>
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>保存用</Text>
          <TextInput value={keepQuantity} onChangeText={setKeepQuantity} keyboardType="number-pad" placeholder="例: 1" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>収集方針</Text>
      <View style={styles.chipWrap}>
        {collectionGoalOptions.map((goal) => {
          const active = collectionGoal === goal;
          return (
            <Pressable
              key={goal}
              onPress={() => setCollectionGoal(active ? '' : goal)}
              style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: active ? colors.text : colors.elevated }]}
            >
              <Text style={[styles.choiceChipText, { color: active ? colors.background : colors.text }]}>{goal}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput value={collectionGoal} onChangeText={setCollectionGoal} placeholder="自由入力" placeholderTextColor={colors.muted} style={[styles.input, styles.compactInput, { backgroundColor: colors.input, color: colors.text }]} />

      <View style={styles.twoColumnRow}>
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>予約締切</Text>
          <TextInput value={reservationDeadline} onChangeText={setReservationDeadline} placeholder="2026-08-20" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>発売/受取日</Text>
          <TextInput value={releaseDate || pickupDate} onChangeText={(value) => { setReleaseDate(value); setPickupDate(value); }} placeholder="2026-09-15" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>タグ</Text>
      <View style={styles.chipWrap}>
        {tagOptions.map((tag) => {
          const active = tagsList.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.elevated }]}
            >
              <Text style={[styles.choiceChipText, { color: active ? '#ffffff' : colors.text }]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput value={tags} onChangeText={setTags} placeholder="自由入力はカンマ区切り" placeholderTextColor={colors.muted} style={[styles.input, styles.compactInput, { backgroundColor: colors.input, color: colors.text }]} />

      <View style={[styles.memoBlock, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>メモ・保管</Text>
        <View style={styles.twoColumnRow}>
          <View style={styles.flexItem}>
            <Text style={[styles.label, { color: colors.muted }]}>使用中</Text>
            <TextInput value={inUseQuantity} onChangeText={setInUseQuantity} keyboardType="number-pad" placeholder="例: 1" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>保管場所</Text>
        <TextInput value={storageLocation} onChangeText={setStorageLocation} placeholder="例: ケースB > 2段目 > ポケット3" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />

        <Text style={[styles.label, { color: colors.muted }]}>使用先</Text>
        <TextInput value={usageLocation} onChangeText={setUsageLocation} placeholder="例: 痛バッグ / 祭壇 / ディスプレイ棚" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
      </View>

      {showStatusPicker ? (
        <View style={styles.statusRow}>
          {visibleStatuses.map(([value, label]) => (
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
      ) : (
        <Text style={[styles.autoStatusHelp, { color: colors.muted }]}>シリーズやキャラクターが未入力のものは、自動で未整理に入ります。</Text>
      )}

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
  compactInput: { marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceChipText: { fontSize: 12, fontWeight: '900' },
  memoBlock: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  autoStatusHelp: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 14 },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    height: 42,
    justifyContent: 'center',
  },
  statusText: { fontSize: 13, fontWeight: '800' },
  twoColumnRow: { flexDirection: 'row', gap: 10 },
  flexItem: { flex: 1 },
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
