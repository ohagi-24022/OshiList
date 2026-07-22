import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeGoodsTile } from '../../src/components/HomeGoodsTile';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { goods, loading } = useGoods();
  const [query, setQuery] = useState('');

  const ownedGoods = useMemo(() => goods.filter((item) => item.status === 'owned' && item.quantity > 0), [goods]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ownedGoods.filter((item) => {
      const target = [item.boxName, item.characterName, item.variantName, item.janCode].filter(Boolean).join(' ');
      return !normalized || target.toLowerCase().includes(normalized);
    });
  }, [ownedGoods, query]);

  const totalQuantity = ownedGoods.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>OshiList</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : `所持中 ${ownedGoods.length}種類 / ${totalQuantity}点`}
            </Text>
          </View>
          <View style={[styles.summaryBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons color={colors.primary} name="albums-outline" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>コレクション</Text>
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
      </View>

      <FlatList
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <HomeGoodsTile item={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="cube-outline" size={40} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>所持中のグッズがありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              追加や編集は管理タブから行えます。ホームには所持しているグッズだけが表示されます。
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
  listContent: { padding: 18, paddingBottom: 96 },
  gridItem: { flex: 1, maxWidth: '48.6%' },
  gridRow: { gap: 10, marginBottom: 10 },
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
