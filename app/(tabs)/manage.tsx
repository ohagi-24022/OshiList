import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { GoodsEditForm } from '../../src/components/GoodsEditForm';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods } from '../../src/types';

export default function ManageScreen() {
  const { colors } = useAppTheme();
  const { goods, loading, removeGoods, updateGoods, updateQuantity } = useGoods();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Goods | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return goods.filter((item) => {
      const target = [item.boxName, item.characterName, item.variantName, item.janCode].filter(Boolean).join(' ');
      return !normalized || target.toLowerCase().includes(normalized);
    });
  }, [goods, query]);

  const selectedItem = selected ? goods.find((item) => item.id === selected.id) ?? selected : null;

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
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>管理</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : `登録済み ${goods.length}種類`}
            </Text>
          </View>
          <View style={[styles.summaryBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons color={colors.primary} name="create-outline" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>詳細編集</Text>
          </View>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.input }]}>
          <Ionicons color={colors.muted} name="search" size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="編集するグッズを検索"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <GoodsCard
            item={item}
            mode="manage"
            onDecrease={() => updateQuantity(item.id, -1)}
            onIncrease={() => updateQuantity(item.id, 1)}
            onPress={() => setSelected(item)}
            onRemove={() => confirmRemove(item)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="file-tray-outline" size={40} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>編集できるグッズがありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>スキャンタブから登録するとここに表示されます。</Text>
          </View>
        }
      />

      <Modal animationType="slide" visible={!!selectedItem} onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            style={styles.keyboard}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable accessibilityLabel="編集画面を閉じる" onPress={() => setSelected(null)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="chevron-back" size={24} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text }]}>グッズ詳細編集</Text>
              <View style={styles.closeButton} />
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {selectedItem ? (
                <GoodsEditForm
                  item={selectedItem}
                  onCancel={() => setSelected(null)}
                  onSave={async (input) => {
                    await updateGoods(selectedItem.id, input);
                    setSelected(null);
                  }}
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  modalScreen: { flex: 1 },
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
