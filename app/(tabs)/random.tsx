import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabReset } from '../../src/hooks/useTabReset';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods } from '../../src/types';

type RandomLineupGroup = {
  key: string;
  boxName: string;
  seriesName: string;
  imageUrl: string | null;
  items: Goods[];
  latestId: number;
  totalQuantity: number;
};

function compareText(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), 'ja', { sensitivity: 'base', numeric: true });
}

function buildRandomLineups(goods: Goods[]) {
  const grouped = new Map<string, Goods[]>();

  goods.forEach((item) => {
    if (!item.isRandom || (item.status !== 'owned' && item.status !== 'unorganized') || item.quantity <= 0) return;
    const key = [item.janCode ?? '', item.seriesName, item.boxName].join('::');
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return Array.from(grouped.entries())
    .map(([key, items]): RandomLineupGroup => {
      const sortedItems = [...items].sort(
        (a, b) => compareText(a.characterName, b.characterName) || compareText(a.variantName, b.variantName) || b.id - a.id,
      );
      const representative = sortedItems.find((item) => item.imageUrl) ?? sortedItems[0];
      return {
        key,
        boxName: representative.boxName,
        seriesName: representative.seriesName,
        imageUrl: representative.imageUrl,
        items: sortedItems,
        latestId: Math.max(...sortedItems.map((item) => item.id)),
        totalQuantity: sortedItems.reduce((sum, item) => sum + item.quantity, 0),
      };
    })
    .sort((a, b) => b.latestId - a.latestId);
}

export default function RandomOpeningScreen() {
  const { colors } = useAppTheme();
  const { goods, updateQuantity } = useGoods();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<number, number>>({});

  const lineups = useMemo(() => buildRandomLineups(goods), [goods]);
  const selectedLineup = lineups.find((lineup) => lineup.key === selectedKey) ?? null;
  const sessionTotal = Object.values(sessionCounts).reduce((sum, count) => sum + count, 0);

  useTabReset(scrollRef, () => setSelectedKey(null));

  const recordOpening = async (item: Goods) => {
    await updateQuantity(item.id, 1);
    setSessionCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <View style={styles.titleText}>
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>ランダム開封</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>ラインナップごとに、どれが何個出たかを記録します。</Text>
          </View>
          <View style={[styles.sessionBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.sessionBadgeText}>今回 {sessionTotal}</Text>
          </View>
        </View>

        {lineups.length ? (
          <View style={styles.lineupList}>
            {lineups.map((lineup) => {
              const active = lineup.key === selectedKey;
              return (
                <Pressable
                  key={lineup.key}
                  onPress={() => setSelectedKey(active ? null : lineup.key)}
                  style={[
                    styles.lineupCard,
                    { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border },
                  ]}
                >
                  <View style={[styles.lineupImageBox, { backgroundColor: active ? colors.background : colors.elevated }]}>
                    {lineup.imageUrl ? (
                      <Image source={{ uri: lineup.imageUrl }} style={styles.lineupImage} />
                    ) : (
                      <Ionicons color={active ? colors.primary : colors.muted} name="image-outline" size={24} />
                    )}
                  </View>
                  <View style={styles.lineupText}>
                    <Text numberOfLines={1} style={[styles.lineupTitle, { color: active ? colors.background : colors.text }]}>
                      {lineup.boxName}
                    </Text>
                    <Text numberOfLines={1} style={[styles.lineupMeta, { color: active ? colors.background : colors.muted }]}>
                      {lineup.seriesName || 'シリーズ未設定'} / {lineup.items.length}種 / 所持 {lineup.totalQuantity}個
                    </Text>
                  </View>
                  <Ionicons color={active ? colors.background : colors.muted} name={active ? 'chevron-up' : 'chevron-down'} size={20} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="cube-outline" size={34} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>ランダムグッズがまだありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              バーコード登録などでランダムグッズとして保存されると、ここにラインナップ単位で表示されます。
            </Text>
          </View>
        )}

        {selectedLineup ? (
          <View style={[styles.detailPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleBlock}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>開封結果</Text>
                <Text style={[styles.detailMeta, { color: colors.muted }]}>
                  {selectedLineup.items.length}種 / 合計 {selectedLineup.totalQuantity}個
                </Text>
              </View>
              {sessionTotal ? (
                <Pressable onPress={() => setSessionCounts({})} style={[styles.resetButton, { backgroundColor: colors.elevated }]}>
                  <Text style={[styles.resetText, { color: colors.text }]}>今回分リセット</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.itemList}>
              {selectedLineup.items.map((item) => (
                <View key={item.id} style={[styles.itemRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <View style={[styles.itemImageBox, { backgroundColor: colors.input }]}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.itemImage} /> : <Ionicons color={colors.muted} name="image-outline" size={20} />}
                  </View>
                  <View style={styles.itemText}>
                    <Text numberOfLines={1} style={[styles.itemTitle, { color: colors.text }]}>
                      {item.characterName || 'キャラクター未設定'}
                    </Text>
                    <Text numberOfLines={1} style={[styles.itemMeta, { color: colors.muted }]}>
                      {item.variantName || '通常'} / 所持 {item.quantity}個 / 今回 +{sessionCounts[item.id] ?? 0}
                    </Text>
                  </View>
                  <Pressable onPress={() => recordOpening(item)} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                    <Ionicons color="#ffffff" name="add" size={22} />
                    <Text style={styles.addButtonText}>1</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : lineups.length ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="list-outline" size={30} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>ラインナップを選択</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>開封する親商品を選ぶと、各キャラや仕様ごとに +1 で記録できます。</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 16, paddingBottom: 96 },
  titleBlock: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  titleText: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  sessionBadge: { borderRadius: 8, flexShrink: 0, paddingHorizontal: 10, paddingVertical: 8 },
  sessionBadgeText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  lineupList: { gap: 10 },
  lineupCard: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, padding: 10 },
  lineupImageBox: { alignItems: 'center', borderRadius: 8, height: 56, justifyContent: 'center', overflow: 'hidden', width: 56 },
  lineupImage: { height: '100%', width: '100%' },
  lineupText: { flex: 1, minWidth: 0 },
  lineupTitle: { fontSize: 15, fontWeight: '900' },
  lineupMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  emptyBox: { alignItems: 'center', borderRadius: 8, borderWidth: 1, gap: 8, padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  detailPanel: { borderRadius: 8, borderWidth: 1, padding: 12 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 10 },
  detailTitleBlock: { flex: 1, minWidth: 0 },
  detailTitle: { fontSize: 18, fontWeight: '900' },
  detailMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  resetButton: { borderRadius: 8, flexShrink: 0, paddingHorizontal: 10, paddingVertical: 8 },
  resetText: { fontSize: 12, fontWeight: '900' },
  itemList: { gap: 9 },
  itemRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 72, padding: 9 },
  itemImageBox: { alignItems: 'center', borderRadius: 8, height: 52, justifyContent: 'center', overflow: 'hidden', width: 52 },
  itemImage: { height: '100%', width: '100%' },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 15, fontWeight: '900' },
  itemMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  addButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', flexShrink: 0, gap: 2, height: 46, justifyContent: 'center', width: 58 },
  addButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
