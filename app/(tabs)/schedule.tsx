import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { GoodsEditForm } from '../../src/components/GoodsEditForm';
import { useTabReset } from '../../src/hooks/useTabReset';
import { goodsStatusLabels } from '../../src/lib/goodsStatus';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods, GoodsStatus } from '../../src/types';

const scheduleStatuses: GoodsStatus[] = ['reserved', 'ordered', 'shipped', 'wanted'];

function getScheduleDate(item: Goods) {
  return item.pickupDate || item.releaseDate || item.reservationDeadline || '';
}

function compareSchedule(a: Goods, b: Goods) {
  const dateA = getScheduleDate(a);
  const dateB = getScheduleDate(b);
  if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return b.id - a.id;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { goods, removeGoods, updateGoods, updateQuantity } = useGoods();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedStatus, setSelectedStatus] = useState<GoodsStatus | 'all'>('all');
  const [selected, setSelected] = useState<Goods | null>(null);

  const scheduleGoods = useMemo(
    () =>
      goods
        .filter((item) => scheduleStatuses.includes(item.status) && item.quantity > 0)
        .filter((item) => selectedStatus === 'all' || item.status === selectedStatus)
        .sort(compareSchedule),
    [goods, selectedStatus],
  );

  const selectedItem = selected ? goods.find((item) => item.id === selected.id) ?? selected : null;
  const statusCounts = useMemo(
    () =>
      scheduleStatuses.reduce<Record<string, number>>((result, status) => {
        result[status] = goods.filter((item) => item.status === status && item.quantity > 0).length;
        return result;
      }, {}),
    [goods],
  );
  const markOwned = async (item: Goods) => {
    await updateGoods(item.id, { ...item, status: 'owned', quantity: Math.max(1, item.quantity) });
  };
  useTabReset(scrollRef);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>予定</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>予約・発送・到着待ちをまとめて確認</Text>
          </View>
          <Pressable
            accessibilityLabel="カレンダーを見る"
            onPress={() => router.push('/(tabs)/calendar?from=schedule')}
            style={[styles.calendarBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons color={colors.primary} name="calendar-outline" size={18} />
            <Text style={[styles.calendarText, { color: colors.text }]}>カレンダー</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusTabs}>
          <StatusChip label="すべて" active={selectedStatus === 'all'} onPress={() => setSelectedStatus('all')} />
          {scheduleStatuses.map((status) => (
            <StatusChip
              key={status}
              label={`${goodsStatusLabels[status]} ${statusCounts[status] ?? 0}`}
              active={selectedStatus === status}
              onPress={() => setSelectedStatus(status)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {scheduleGoods.map((item) => (
          <ScheduleItem
            key={item.id}
            item={item}
            onDecrease={() => updateQuantity(item.id, -1)}
            onIncrease={() => updateQuantity(item.id, 1)}
            onMarkOwned={() => markOwned(item)}
            onPress={() => setSelected(item)}
            onRemove={() => removeGoods(item.id)}
            onToggleFavorite={() => updateGoods(item.id, { ...item, favorite: !item.favorite })}
          />
        ))}
        {!scheduleGoods.length ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="calendar-clear-outline" size={42} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>予定はありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>予約済み・発送済み・到着待ち・欲しいグッズがここに表示されます。</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal animationType="slide" visible={!!selectedItem} onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setSelected(null)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="chevron-back" size={24} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text }]}>予定を編集</Text>
              <View style={styles.closeButton} />
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {selectedItem ? (
                <GoodsEditForm
                  item={selectedItem}
                  source="schedule"
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

function StatusChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.statusChip, { borderColor: colors.border, backgroundColor: active ? colors.text : colors.surface }]}
    >
      <Text style={[styles.statusChipText, { color: active ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function ScheduleItem({
  item,
  onDecrease,
  onIncrease,
  onMarkOwned,
  onPress,
  onRemove,
  onToggleFavorite,
}: {
  item: Goods;
  onDecrease: () => void;
  onIncrease: () => void;
  onMarkOwned: () => void;
  onPress: () => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.itemBlock}>
      <View style={[styles.dateRow, { backgroundColor: colors.elevated }]}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {getScheduleDate(item) || '日付未設定'} / {goodsStatusLabels[item.status]}
        </Text>
        <Pressable onPress={onMarkOwned} style={[styles.doneButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.doneText}>所持へ</Text>
        </Pressable>
      </View>
      <GoodsCard
        item={item}
        mode="manage"
        onDecrease={onDecrease}
        onIncrease={onIncrease}
        onToggleFavorite={onToggleFavorite}
        onPress={onPress}
        onRemove={onRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: 1, padding: 18, paddingBottom: 12 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 2 },
  calendarBadge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 },
  calendarText: { fontSize: 12, fontWeight: '900' },
  statusTabs: { gap: 8, paddingTop: 14 },
  statusChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', paddingHorizontal: 13 },
  statusChipText: { fontSize: 12, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 96 },
  calendarLink: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    minHeight: 66,
    padding: 12,
  },
  calendarLinkIcon: { alignItems: 'center', borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  calendarLinkText: { flex: 1 },
  calendarLinkTitle: { fontSize: 15, fontWeight: '900' },
  calendarLinkSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  backToListButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
  },
  backToListText: { fontSize: 13, fontWeight: '900' },
  calendarPanel: { borderRadius: 8, borderWidth: 1, marginBottom: 16, padding: 12 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  calendarTitle: { fontSize: 17, fontWeight: '900' },
  calendarSubtitle: { fontSize: 12, marginTop: 2 },
  monthBlock: { marginTop: 14 },
  monthNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  monthNavButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  monthTitle: { fontSize: 15, fontWeight: '900' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: { alignItems: 'center', borderRadius: 8, minHeight: 58, justifyContent: 'center', paddingVertical: 6, width: 42 },
  weekdayText: { fontSize: 10, fontWeight: '900' },
  dayText: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  dayCountText: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  dateGroup: { marginBottom: 14 },
  dateGroupHeader: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 7, marginBottom: 8, minHeight: 38, paddingHorizontal: 10 },
  dateCount: { fontSize: 12, fontWeight: '900' },
  itemBlock: { marginBottom: 12 },
  dateRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 7, marginBottom: 8, minHeight: 38, paddingHorizontal: 10 },
  dateText: { flex: 1, fontSize: 12, fontWeight: '900' },
  doneButton: { alignItems: 'center', borderRadius: 999, height: 28, justifyContent: 'center', paddingHorizontal: 10 },
  doneText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, marginTop: 36, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  modalHeader: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 54, justifyContent: 'space-between', paddingHorizontal: 12 },
  closeButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalContent: { padding: 18, paddingBottom: 36 },
});
