import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeGoodsTile } from '../../src/components/HomeGoodsTile';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods } from '../../src/types';

type GroupMode = 'all' | 'character' | 'series';

const groupModes: Array<[GroupMode, string, keyof typeof Ionicons.glyphMap]> = [
  ['all', '全体', 'albums-outline'],
  ['character', 'キャラ', 'person-outline'],
  ['series', 'シリーズ', 'layers-outline'],
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { goods, loading } = useGoods();
  const listRef = useRef<FlatList<Goods>>(null);
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const ownedGoods = useMemo(() => goods.filter((item) => item.status === 'owned' && item.quantity > 0), [goods]);
  const characterGroups = useMemo(() => uniqueValues(ownedGoods.map((item) => item.characterName || '未分類')), [ownedGoods]);
  const seriesGroups = useMemo(() => uniqueValues(ownedGoods.map((item) => item.seriesName || 'シリーズ未設定')), [ownedGoods]);
  const activeGroups = groupMode === 'character' ? characterGroups : groupMode === 'series' ? seriesGroups : [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ownedGoods.filter((item) => {
      const matchesGroup =
        groupMode === 'all' ||
        selectedGroup === 'all' ||
        (groupMode === 'character' ? item.characterName === selectedGroup : item.seriesName === selectedGroup);
      const target = [item.boxName, item.seriesName, item.characterName, item.variantName, item.janCode].filter(Boolean).join(' ');
      return matchesGroup && (!normalized || target.toLowerCase().includes(normalized));
    });
  }, [groupMode, ownedGoods, query, selectedGroup]);

  const totalQuantity = filtered.reduce((sum, item) => sum + item.quantity, 0);
  useScrollToTop(listRef);

  const switchGroupMode = (nextMode: GroupMode) => {
    setGroupMode(nextMode);
    setSelectedGroup('all');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>OshiList</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : `${filtered.length}種類 / ${totalQuantity}個`}
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
              placeholder="シリーズ・キャラ・仕様で検索"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.input }]}>
          {groupModes.map(([value, label, icon]) => {
            const active = groupMode === value;
            return (
              <Pressable
                key={value}
                onPress={() => switchGroupMode(value)}
                style={[styles.segmentButton, active && { backgroundColor: colors.surface }]}
              >
                <Ionicons color={active ? colors.primary : colors.muted} name={icon} size={17} />
                <Text style={[styles.segmentText, { color: active ? colors.text : colors.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {groupMode !== 'all' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
            <Pressable
              onPress={() => setSelectedGroup('all')}
              style={[
                styles.groupChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                selectedGroup === 'all' && { backgroundColor: colors.text, borderColor: colors.text },
              ]}
            >
              <Text style={[styles.groupChipText, { color: selectedGroup === 'all' ? colors.background : colors.text }]}>
                すべて
              </Text>
            </Pressable>
            {activeGroups.map((group) => (
              <Pressable
                key={group}
                onPress={() => setSelectedGroup(group)}
                style={[
                  styles.groupChip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  selectedGroup === group && { backgroundColor: colors.text, borderColor: colors.text },
                ]}
              >
                <Text style={[styles.groupChipText, { color: selectedGroup === group ? colors.background : colors.text }]}>
                  {group}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
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
  segment: { borderRadius: 8, flexDirection: 'row', gap: 4, marginTop: 10, padding: 4 },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 38,
    justifyContent: 'center',
  },
  segmentText: { fontSize: 12, fontWeight: '900' },
  groupChips: { gap: 8, paddingTop: 10 },
  groupChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  groupChipText: { fontSize: 12, fontWeight: '800' },
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
