import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
};

const statusLabels: Record<Goods['status'], string> = {
  owned: '所持',
  reserved: '予約済み',
  wanted: '欲しい',
};

export function GoodsCard({ item, mode = 'manage', onDecrease, onIncrease, onPress, onRemove }: Props) {
  const { colors } = useAppTheme();
  const isManage = mode === 'manage';

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
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
        </View>
        <Text numberOfLines={1} style={[styles.character, { color: colors.text }]}>
          {item.characterName}
        </Text>
        <Text numberOfLines={1} style={[styles.variant, { color: colors.muted }]}>
          {item.variantName}
        </Text>
        <View style={styles.footer}>
          <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <Text style={[styles.statusText, { color: colors.muted }]}>{statusLabels[item.status]}</Text>
          </View>
          {isManage && onDecrease && onIncrease ? (
            <CounterButton quantity={item.quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
          ) : (
            <View style={[styles.quantityBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.quantityText}>{item.quantity}点</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
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
    width: 82,
  },
  image: { height: '100%', width: '100%' },
  body: { flex: 1, minWidth: 0 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  removeButton: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  character: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  variant: { fontSize: 12, marginTop: 3 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
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
