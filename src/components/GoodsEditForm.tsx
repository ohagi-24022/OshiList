import Ionicons from '@expo/vector-icons/Ionicons';
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
  ['ordered', '発送済み'],
  ['shipped', '到着待ち'],
  ['arrived', '到着'],
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
        <View style={styles.flexItem}>
          <Text style={[styles.label, { color: colors.muted }]}>使用中</Text>
          <TextInput value={inUseQuantity} onChangeText={setInUseQuantity} keyboardType="number-pad" placeholder="例: 24" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>保管場所</Text>
      <TextInput value={storageLocation} onChangeText={setStorageLocation} placeholder="例: ケースB > 2段目 > ポケット3" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />

      <Text style={[styles.label, { color: colors.muted }]}>使用先</Text>
      <TextInput value={usageLocation} onChangeText={setUsageLocation} placeholder="例: 痛バッグ / 祭壇 / ディスプレイ棚" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />

      <Text style={[styles.label, { color: colors.muted }]}>収集方針</Text>
      <TextInput value={collectionGoal} onChangeText={setCollectionGoal} placeholder="例: 推しだけ収集 / 無限回収 / 全種コンプ" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />

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
      <TextInput value={tags} onChangeText={setTags} placeholder="例: 等身, ライブ, お気に入り" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: favorite }}
        onPress={() => setFavorite((current) => !current)}
        style={[styles.checkRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}
      >
        <Ionicons color={favorite ? colors.primary : colors.muted} name={favorite ? 'star' : 'star-outline'} size={22} />
        <View style={styles.checkTextBlock}>
          <Text style={[styles.checkTitle, { color: colors.text }]}>お気に入り</Text>
          <Text style={[styles.checkHelp, { color: colors.muted }]}>特に好きなグッズとしてホームや検索で見つけやすくします。</Text>
        </View>
      </Pressable>

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
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
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
