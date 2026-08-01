import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeGoodsTile } from '../../src/components/HomeGoodsTile';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods } from '../../src/types';

type GroupMode = 'all' | 'character' | 'series';
type SortMode = 'created' | 'character' | 'seriesCharacter';

const groupModes: Array<[GroupMode, string, keyof typeof Ionicons.glyphMap]> = [
  ['all', '全体', 'albums-outline'],
  ['character', 'キャラ', 'person-outline'],
  ['series', 'シリーズ', 'layers-outline'],
];

const sortModes: Array<[SortMode, string, keyof typeof Ionicons.glyphMap]> = [
  ['created', '追加順', 'time-outline'],
  ['character', 'キャラクター順(全体)', 'person-outline'],
  ['seriesCharacter', 'キャラクター順(シリーズ)', 'layers-outline'],
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
}

function compareText(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), 'ja', { sensitivity: 'base', numeric: true });
}

function compareByCreated(a: Goods, b: Goods) {
  return b.id - a.id;
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { goods, loading } = useGoods();
  const listRef = useRef<FlatList<Goods>>(null);
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

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

  const sortedGoods = useMemo(() => {
    const nextGoods = [...filtered];
    if (sortMode === 'character') {
      return nextGoods.sort(
        (a, b) =>
          compareText(a.characterName, b.characterName) ||
          compareText(a.seriesName, b.seriesName) ||
          compareText(a.boxName, b.boxName) ||
          compareByCreated(a, b),
      );
    }
    if (sortMode === 'seriesCharacter') {
      return nextGoods.sort(
        (a, b) =>
          compareText(a.seriesName, b.seriesName) ||
          compareText(a.characterName, b.characterName) ||
          compareText(a.boxName, b.boxName) ||
          compareByCreated(a, b),
      );
    }
    return nextGoods.sort(compareByCreated);
  }, [filtered, sortMode]);

  const totalQuantity = sortedGoods.reduce((sum, item) => sum + item.quantity, 0);
  const activeSort = sortModes.find(([value]) => value === sortMode) ?? sortModes[0];
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="並び替えを変更"
            onPress={() => setSortMenuVisible(true)}
            style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons color={colors.primary} name="swap-vertical-outline" size={18} />
            <Text numberOfLines={1} style={[styles.sortButtonText, { color: colors.text }]}>
              {activeSort[1]}
            </Text>
          </Pressable>
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

      <Modal animationType="fade" transparent visible={sortMenuVisible} onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setSortMenuVisible(false)}>
          <Pressable style={[styles.sortSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.sortSheetHeader}>
              <Text style={[styles.sortSheetTitle, { color: colors.text }]}>並び替え</Text>
              <Pressable accessibilityLabel="並び替えを閉じる" onPress={() => setSortMenuVisible(false)} style={styles.sortCloseButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>
            {sortModes.map(([value, label, icon]) => {
              const active = sortMode === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSortMode(value);
                    setSortMenuVisible(false);
                  }}
                  style={[
                    styles.sortOption,
                    { backgroundColor: active ? colors.surface : colors.background, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.sortOptionIcon, { backgroundColor: active ? colors.primary : colors.elevated }]}>
                    <Ionicons color={active ? '#ffffff' : colors.muted} name={icon} size={18} />
                  </View>
                  <Text style={[styles.sortOptionText, { color: colors.text }]}>{label}</Text>
                  {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={22} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        ref={listRef}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        data={sortedGoods}
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
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  sortButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 44,
    justifyContent: 'center',
    maxWidth: 138,
    minWidth: 96,
    paddingHorizontal: 10,
  },
  sortButtonText: { flexShrink: 1, fontSize: 12, fontWeight: '900' },
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
  sortOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sortSheet: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 1,
    padding: 18,
    paddingBottom: 28,
  },
  sortSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortSheetTitle: { fontSize: 17, fontWeight: '900' },
  sortCloseButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  sortOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  sortOptionIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sortOptionText: { flex: 1, fontSize: 14, fontWeight: '900' },
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
