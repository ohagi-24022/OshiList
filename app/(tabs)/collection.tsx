import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeGoodsTile } from '../../src/components/HomeGoodsTile';
import { useAppSettings } from '../../src/store/AppSettingsContext';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods } from '../../src/types';

type GroupMode = 'all' | 'character' | 'series';
type SortMode = 'created' | 'character' | 'seriesCharacter';
type RandomGoodsGroup = {
  type: 'randomGroup';
  key: string;
  boxName: string;
  seriesName: string;
  imageUrl: string | null;
  quantity: number;
  itemCount: number;
  latestId: number;
  items: Goods[];
};
type CollectionEntry = Goods | RandomGoodsGroup;

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

function isRandomGroup(entry: CollectionEntry): entry is RandomGoodsGroup {
  return 'type' in entry && entry.type === 'randomGroup';
}

function getEntrySeriesName(entry: CollectionEntry) {
  return isRandomGroup(entry) ? entry.seriesName : entry.seriesName;
}

function getEntryCharacterName(entry: CollectionEntry) {
  return isRandomGroup(entry) ? '' : entry.characterName;
}

function getEntryBoxName(entry: CollectionEntry) {
  return isRandomGroup(entry) ? entry.boxName : entry.boxName;
}

function getEntryLatestId(entry: CollectionEntry) {
  return isRandomGroup(entry) ? entry.latestId : entry.id;
}

function groupRandomGoods(goods: Goods[]) {
  const grouped = new Map<string, Goods[]>();
  const entries: CollectionEntry[] = [];

  goods.forEach((item) => {
    if (!item.isRandom) {
      entries.push(item);
      return;
    }
    const key = [item.janCode ?? '', item.seriesName, item.boxName].join('::');
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  grouped.forEach((items, key) => {
    const sortedItems = [...items].sort(
      (a, b) => compareText(a.characterName, b.characterName) || compareText(a.variantName, b.variantName) || compareByCreated(a, b),
    );
    const representative = sortedItems.find((item) => item.imageUrl) ?? sortedItems[0];
    entries.push({
      type: 'randomGroup',
      key,
      boxName: representative.boxName,
      seriesName: representative.seriesName,
      imageUrl: representative.imageUrl,
      quantity: sortedItems.reduce((sum, item) => sum + item.quantity, 0),
      itemCount: sortedItems.length,
      latestId: Math.max(...sortedItems.map((item) => item.id)),
      items: sortedItems,
    });
  });

  return entries;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { goods, loading } = useGoods();
  const { settings } = useAppSettings();
  const listRef = useRef<FlatList<CollectionEntry>>(null);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerHiddenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(190);
  const [selectedRandomGroup, setSelectedRandomGroup] = useState<RandomGoodsGroup | null>(null);

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

  const collectionEntries = useMemo(() => (settings.groupRandomGoods ? groupRandomGoods(filtered) : filtered), [filtered, settings.groupRandomGoods]);

  const sortedEntries = useMemo(() => {
    const nextEntries = [...collectionEntries];
    if (sortMode === 'character') {
      return nextEntries.sort(
        (a, b) =>
          compareText(getEntryCharacterName(a), getEntryCharacterName(b)) ||
          compareText(getEntrySeriesName(a), getEntrySeriesName(b)) ||
          compareText(getEntryBoxName(a), getEntryBoxName(b)) ||
          getEntryLatestId(b) - getEntryLatestId(a),
      );
    }
    if (sortMode === 'seriesCharacter') {
      return nextEntries.sort(
        (a, b) =>
          compareText(getEntrySeriesName(a), getEntrySeriesName(b)) ||
          compareText(getEntryCharacterName(a), getEntryCharacterName(b)) ||
          compareText(getEntryBoxName(a), getEntryBoxName(b)) ||
          getEntryLatestId(b) - getEntryLatestId(a),
      );
    }
    return nextEntries.sort((a, b) => getEntryLatestId(b) - getEntryLatestId(a));
  }, [collectionEntries, sortMode]);

  const totalQuantity = filtered.reduce((sum, item) => sum + item.quantity, 0);
  const visibleSortModes = useMemo(
    () =>
      sortModes.filter(([value]) => {
        if (groupMode === 'character') return value !== 'character';
        if (groupMode === 'series') return value !== 'seriesCharacter';
        return true;
      }),
    [groupMode],
  );
  useScrollToTop(listRef);

  const setHeaderHidden = (hidden: boolean) => {
    if (headerHiddenRef.current === hidden) return;
    headerHiddenRef.current = hidden;
    Animated.timing(headerTranslateY, {
      duration: 180,
      toValue: hidden ? -headerHeight : 0,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const tabNavigation = navigation as unknown as {
      addListener: (eventName: 'tabPress', callback: () => void) => () => void;
    };
    const unsubscribe = tabNavigation.addListener('tabPress', () => {
      lastScrollYRef.current = 0;
      headerHiddenRef.current = false;
      Animated.timing(headerTranslateY, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    });
    return unsubscribe;
  }, [headerTranslateY, navigation]);

  useEffect(() => {
    if (headerHiddenRef.current) {
      headerTranslateY.setValue(-headerHeight);
    }
  }, [headerHeight, headerTranslateY]);

  const handleListScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (y < 24) {
      setHeaderHidden(false);
      return;
    }
    if (delta > 10 && y > headerHeight * 0.45) {
      setHeaderHidden(true);
    } else if (delta < -10) {
      setHeaderHidden(false);
    }
  };

  const switchGroupMode = (nextMode: GroupMode) => {
    setGroupMode(nextMode);
    setSelectedGroup('all');
    if ((nextMode === 'character' && sortMode === 'character') || (nextMode === 'series' && sortMode === 'seriesCharacter')) {
      setSortMode('created');
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>コレクション</Text>
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

      </Animated.View>

      <Modal animationType="fade" transparent visible={sortMenuVisible} onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setSortMenuVisible(false)}>
          <Pressable style={[styles.sortSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.sortSheetHeader}>
              <Text style={[styles.sortSheetTitle, { color: colors.text }]}>並び替え</Text>
              <Pressable accessibilityLabel="並び替えを閉じる" onPress={() => setSortMenuVisible(false)} style={styles.sortCloseButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>
            {visibleSortModes.map(([value, label, icon]) => {
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
        contentContainerStyle={[styles.listContent, { paddingTop: headerHeight + 18 }]}
        data={sortedEntries}
        keyExtractor={(item) => (isRandomGroup(item) ? item.key : String(item.id))}
        numColumns={2}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            {isRandomGroup(item) ? (
              <Pressable onPress={() => setSelectedRandomGroup(item)}>
                <RandomGoodsGroupTile group={item} />
              </Pressable>
            ) : (
              <HomeGoodsTile item={item} />
            )}
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
      <RandomGoodsGroupModal group={selectedRandomGroup} onClose={() => setSelectedRandomGroup(null)} />
    </SafeAreaView>
  );
}

function RandomGoodsGroupTile({ group }: { group: RandomGoodsGroup }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.randomTile, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <View style={[styles.randomImageWrap, { backgroundColor: colors.elevated }]}>
        {group.imageUrl ? (
          <Image source={{ uri: group.imageUrl }} style={styles.randomImage} />
        ) : (
          <Ionicons color={colors.muted} name="albums-outline" size={38} />
        )}
        <View style={[styles.randomBadge, { backgroundColor: colors.primary }]}>
          <Ionicons color="#ffffff" name="shuffle-outline" size={13} />
          <Text style={styles.randomBadgeText}>まとめ</Text>
        </View>
        <View style={[styles.randomQuantityBadge, { backgroundColor: colors.secondary }]}>
          <Text style={styles.randomQuantityText}>{group.quantity}個</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.series, { color: colors.muted }]}>
        {group.seriesName}
      </Text>
      <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.text }]}>
        {group.boxName}
      </Text>
      <Text numberOfLines={1} style={[styles.meta, { color: colors.primary }]}>
        ランダムグッズ / {group.itemCount}種
      </Text>
    </View>
  );
}

function RandomGoodsGroupModal({ group, onClose }: { group: RandomGoodsGroup | null; onClose: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Modal animationType="slide" transparent visible={!!group} onRequestClose={onClose}>
      <View style={styles.groupModalBackdrop}>
        <View style={[styles.groupSheet, { backgroundColor: colors.background }]}>
          <View style={styles.groupSheetHeader}>
            <View style={styles.groupSheetTitleBlock}>
              <Text style={[styles.groupSheetTitle, { color: colors.text }]}>ランダムグッズ一覧</Text>
              <Text numberOfLines={1} style={[styles.groupSheetSubtitle, { color: colors.muted }]}>
                {group?.boxName}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.groupCloseButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.groupDetailList} showsVerticalScrollIndicator={false}>
            {group?.items.map((item) => (
              <View key={item.id} style={[styles.groupDetailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.groupDetailImage, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.randomImage} /> : <Ionicons color={colors.muted} name="image-outline" size={24} />}
                </View>
                <View style={styles.groupDetailText}>
                  <Text numberOfLines={1} style={[styles.groupDetailName, { color: colors.text }]}>
                    {item.characterName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.groupDetailMeta, { color: colors.muted }]}>
                    {item.variantName}
                  </Text>
                </View>
                <View style={[styles.groupDetailQuantity, { backgroundColor: colors.primary }]}>
                  <Text style={styles.groupDetailQuantityText}>{item.quantity}個</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    elevation: 8,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    top: 0,
    zIndex: 10,
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
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
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
  randomTile: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: 8,
  },
  randomImageWrap: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 7,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  randomImage: { height: '100%', width: '100%' },
  randomBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    left: 7,
    minHeight: 28,
    paddingHorizontal: 9,
    position: 'absolute',
    top: 7,
  },
  randomBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  randomQuantityBadge: {
    alignItems: 'center',
    borderRadius: 999,
    bottom: 7,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 50,
    paddingHorizontal: 11,
    position: 'absolute',
    right: 7,
  },
  randomQuantityText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  series: { fontSize: 10, fontWeight: '800', lineHeight: 14, marginTop: 8 },
  tileTitle: { fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '800', lineHeight: 15, marginTop: 3 },
  groupModalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  groupSheet: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '84%',
    padding: 18,
    paddingBottom: 28,
  },
  groupSheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  groupSheetTitleBlock: { flex: 1 },
  groupSheetTitle: { fontSize: 21, fontWeight: '900' },
  groupSheetSubtitle: { fontSize: 12, marginTop: 3 },
  groupCloseButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  groupDetailList: { gap: 10, paddingTop: 14 },
  groupDetailRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    padding: 9,
  },
  groupDetailImage: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  groupDetailText: { flex: 1 },
  groupDetailName: { fontSize: 14, fontWeight: '900' },
  groupDetailMeta: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  groupDetailQuantity: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 30,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  groupDetailQuantityText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
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
