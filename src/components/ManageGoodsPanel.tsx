import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoodsCard } from './GoodsCard';
import { GoodsEditForm } from './GoodsEditForm';
import { useGoods } from '../store/GoodsContext';
import { useAppTheme } from '../store/ThemeContext';
import { Goods } from '../types';

type Props = {
  embedded?: boolean;
  onShowCollection?: () => void;
};

export function ManageGoodsPanel({ embedded = false, onShowCollection }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { goods, loading, removeGoods, updateGoods, bulkUpdateGoods, updateQuantity } = useGoods();
  const listRef = useRef<FlatList<Goods>>(null);
  const detailTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const detailTranslateX = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Goods | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [unorganizedOnly, setUnorganizedOnly] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkSeriesName, setBulkSeriesName] = useState('');
  const [bulkCharacterName, setBulkCharacterName] = useState('');
  const [bulkStorageLocation, setBulkStorageLocation] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return goods.filter((item) => {
      if (item.status !== 'owned' && item.status !== 'unorganized') return false;
      if (unorganizedOnly && item.status !== 'unorganized') return false;
      const target = [item.boxName, item.seriesName, item.characterName, item.variantName, item.janCode, item.storageLocation, item.usageLocation, item.tags].filter(Boolean).join(' ');
      return !normalized || target.toLowerCase().includes(normalized);
    });
  }, [goods, query, unorganizedOnly]);

  const collectionGoodsCount = useMemo(() => goods.filter((item) => item.status === 'owned' || item.status === 'unorganized').length, [goods]);
  const unorganizedCount = useMemo(() => goods.filter((item) => item.status === 'unorganized').length, [goods]);

  const selectedItem = selected ? goods.find((item) => item.id === selected.id) ?? selected : null;
  const selectedCount = selectedIds.size;
  const selectedGoods = useMemo(() => goods.filter((item) => selectedIds.has(item.id)), [goods, selectedIds]);
  const seriesSuggestions = useMemo(() => uniqueValues(goods.map((item) => item.seriesName)), [goods]);
  const characterSuggestions = useMemo(() => uniqueValues(goods.map((item) => item.characterName)), [goods]);
  useScrollToTop(listRef);

  useEffect(() => {
    if (!selected) return;

    detailTranslateX.setValue(Dimensions.get('window').width);
    Animated.timing(detailTranslateX, {
      duration: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [detailTranslateX, selected]);

  const closeDetail = () => {
    detailTranslateX.setValue(0);
    setSelected(null);
  };
  const rememberDetailTouchStart = (event: GestureResponderEvent) => {
    detailTouchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      time: Date.now(),
    };
  };
  const moveDetailWithSwipe = (event: GestureResponderEvent) => {
    const start = detailTouchStartRef.current;
    if (!start) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.25;
    if (dx > 0 && horizontal) {
      detailTranslateX.setValue(Math.min(dx, 140));
    }
  };
  const finishDetailSwipe = (event: GestureResponderEvent) => {
    const start = detailTouchStartRef.current;
    detailTouchStartRef.current = null;
    if (!start) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const elapsed = Date.now() - start.time;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.25;
    const fastEnough = elapsed < 700;
    if (dx > 64 && horizontal && fastEnough) {
      Animated.timing(detailTranslateX, {
        duration: 180,
        toValue: Dimensions.get('window').width,
        useNativeDriver: true,
      }).start(() => closeDetail());
      return;
    }
    Animated.spring(detailTranslateX, {
      damping: 18,
      stiffness: 220,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      const next = !current;
      if (current) {
        setSelectedIds(new Set());
      }
      return next;
    });
  };

  const toggleSelectedId = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openBulkModal = () => {
    if (!selectedCount) {
      Alert.alert('グッズを選択してください', 'まとめて編集したいグッズを選択してください。');
      return;
    }
    setBulkModalVisible(true);
  };

  const saveBulkUpdate = async () => {
    const patch: { seriesName?: string; characterName?: string; storageLocation?: string } = {};
    if (bulkSeriesName.trim()) patch.seriesName = bulkSeriesName;
    if (bulkCharacterName.trim()) patch.characterName = bulkCharacterName;
    if (bulkStorageLocation.trim()) patch.storageLocation = bulkStorageLocation;
    if (!patch.seriesName && !patch.characterName && !patch.storageLocation) {
      Alert.alert('入力してください', 'シリーズ、キャラクター、保管場所のいずれかを入力してください。');
      return;
    }

    await bulkUpdateGoods(Array.from(selectedIds), patch);
    setBulkModalVisible(false);
    setBulkSeriesName('');
    setBulkCharacterName('');
    setBulkStorageLocation('');
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const confirmRemove = (item: Goods) => {
    Alert.alert('グッズを削除しますか？', `${item.characterName} / ${item.variantName}`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeGoods(item.id);
          if (selected?.id === item.id) {
            setSelected(null);
          }
          setSelectedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        },
      },
    ]);
  };

  const Root = embedded ? View : SafeAreaView;

  return (
    <Root style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: embedded ? insets.top + 10 : 8,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>コレクション</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : selectionMode ? `${selectedCount}件選択中` : `管理中 ${collectionGoodsCount}種類`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {embedded ? (
              <Pressable
                onPress={onShowCollection}
                style={[styles.summaryBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Ionicons color={colors.primary} name="albums-outline" size={18} />
                <Text style={[styles.summaryText, { color: colors.text }]}>一覧</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={toggleSelectionMode}
              style={[styles.summaryBadge, { borderColor: colors.border, backgroundColor: selectionMode ? colors.primary : colors.surface }]}
            >
              <Ionicons color={selectionMode ? '#ffffff' : colors.primary} name={selectionMode ? 'close' : 'checkbox-outline'} size={18} />
              <Text style={[styles.summaryText, { color: selectionMode ? '#ffffff' : colors.text }]}>
                {selectionMode ? '解除' : '選択'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.input }]}>
          <Ionicons color={colors.muted} name="search" size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="シリーズ・キャラ・グッズを検索"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: unorganizedOnly }}
          onPress={() => setUnorganizedOnly((current) => !current)}
          style={[
            styles.filterButton,
            { borderColor: colors.border, backgroundColor: unorganizedOnly ? colors.text : colors.surface },
          ]}
        >
          <Ionicons color={unorganizedOnly ? colors.background : colors.primary} name="file-tray-outline" size={17} />
          <Text style={[styles.filterButtonText, { color: unorganizedOnly ? colors.background : colors.text }]}>
            未整理のみ {unorganizedCount}
          </Text>
        </Pressable>
        {selectionMode ? (
          <View style={styles.bulkActions}>
            <Pressable
              onPress={() => setSelectedIds(new Set(filtered.map((item) => item.id)))}
              style={[styles.bulkSubButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons color={colors.text} name="checkmark-done-outline" size={17} />
              <Text style={[styles.bulkSubButtonText, { color: colors.text }]}>表示分を選択</Text>
            </Pressable>
            <Pressable
              onPress={openBulkModal}
              style={[styles.bulkMainButton, { backgroundColor: selectedCount ? colors.primary : colors.border }]}
            >
              <Ionicons color="#ffffff" name="create-outline" size={17} />
              <Text style={styles.bulkMainButtonText}>まとめて設定</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const checked = selectedIds.has(item.id);
          return (
            <View style={styles.listItem}>
              {selectionMode ? (
                <Pressable
                  accessibilityLabel={`${item.boxName}を選択`}
                  onPress={() => toggleSelectedId(item.id)}
                  style={[styles.checkButton, { backgroundColor: checked ? colors.primary : colors.surface, borderColor: checked ? colors.primary : colors.border }]}
                >
                  <Ionicons color={checked ? '#ffffff' : colors.muted} name={checked ? 'checkmark' : 'ellipse-outline'} size={20} />
                </Pressable>
              ) : null}
              <View style={styles.cardWrap}>
                <GoodsCard
                  item={item}
                  mode="manage"
                  onDecrease={() => updateQuantity(item.id, -1)}
                  onIncrease={() => updateQuantity(item.id, 1)}
                  onToggleFavorite={() => updateGoods(item.id, { ...item, favorite: !item.favorite })}
                  onPress={() => (selectionMode ? toggleSelectedId(item.id) : setSelected(item))}
                  onRemove={() => confirmRemove(item)}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="file-tray-outline" size={40} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>編集できるグッズがありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>スキャンタブから登録するとここに表示されます。</Text>
          </View>
        }
      />

      <Modal animationType="slide" transparent visible={bulkModalVisible} onRequestClose={() => setBulkModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.bulkSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBlock}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>まとめて設定</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{selectedCount}件のシリーズ/キャラクターを更新します。</Text>
              </View>
              <Pressable onPress={() => setBulkModalVisible(false)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.bulkLabel, { color: colors.muted }]}>シリーズ</Text>
              <TextInput
                value={bulkSeriesName}
                onChangeText={setBulkSeriesName}
                placeholder="空欄なら変更しません"
                placeholderTextColor={colors.muted}
                style={[styles.bulkInput, { backgroundColor: colors.input, color: colors.text }]}
              />
              <SuggestionRow values={seriesSuggestions} colors={colors} onSelect={setBulkSeriesName} />

              <Text style={[styles.bulkLabel, { color: colors.muted }]}>キャラクター</Text>
              <TextInput
                value={bulkCharacterName}
                onChangeText={setBulkCharacterName}
                placeholder="空欄なら変更しません"
                placeholderTextColor={colors.muted}
                style={[styles.bulkInput, { backgroundColor: colors.input, color: colors.text }]}
              />
              <SuggestionRow values={characterSuggestions} colors={colors} onSelect={setBulkCharacterName} />

              <Text style={[styles.bulkLabel, { color: colors.muted }]}>保管場所</Text>
              <TextInput
                value={bulkStorageLocation}
                onChangeText={setBulkStorageLocation}
                placeholder="空欄なら変更しません"
                placeholderTextColor={colors.muted}
                style={[styles.bulkInput, { backgroundColor: colors.input, color: colors.text }]}
              />

              {!!selectedGoods.length && (
                <View style={[styles.previewBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Text style={[styles.previewTitle, { color: colors.text }]}>対象</Text>
                  <Text style={[styles.previewText, { color: colors.muted }]} numberOfLines={3}>
                    {selectedGoods.map((item) => item.boxName).join(' / ')}
                  </Text>
                </View>
              )}
            </ScrollView>

            <Pressable onPress={saveBulkUpdate} style={[styles.saveBulkButton, { backgroundColor: colors.primary }]}>
              <Ionicons color="#ffffff" name="save-outline" size={18} />
              <Text style={styles.saveBulkText}>保存</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal animationType="none" transparent visible={!!selectedItem} onRequestClose={closeDetail}>
        <SafeAreaView
          onTouchEnd={finishDetailSwipe}
          onTouchMove={moveDetailWithSwipe}
          onTouchStart={rememberDetailTouchStart}
          style={styles.modalScreen}
        >
          <Animated.View
            style={[
              styles.animatedDetail,
              {
                backgroundColor: colors.background,
                transform: [{ translateX: detailTranslateX }],
              },
            ]}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
              style={styles.keyboard}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Pressable accessibilityLabel="編集画面を閉じる" onPress={closeDetail} style={styles.closeButton}>
                  <Ionicons color={colors.text} name="chevron-back" size={24} />
                </Pressable>
                <Text style={[styles.modalTitle, { color: colors.text }]}>グッズ詳細編集</Text>
                <View style={styles.closeButton} />
              </View>
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                onTouchEnd={finishDetailSwipe}
                onTouchMove={moveDetailWithSwipe}
                onTouchStart={rememberDetailTouchStart}
                showsVerticalScrollIndicator={false}
              >
                {selectedItem ? (
                  <GoodsEditForm
                    item={selectedItem}
                    source="manage"
                    onCancel={closeDetail}
                    onSave={async (input) => {
                      await updateGoods(selectedItem.id, input);
                      closeDetail();
                    }}
                  />
                ) : null}
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </SafeAreaView>
      </Modal>
    </Root>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')).slice(0, 12);
}

function SuggestionRow({
  values,
  colors,
  onSelect,
}: {
  values: string[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  onSelect: (value: string) => void;
}) {
  if (!values.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.suggestionChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
        >
          <Text numberOfLines={1} style={[styles.suggestionText, { color: colors.text }]}>
            {value}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    elevation: 8,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
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
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 36,
    marginTop: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  filterButtonText: { fontSize: 12, fontWeight: '900' },
  bulkActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bulkSubButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 42,
    justifyContent: 'center',
  },
  bulkSubButtonText: { fontSize: 13, fontWeight: '900' },
  bulkMainButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 42,
    justifyContent: 'center',
  },
  bulkMainButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  listContent: { padding: 18, paddingBottom: 96 },
  listItem: { flexDirection: 'row', gap: 10 },
  checkButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    marginTop: 45,
    width: 36,
  },
  cardWrap: { flex: 1 },
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
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.36)', flex: 1, justifyContent: 'flex-end' },
  bulkSheet: { borderTopLeftRadius: 8, borderTopRightRadius: 8, maxHeight: '86%', padding: 18 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  bulkLabel: { fontSize: 12, fontWeight: '800', marginBottom: 7, marginTop: 14 },
  bulkInput: { borderRadius: 8, fontSize: 15, height: 46, paddingHorizontal: 12 },
  suggestionRow: { gap: 8, paddingTop: 8 },
  suggestionChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    maxWidth: 180,
    paddingHorizontal: 12,
  },
  suggestionText: { fontSize: 12, fontWeight: '800' },
  previewBox: { borderRadius: 8, borderWidth: 1, marginTop: 16, padding: 10 },
  previewTitle: { fontSize: 12, fontWeight: '900' },
  previewText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  saveBulkButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBulkText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  modalScreen: { flex: 1 },
  animatedDetail: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    elevation: 10,
    flex: 1,
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  keyboard: { flex: 1 },
  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  closeButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalContent: { padding: 18, paddingBottom: 36 },
});
