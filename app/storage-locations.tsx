import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoods } from '../src/store/GoodsContext';
import { useAppTheme } from '../src/store/ThemeContext';
import { Goods } from '../src/types';

type StorageGroup = {
  location: string;
  items: Goods[];
  quantity: number;
};

function normalizeLocation(value: string) {
  return value.trim() || '保管場所未設定';
}

export default function StorageLocationsScreen() {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const [query, setQuery] = useState('');

  const collectionGoods = useMemo(() => goods.filter((item) => (item.status === 'owned' || item.status === 'unorganized') && item.quantity > 0), [goods]);
  const groups = useMemo<StorageGroup[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const map = new Map<string, StorageGroup>();
    collectionGoods.forEach((item) => {
      const location = normalizeLocation(item.storageLocation);
      const target = [location, item.boxName, item.seriesName, item.characterName, item.variantName].join(' ').toLowerCase();
      if (normalizedQuery && !target.includes(normalizedQuery)) return;
      const current = map.get(location) ?? { location, items: [], quantity: 0 };
      current.items.push(item);
      current.quantity += item.quantity;
      map.set(location, current);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.location === '保管場所未設定') return -1;
      if (b.location === '保管場所未設定') return 1;
      return b.quantity - a.quantity || a.location.localeCompare(b.location, 'ja');
    });
  }, [collectionGoods, query]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="戻る" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>保管場所</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>どこにある？をすぐ確認</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.input }]}>
          <Ionicons color={colors.muted} name="search" size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ケース・棚・キャラクターで検索"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {groups.map((group) => (
          <View key={group.location} style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.groupHeader}>
              <View style={styles.groupText}>
                <Text numberOfLines={1} style={[styles.groupTitle, { color: colors.text }]}>{group.location}</Text>
                <Text style={[styles.groupMeta, { color: colors.muted }]}>{group.items.length}種 / {group.quantity}個</Text>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/collection?mode=manage')}
                style={[styles.manageButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}
              >
                <Ionicons color={colors.primary} name="create-outline" size={16} />
                <Text style={[styles.manageButtonText, { color: colors.text }]}>編集</Text>
              </Pressable>
            </View>
            <View style={styles.itemList}>
              {group.items.slice(0, 4).map((item) => <StorageItem key={item.id} item={item} />)}
              {group.items.length > 4 ? <Text style={[styles.moreText, { color: colors.muted }]}>ほか {group.items.length - 4}件</Text> : null}
            </View>
          </View>
        ))}

        {!groups.length && (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="file-tray-full-outline" size={38} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>該当する保管場所がありません。</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StorageItem({ item }: { item: Goods }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.itemRow, { backgroundColor: colors.elevated }]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.input }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <Ionicons color={colors.muted} name="image-outline" size={18} />}
      </View>
      <View style={styles.itemText}>
        <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>{item.characterName} {item.variantName}</Text>
        <Text numberOfLines={1} style={[styles.itemMeta, { color: colors.muted }]}>{item.seriesName}</Text>
      </View>
      <Text style={[styles.quantity, { color: colors.primary }]}>{item.quantity}個</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  searchBox: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 46, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  groupHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  groupText: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: 17, fontWeight: '900' },
  groupMeta: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  manageButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 11 },
  manageButtonText: { fontSize: 12, fontWeight: '900' },
  itemList: { gap: 8, marginTop: 12 },
  itemRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 9, minHeight: 52, padding: 8 },
  imageWrap: { alignItems: 'center', borderRadius: 7, height: 38, justifyContent: 'center', overflow: 'hidden', width: 38 },
  image: { height: '100%', width: '100%' },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: '900' },
  itemMeta: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  quantity: { fontSize: 12, fontWeight: '900' },
  moreText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, gap: 10, padding: 24 },
  emptyText: { fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
});
