import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { GoodsStatus } from '../../src/types';

const filters: Array<[GoodsStatus | 'all', string]> = [
  ['all', 'すべて'],
  ['owned', '所持'],
  ['reserved', '予約済み'],
  ['wanted', '欲しい'],
];

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { goods, loading, updateQuantity, removeGoods } = useGoods();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GoodsStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return goods.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter;
      const target = [item.boxName, item.characterName, item.variantName, item.janCode].filter(Boolean).join(' ');
      return matchesFilter && (!normalized || target.toLowerCase().includes(normalized));
    });
  }, [filter, goods, query]);

  const totalQuantity = goods.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>OshiList</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : `${goods.length}種類 / ${totalQuantity}点`}
            </Text>
          </View>
          <View style={[styles.summaryBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons color={colors.primary} name="sparkles" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>重複防止</Text>
          </View>
        </View>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.input }]}>
            <Ionicons color={colors.muted} name="search" size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="作品・キャラ・仕様で検索"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          {filters.map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filter,
                { borderColor: colors.border, backgroundColor: colors.surface },
                filter === value && { backgroundColor: colors.text, borderColor: colors.text },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === value ? colors.background : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <GoodsCard
            item={item}
            onDecrease={() => updateQuantity(item.id, -1)}
            onIncrease={() => updateQuantity(item.id, 1)}
            onRemove={() =>
              Alert.alert('削除しますか？', `${item.characterName} / ${item.variantName}`, [
                { text: 'キャンセル', style: 'cancel' },
                { text: '削除', style: 'destructive', onPress: () => removeGoods(item.id) },
              ])
            }
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="cube-outline" size={40} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>まだ登録がありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              スキャンまたは手動登録から、最初の推しグッズを追加できます。
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 2 },
  summaryBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
  },
  summaryText: { fontSize: 12, fontWeight: '800' },
  searchRow: { marginTop: 14 },
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filter: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  filterText: { fontSize: 12, fontWeight: '800' },
  listContent: { padding: 18, paddingBottom: 96 },
  empty: {
    alignItems: 'center',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: 36,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
});
