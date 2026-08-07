import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCharacterAccentColor } from '../lib/characterAccent';
import { goodsStatusLabels } from '../lib/goodsStatus';
import { isOshiGoods } from '../lib/oshi';
import { useProfile } from '../store/ProfileContext';
import { useAppTheme } from '../store/ThemeContext';
import { Goods } from '../types';
import { CounterButton } from './CounterButton';

type Props = {
  item: Goods;
  mode?: 'view' | 'manage';
  onDecrease?: () => void;
  onIncrease?: () => void;
  onPress?: () => void;
  onRemove?: () => void;
  onToggleFavorite?: () => void;
};

export function GoodsCard({ item, mode = 'manage', onDecrease, onIncrease, onPress, onRemove, onToggleFavorite }: Props) {
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const isManage = mode === 'manage';
  const markedAsOshi = isOshiGoods(item, profile);
  const characterColor = getCharacterAccentColor(item, colors);
  const markColor = profile.markColor || colors.primary;
  const markIcon = (profile.markIcon || 'heart') as keyof typeof Ionicons.glyphMap;
  const accentColor = markedAsOshi ? markColor : characterColor;
  const targetReached = item.targetQuantity > 0 && item.quantity >= item.targetQuantity;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: accentColor ?? colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: colors.elevated }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <Ionicons color={colors.muted} name="image-outline" size={34} />
        )}
        {markedAsOshi ? (
          <View style={[styles.coverBadge, { backgroundColor: markColor }]}>
            <Ionicons color="#ffffff" name={markIcon} size={13} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
            {item.boxName}
          </Text>
          {isManage && onRemove ? (
            <Pressable
              accessibilityLabel="グッズを削除"
              onPress={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              style={styles.removeButton}
            >
              <Ionicons color={colors.muted} name="trash-outline" size={17} />
            </Pressable>
          ) : null}
          {isManage && onToggleFavorite ? (
            <Pressable
              accessibilityLabel={item.favorite ? 'お気に入りを解除' : 'お気に入りに追加'}
              onPress={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              style={styles.removeButton}
            >
              <Ionicons color={item.favorite ? colors.primary : colors.muted} name={item.favorite ? 'star' : 'star-outline'} size={18} />
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.series, { color: colors.muted }]}>
          {item.seriesName}
        </Text>
        <View style={styles.characterRow}>
          <Text numberOfLines={1} style={[styles.character, { color: accentColor ?? colors.text }]}>
            {item.characterName}
          </Text>
          {markedAsOshi ? (
            <View style={[styles.oshiBadge, { backgroundColor: markColor }]}>
              <Ionicons color="#ffffff" name={markIcon} size={12} />
              <Text style={styles.oshiText}>推し</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.variant, { color: colors.muted }]}>
          {item.variantName}
        </Text>
        {item.targetQuantity > 0 ? (
          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: colors.input }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: targetReached ? colors.secondary : colors.primary,
                    width: `${Math.min(100, Math.round((item.quantity / item.targetQuantity) * 100))}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.metaText, { color: colors.muted }]}>
              現在 {item.quantity} / 目標 {item.targetQuantity}
            </Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          {item.favorite ? <MetaChip icon="star" label="お気に入り" color={colors.primary} /> : null}
          {item.exchangeQuantity > 0 ? <MetaChip icon="swap-horizontal-outline" label={`交換 ${item.exchangeQuantity}`} color={colors.secondary} /> : null}
          {item.inUseQuantity > 0 ? <MetaChip icon="bag-handle-outline" label={`使用中 ${item.inUseQuantity}`} color={colors.primary} /> : null}
          {item.storageLocation ? <MetaChip icon="file-tray-full-outline" label={item.storageLocation} color={colors.muted} /> : null}
        </View>
        {item.tags ? (
          <Text numberOfLines={1} style={[styles.tags, { color: colors.muted }]}>
            #{item.tags.split(',').map((tag) => tag.trim()).filter(Boolean).join(' #')}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.statusGroup}>
            <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
              <View style={[styles.dot, { backgroundColor: characterColor ?? colors.secondary }]} />
              <Text style={[styles.statusText, { color: colors.muted }]}>{goodsStatusLabels[item.status]}</Text>
            </View>
            {item.isRandom ? (
              <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
                <Ionicons color={colors.primary} name="shuffle-outline" size={12} />
                <Text style={[styles.statusText, { color: colors.muted }]}>ランダム</Text>
              </View>
            ) : null}
          </View>
          {isManage && onDecrease && onIncrease ? (
            <CounterButton quantity={item.quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
          ) : (
            <View style={[styles.quantityBadge, { backgroundColor: characterColor ?? colors.primary }]}>
              <Text style={styles.quantityText}>{item.quantity}個</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function MetaChip({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons color={color} name={icon} size={11} />
      <Text numberOfLines={1} style={[styles.metaChipText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 10,
  },
  cover: {
    alignItems: 'center',
    borderRadius: 6,
    height: 112,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 82,
  },
  coverBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    left: 6,
    position: 'absolute',
    top: 6,
    width: 26,
  },
  image: { height: '100%', width: '100%' },
  body: { flex: 1, minWidth: 0 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  removeButton: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  series: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  characterRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 5 },
  character: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  oshiBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    height: 24,
    paddingHorizontal: 8,
  },
  oshiText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  variant: { fontSize: 12, marginTop: 3 },
  progressBlock: { gap: 5, marginTop: 8 },
  progressTrack: { borderRadius: 999, height: 7, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: '100%' },
  metaText: { fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaChip: { alignItems: 'center', flexDirection: 'row', gap: 3, maxWidth: '100%' },
  metaChipText: { fontSize: 10, fontWeight: '900', maxWidth: 140 },
  tags: { fontSize: 10, fontWeight: '800', marginTop: 6 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statusGroup: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap', gap: 6 },
  status: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
  },
  dot: { borderRadius: 999, height: 7, width: 7 },
  statusText: { fontSize: 11, fontWeight: '700' },
  quantityBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: 12,
  },
  quantityText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
});
