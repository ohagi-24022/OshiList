import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { GoodsEditForm } from '../../src/components/GoodsEditForm';
import { goodsStatusLabels } from '../../src/lib/goodsStatus';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods, GoodsStatus } from '../../src/types';

const scheduleStatuses: GoodsStatus[] = ['reserved', 'ordered', 'shipped', 'wanted'];

function getScheduleDate(item: Goods) {
  return item.pickupDate || item.releaseDate || item.reservationDeadline || '';
}

function getDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      key: getDateKey(date),
      day: date.getDate(),
      weekday: date.toLocaleDateString('ja-JP', { weekday: 'short' }),
    };
  });
}

function groupByScheduleDate(items: Goods[]) {
  const groups = new Map<string, Goods[]>();
  items.forEach((item) => {
    const key = getScheduleDate(item) || '日付未設定';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return Array.from(groups.entries()).sort(([left], [right]) => {
    if (left === '日付未設定') return 1;
    if (right === '日付未設定') return -1;
    return left.localeCompare(right);
  });
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
  const { colors } = useAppTheme();
  const { goods, updateGoods, updateQuantity } = useGoods();
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
  const weekDays = useMemo(() => getWeekDays(), []);
  const groupedSchedule = useMemo(() => groupByScheduleDate(scheduleGoods), [scheduleGoods]);
  const scheduleDateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    scheduleGoods.forEach((item) => {
      const key = getScheduleDate(item);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [scheduleGoods]);

  const markOwned = async (item: Goods) => {
    await updateGoods(item.id, { ...item, status: 'owned', quantity: Math.max(1, item.quantity) });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>予定</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>予約・発送・到着待ちをまとめて確認</Text>
          </View>
          <View style={[styles.calendarBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="calendar-outline" size={18} />
            <Text style={[styles.calendarText, { color: colors.text }]}>{scheduleGoods.length}件</Text>
          </View>
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.calendarPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>今後7日</Text>
              <Text style={[styles.calendarSubtitle, { color: colors.muted }]}>予約締切・発売日・受取日を日付で確認</Text>
            </View>
            <Ionicons color={colors.primary} name="calendar-number-outline" size={24} />
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((day) => {
              const count = scheduleDateCounts.get(day.key) ?? 0;
              return (
                <View key={day.key} style={[styles.dayCell, { backgroundColor: count ? colors.primary : colors.elevated }]}>
                  <Text style={[styles.weekdayText, { color: count ? '#ffffff' : colors.muted }]}>{day.weekday}</Text>
                  <Text style={[styles.dayText, { color: count ? '#ffffff' : colors.text }]}>{day.day}</Text>
                  <Text style={[styles.dayCountText, { color: count ? '#ffffff' : colors.muted }]}>{count ? `${count}件` : '-'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {groupedSchedule.map(([dateLabel, items]) => (
          <View key={dateLabel} style={styles.dateGroup}>
            <View style={[styles.dateGroupHeader, { backgroundColor: colors.elevated }]}>
              <Ionicons color={colors.primary} name="time-outline" size={15} />
              <Text style={[styles.dateText, { color: colors.text }]}>{dateLabel}</Text>
              <Text style={[styles.dateCount, { color: colors.muted }]}>{items.length}件</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} style={styles.itemBlock}>
                <View style={[styles.dateRow, { backgroundColor: colors.elevated }]}>
                  <Text style={[styles.dateText, { color: colors.text }]}>{goodsStatusLabels[item.status]}</Text>
                  <Pressable onPress={() => markOwned(item)} style={[styles.doneButton, { backgroundColor: colors.primary }]}>
                    <Text style={styles.doneText}>所持へ</Text>
                  </Pressable>
                </View>
                <GoodsCard
                  item={item}
                  mode="manage"
                  onDecrease={() => updateQuantity(item.id, -1)}
                  onIncrease={() => updateQuantity(item.id, 1)}
                  onToggleFavorite={() => updateGoods(item.id, { ...item, favorite: !item.favorite })}
                  onPress={() => setSelected(item)}
                />
              </View>
            ))}
          </View>
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
  calendarPanel: { borderRadius: 8, borderWidth: 1, marginBottom: 16, padding: 12 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  calendarTitle: { fontSize: 17, fontWeight: '900' },
  calendarSubtitle: { fontSize: 12, marginTop: 2 },
  weekRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  dayCell: { alignItems: 'center', borderRadius: 8, flex: 1, minHeight: 72, justifyContent: 'center', paddingVertical: 7 },
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
