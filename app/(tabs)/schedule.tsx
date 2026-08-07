import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { GestureResponderEvent, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

function getYearDays() {
  const today = new Date();
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      key: getDateKey(date),
      day: date.getDate(),
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: date.toLocaleDateString('ja-JP', { month: 'long', year: 'numeric' }),
      weekday: date.toLocaleDateString('ja-JP', { weekday: 'short' }),
    };
  });
}

function groupCalendarDays(days: ReturnType<typeof getYearDays>) {
  const groups = new Map<string, { label: string; days: typeof days }>();
  days.forEach((day) => {
    const group = groups.get(day.monthKey) ?? { label: day.monthLabel, days: [] };
    group.days.push(day);
    groups.set(day.monthKey, group);
  });
  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
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
  const { goods, removeGoods, updateGoods, updateQuantity } = useGoods();
  const [selectedStatus, setSelectedStatus] = useState<GoodsStatus | 'all'>('all');
  const [selected, setSelected] = useState<Goods | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [calendarTouchStart, setCalendarTouchStart] = useState<{ x: number; y: number } | null>(null);

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
  const yearDays = useMemo(() => getYearDays(), []);
  const calendarMonths = useMemo(() => groupCalendarDays(yearDays), [yearDays]);
  const currentMonth = calendarMonths[currentMonthIndex];
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
  const rememberCalendarTouch = (event: GestureResponderEvent) => {
    setCalendarTouchStart({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
  };
  const finishCalendarTouch = (event: GestureResponderEvent) => {
    if (!calendarTouchStart) return;
    const dx = event.nativeEvent.pageX - calendarTouchStart.x;
    const dy = event.nativeEvent.pageY - calendarTouchStart.y;
    setCalendarTouchStart(null);
    if (dx > 80 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setViewMode('list');
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{viewMode === 'calendar' ? 'カレンダー' : '予定'}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {viewMode === 'calendar' ? '日付から予約・到着予定を確認' : '予約・発送・到着待ちをまとめて確認'}
            </Text>
          </View>
          <View style={[styles.calendarBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="calendar-outline" size={18} />
            <Text style={[styles.calendarText, { color: colors.text }]}>{scheduleGoods.length}件</Text>
          </View>
        </View>

        {viewMode === 'list' ? (
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
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'list' ? (
          <>
            <Pressable
              onPress={() => setViewMode('calendar')}
              style={[styles.calendarLink, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.calendarLinkIcon, { backgroundColor: colors.elevated }]}>
                <Ionicons color={colors.primary} name="calendar-number-outline" size={22} />
              </View>
              <View style={styles.calendarLinkText}>
                <Text style={[styles.calendarLinkTitle, { color: colors.text }]}>カレンダーを見る</Text>
                <Text style={[styles.calendarLinkSubtitle, { color: colors.muted }]}>予約締切・発売日・受取日を日付で確認</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={20} />
            </Pressable>

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
          </>
        ) : (
          <View onTouchEnd={finishCalendarTouch} onTouchStart={rememberCalendarTouch}>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.backToListButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons color={colors.primary} name="chevron-back" size={19} />
              <Text style={[styles.backToListText, { color: colors.text }]}>予定一覧に戻る</Text>
            </Pressable>

            <View style={[styles.calendarPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.calendarHeader}>
                <View>
                  <Text style={[styles.calendarTitle, { color: colors.text }]}>今後365日</Text>
                  <Text style={[styles.calendarSubtitle, { color: colors.muted }]}>前月/次月で移動。右スワイプで一覧へ戻れます。</Text>
                </View>
                <Ionicons color={colors.primary} name="calendar-number-outline" size={24} />
              </View>
              {currentMonth ? (
                <View style={styles.monthBlock}>
                  <View style={styles.monthNav}>
                    <Pressable
                      disabled={currentMonthIndex <= 0}
                      onPress={() => setCurrentMonthIndex((index) => Math.max(0, index - 1))}
                      style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex <= 0 ? 0.4 : 1 }]}
                    >
                      <Ionicons color={colors.text} name="chevron-back" size={18} />
                    </Pressable>
                    <Text style={[styles.monthTitle, { color: colors.text }]}>{currentMonth.label}</Text>
                    <Pressable
                      disabled={currentMonthIndex >= calendarMonths.length - 1}
                      onPress={() => setCurrentMonthIndex((index) => Math.min(calendarMonths.length - 1, index + 1))}
                      style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex >= calendarMonths.length - 1 ? 0.4 : 1 }]}
                    >
                      <Ionicons color={colors.text} name="chevron-forward" size={18} />
                    </Pressable>
                  </View>
                  <View style={styles.monthGrid}>
                    {currentMonth.days.map((day) => {
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
              ) : null}
            </View>

            {groupedSchedule.map(([dateLabel, items]) => (
              <View key={dateLabel} style={styles.dateGroup}>
                <View style={[styles.dateGroupHeader, { backgroundColor: colors.elevated }]}>
                  <Ionicons color={colors.primary} name="time-outline" size={15} />
                  <Text style={[styles.dateText, { color: colors.text }]}>{dateLabel}</Text>
                  <Text style={[styles.dateCount, { color: colors.muted }]}>{items.length}件</Text>
                </View>
                {items.map((item) => (
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
              </View>
            ))}
          </View>
        )}
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
