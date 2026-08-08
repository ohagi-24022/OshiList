import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { GoodsEditForm } from '../../src/components/GoodsEditForm';
import { goodsStatusLabels } from '../../src/lib/goodsStatus';
import { useEvents } from '../../src/store/EventContext';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { EventPlan, Goods, GoodsStatus } from '../../src/types';

const scheduleStatuses: GoodsStatus[] = ['reserved', 'ordered', 'shipped', 'wanted'];
const eventStatuses: GoodsStatus[] = ['wanted', 'reserved', 'ordered', 'shipped'];

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

function compareByDate(a: Goods, b: Goods) {
  const dateA = getScheduleDate(a);
  const dateB = getScheduleDate(b);
  if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return b.id - a.id;
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { colors } = useAppTheme();
  const { events, selectedEventId } = useEvents();
  const { goods, removeGoods, updateGoods, updateQuantity } = useGoods();
  const scrollRef = useRef<ScrollView>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [selected, setSelected] = useState<Goods | null>(null);
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const swipeTranslateX = useRef(new Animated.Value(0)).current;

  const scheduleGoods = useMemo(
    () => goods.filter((item) => scheduleStatuses.includes(item.status) && item.quantity > 0).sort(compareByDate),
    [goods],
  );
  const yearDays = useMemo(() => getYearDays(), []);
  const calendarMonths = useMemo(() => groupCalendarDays(yearDays), [yearDays]);
  const currentMonth = calendarMonths[currentMonthIndex];
  const selectedItem = selected ? goods.find((item) => item.id === selected.id) ?? selected : null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const eventGoods = useMemo(
    () => goods.filter((item) => eventStatuses.includes(item.status) && item.eventId === selectedEvent?.id && item.quantity > 0),
    [goods, selectedEvent?.id],
  );

  const dateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    scheduleGoods.forEach((item) => {
      const key = getScheduleDate(item);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    events.forEach((event) => {
      if (event.date) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
    });
    return counts;
  }, [events, scheduleGoods]);

  const visibleGoods = useMemo(() => {
    if (!currentMonth) return [];
    const monthKey = currentMonth.key;
    return scheduleGoods.filter((item) => getScheduleDate(item).startsWith(monthKey));
  }, [currentMonth, scheduleGoods]);

  const visibleEvents = useMemo(() => {
    if (!currentMonth) return [];
    return events.filter((event) => event.date.startsWith(currentMonth.key));
  }, [currentMonth, events]);

  const markOwned = async (item: Goods) => {
    await updateGoods(item.id, { ...item, status: 'owned', quantity: Math.max(1, item.quantity) });
  };
  useScrollToTop(scrollRef);

  const goToSchedule = () => router.push('/(tabs)/schedule');
  const goToEvent = () => router.push('/(tabs)/event');
  const goBackToSource = () => {
    if (params.from === 'event') {
      goToEvent();
      return;
    }
    if (params.from === 'schedule') {
      goToSchedule();
      return;
    }
    router.back();
  };
  const beginSwipe = (event: GestureResponderEvent) => {
    setSwipeStart({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
  };
  const moveSwipe = (event: GestureResponderEvent) => {
    if (!swipeStart) return;
    const dx = event.nativeEvent.pageX - swipeStart.x;
    const dy = event.nativeEvent.pageY - swipeStart.y;
    if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeTranslateX.setValue(Math.min(dx, 160));
    }
  };
  const finishSwipe = (event: GestureResponderEvent) => {
    if (!swipeStart) return;
    const dx = event.nativeEvent.pageX - swipeStart.x;
    const dy = event.nativeEvent.pageY - swipeStart.y;
    setSwipeStart(null);
    if (dx > 90 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      Animated.timing(swipeTranslateX, { duration: 180, toValue: 420, useNativeDriver: true }).start(() => {
        swipeTranslateX.setValue(0);
        goBackToSource();
      });
      return;
    }
    Animated.spring(swipeTranslateX, { bounciness: 0, speed: 18, toValue: 0, useNativeDriver: true }).start();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {params.from === 'event' ? (
        <SourcePreview
          events={events}
          eventGoods={eventGoods}
          kind="event"
          selectedEvent={selectedEvent}
        />
      ) : params.from === 'schedule' ? (
        <SourcePreview
          kind="schedule"
          scheduleGoods={scheduleGoods}
        />
      ) : null}
      <Animated.View
        onTouchCancel={() => {
          setSwipeStart(null);
          Animated.spring(swipeTranslateX, { bounciness: 0, speed: 18, toValue: 0, useNativeDriver: true }).start();
        }}
        onTouchEnd={finishSwipe}
        onTouchMove={moveSwipe}
        onTouchStart={beginSwipe}
        style={[styles.animatedContent, { backgroundColor: colors.background, transform: [{ translateX: swipeTranslateX }] }]}
      >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>カレンダー</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>予定とイベントを日付で確認</Text>
          </View>
          <View style={[styles.summaryBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="calendar-number-outline" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>{scheduleGoods.length + events.length}件</Text>
          </View>
        </View>

        <View style={styles.returnRow}>
          <Pressable onPress={goToSchedule} style={[styles.returnButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="calendar-outline" size={17} />
            <Text style={[styles.returnButtonText, { color: colors.text }]}>予定へ</Text>
          </Pressable>
          <Pressable onPress={goToEvent} style={[styles.returnButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={17} />
            <Text style={[styles.returnButtonText, { color: colors.text }]}>イベントへ</Text>
          </Pressable>
        </View>

        <View style={[styles.calendarPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calendarHeader}>
            <Pressable
              disabled={currentMonthIndex <= 0}
              onPress={() => setCurrentMonthIndex((index) => Math.max(0, index - 1))}
              style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex <= 0 ? 0.4 : 1 }]}
            >
              <Ionicons color={colors.text} name="chevron-back" size={18} />
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{currentMonth?.label ?? ''}</Text>
            <Pressable
              disabled={currentMonthIndex >= calendarMonths.length - 1}
              onPress={() => setCurrentMonthIndex((index) => Math.min(calendarMonths.length - 1, index + 1))}
              style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex >= calendarMonths.length - 1 ? 0.4 : 1 }]}
            >
              <Ionicons color={colors.text} name="chevron-forward" size={18} />
            </Pressable>
          </View>

          <View style={styles.monthGrid}>
            {currentMonth?.days.map((day) => {
              const count = dateCounts.get(day.key) ?? 0;
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

        {!!visibleEvents.length && (
          <View style={[styles.sectionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>イベント</Text>
            {visibleEvents.map((event) => (
              <View key={event.id} style={[styles.eventRow, { backgroundColor: colors.elevated }]}>
                <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                <View style={styles.eventText}>
                  <Text style={[styles.eventName, { color: colors.text }]}>{event.name}</Text>
                  <Text style={[styles.eventMeta, { color: colors.muted }]}>{[event.date, event.venue].filter(Boolean).join(' / ')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>予定</Text>
        {visibleGoods.map((item) => (
          <View key={item.id} style={styles.itemBlock}>
            <View style={[styles.dateRow, { backgroundColor: colors.elevated }]}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                {getScheduleDate(item) || '日付未設定'} / {goodsStatusLabels[item.status]}
              </Text>
              <Pressable onPress={() => markOwned(item)} style={[styles.doneButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.doneText}>所持へ</Text>
              </Pressable>
            </View>
            <GoodsCard
              item={item}
              mode="manage"
              onDecrease={() => updateQuantity(item.id, -1)}
              onIncrease={() => updateQuantity(item.id, 1)}
              onPress={() => setSelected(item)}
              onRemove={() => removeGoods(item.id)}
              onToggleFavorite={() => updateGoods(item.id, { ...item, favorite: !item.favorite })}
            />
          </View>
        ))}
        {!visibleGoods.length && !visibleEvents.length ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="calendar-clear-outline" size={42} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>この月の予定はありません</Text>
          </View>
        ) : null}
      </ScrollView>
      </Animated.View>

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

function SourcePreview({
  events = [],
  eventGoods = [],
  kind,
  scheduleGoods = [],
  selectedEvent,
}: {
  events?: EventPlan[];
  eventGoods?: Goods[];
  kind: 'event' | 'schedule';
  scheduleGoods?: Goods[];
  selectedEvent?: EventPlan | null;
}) {
  const { colors } = useAppTheme();
  const eventQuantity = eventGoods.reduce((sum, item) => sum + item.quantity, 0);

  if (kind === 'event') {
    return (
      <View pointerEvents="none" style={[styles.sourcePreview, { backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>イベント</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>イベントごとに購入予定リストを管理</Text>
          </View>
          <View style={[styles.summaryBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>{eventGoods.length}種 / {eventQuantity}個</Text>
          </View>
        </View>

        <View style={[styles.previewActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.primary} name="add-circle-outline" size={20} />
          <Text style={[styles.previewActionText, { color: colors.text }]}>イベント登録</Text>
          <Ionicons color={colors.muted} name="chevron-down" size={18} />
        </View>

        {!!events.length && (
          <View style={styles.previewChipRow}>
            {events.slice(0, 3).map((event) => {
              const active = event.id === selectedEvent?.id;
              return (
                <View key={event.id} style={[styles.previewChip, { backgroundColor: active ? colors.text : colors.surface, borderColor: colors.border }]}>
                  <Text numberOfLines={1} style={[styles.previewChipText, { color: active ? colors.background : colors.text }]}>{event.name}</Text>
                </View>
              );
            })}
          </View>
        )}

        {selectedEvent ? (
          <View style={[styles.sectionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.eventRow}>
              <View style={styles.eventText}>
                <Text style={[styles.eventName, { color: colors.text }]}>{selectedEvent.name}</Text>
                <Text style={[styles.eventMeta, { color: colors.muted }]}>
                  {[selectedEvent.date, selectedEvent.venue].filter(Boolean).join(' / ') || '日程未設定'}
                </Text>
              </View>
              <Ionicons color={colors.primary} name="create-outline" size={19} />
              <Ionicons color={colors.danger} name="trash-outline" size={19} />
            </View>
            {!!selectedEvent.memo && <Text style={[styles.eventMeta, { color: colors.muted }]}>{selectedEvent.memo}</Text>}
            <View style={[styles.previewSecondaryButton, { borderColor: colors.border }]}>
              <Ionicons color={colors.primary} name="add" size={18} />
              <Text style={[styles.returnButtonText, { color: colors.text }]}>購入予定を追加</Text>
            </View>
          </View>
        ) : null}

        {eventGoods.slice(0, 2).map((item) => (
          <GoodsCard key={item.id} item={item} mode="view" />
        ))}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.sourcePreview, { backgroundColor: colors.background }]}>
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>予定</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>予約・発送・到着待ちをまとめて確認</Text>
        </View>
        <View style={[styles.summaryBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.primary} name="calendar-outline" size={18} />
          <Text style={[styles.summaryText, { color: colors.text }]}>カレンダー</Text>
        </View>
      </View>

      <View style={styles.previewChipRow}>
        <View style={[styles.previewChip, { backgroundColor: colors.text, borderColor: colors.text }]}>
          <Text style={[styles.previewChipText, { color: colors.background }]}>すべて</Text>
        </View>
        {scheduleStatuses.slice(0, 3).map((status) => (
          <View key={status} style={[styles.previewChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.previewChipText, { color: colors.text }]}>{goodsStatusLabels[status]}</Text>
          </View>
        ))}
      </View>

      {scheduleGoods.slice(0, 3).map((item) => (
        <View key={item.id} style={styles.itemBlock}>
          <View style={[styles.dateRow, { backgroundColor: colors.elevated }]}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {getScheduleDate(item) || '日付未設定'} / {goodsStatusLabels[item.status]}
            </Text>
            <View style={[styles.doneButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.doneText}>所持へ</Text>
            </View>
          </View>
          <GoodsCard item={item} mode="view" />
        </View>
      ))}

      {!scheduleGoods.length ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons color={colors.muted} name="calendar-clear-outline" size={42} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>予定はありません</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  animatedContent: { flex: 1 },
  sourcePreview: { bottom: 0, left: 0, padding: 18, paddingBottom: 96, position: 'absolute', right: 0, top: 0 },
  content: { gap: 14, padding: 18, paddingBottom: 96 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 2 },
  summaryBadge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 },
  summaryText: { fontSize: 12, fontWeight: '900' },
  previewActionButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 14, minHeight: 50, paddingHorizontal: 14 },
  previewActionText: { flex: 1, fontSize: 15, fontWeight: '900' },
  previewChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  previewChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', maxWidth: 160, paddingHorizontal: 12 },
  previewChipText: { fontSize: 12, fontWeight: '900' },
  previewSecondaryButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, height: 42, justifyContent: 'center' },
  returnRow: { flexDirection: 'row', gap: 8 },
  returnButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, height: 44, justifyContent: 'center' },
  returnButtonText: { fontSize: 13, fontWeight: '900' },
  calendarPanel: { borderRadius: 8, borderWidth: 1, padding: 12 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  monthNavButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  monthTitle: { fontSize: 16, fontWeight: '900' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 58, paddingVertical: 6, width: 42 },
  weekdayText: { fontSize: 10, fontWeight: '900' },
  dayText: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  dayCountText: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  sectionPanel: { borderRadius: 8, borderWidth: 1, gap: 8, padding: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  eventRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 10, minHeight: 54, padding: 10 },
  eventText: { flex: 1 },
  eventName: { fontSize: 14, fontWeight: '900' },
  eventMeta: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  itemBlock: { marginBottom: 2 },
  dateRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 7, marginBottom: 8, minHeight: 38, paddingHorizontal: 10 },
  dateText: { flex: 1, fontSize: 12, fontWeight: '900' },
  doneButton: { alignItems: 'center', borderRadius: 999, height: 28, justifyContent: 'center', paddingHorizontal: 10 },
  doneText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  modalHeader: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 54, justifyContent: 'space-between', paddingHorizontal: 12 },
  closeButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalContent: { padding: 18, paddingBottom: 36 },
});
