import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { ManualGoodsForm } from '../../src/components/ManualGoodsForm';
import { useEvents } from '../../src/store/EventContext';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';

const eventStatuses = ['wanted', 'reserved', 'ordered', 'shipped'];

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

export default function EventScreen() {
  const { colors } = useAppTheme();
  const { addGoods, goods, updateGoods, updateQuantity, removeGoods } = useGoods();
  const { events, selectedEventId, setSelectedEventId, addEvent, updateEvent, removeEvent } = useEvents();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [memo, setMemo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<'list' | 'addGoods'>('list');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const eventGoods = useMemo(
    () => goods.filter((item) => eventStatuses.includes(item.status) && item.eventId === selectedEvent?.id && item.quantity > 0),
    [goods, selectedEvent?.id],
  );
  const totalQuantity = eventGoods.reduce((sum, item) => sum + item.quantity, 0);
  const yearDays = useMemo(() => getYearDays(), []);
  const calendarMonths = useMemo(() => groupCalendarDays(yearDays), [yearDays]);
  const currentMonth = calendarMonths[currentMonthIndex];
  const eventDateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      if (event.date) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
    });
    return counts;
  }, [events]);

  const resetForm = () => {
    setName('');
    setDate('');
    setVenue('');
    setMemo('');
    setEditingEventId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen((current) => !current);
  };

  const openEditForm = () => {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setName(selectedEvent.name);
    setDate(selectedEvent.date);
    setVenue(selectedEvent.venue);
    setMemo(selectedEvent.memo);
    setFormOpen(true);
  };

  const saveEvent = async () => {
    if (!name.trim()) {
      Alert.alert('イベント名を入力してください');
      return;
    }
    if (editingEventId) {
      await updateEvent(editingEventId, { name: name.trim(), date: date.trim(), venue: venue.trim(), memo: memo.trim() });
    } else {
      await addEvent({ name: name.trim(), date: date.trim(), venue: venue.trim(), memo: memo.trim() });
    }
    resetForm();
    setFormOpen(false);
  };

  const confirmRemoveEvent = () => {
    if (!selectedEvent) return;
    Alert.alert('イベントを削除しますか？', selectedEvent.name, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeEvent(selectedEvent.id) },
    ]);
  };

  if (screenMode === 'addGoods' && selectedEvent) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.subHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setScreenMode('list')} style={styles.iconButton}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.subHeaderTitle, { color: colors.text }]}>購入予定を追加</Text>
          <View style={styles.iconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>{selectedEvent.name}</Text>
            <Text style={[styles.eventMeta, { color: colors.muted }]}>このイベントの購入リストに追加します。</Text>
          </View>
          <ManualGoodsForm
            initialStatus="wanted"
            initialEventId={selectedEvent.id}
            allowedStatuses={['wanted', 'reserved', 'ordered', 'shipped']}
            onSubmit={async (input) => {
              await addGoods(input);
              setScreenMode('list');
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>イベント</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>イベントごとに購入予定リストを管理</Text>
          </View>
          <View style={[styles.summaryBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
            <Text style={[styles.summaryText, { color: colors.text }]}>{eventGoods.length}種 / {totalQuantity}個</Text>
          </View>
        </View>

        <Pressable onPress={openCreateForm} style={[styles.collapseButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.primary} name={formOpen && !editingEventId ? 'close' : 'add-circle-outline'} size={20} />
          <Text style={[styles.collapseButtonText, { color: colors.text }]}>イベント登録</Text>
          <Ionicons color={colors.muted} name={formOpen ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>

        {formOpen ? (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>{editingEventId ? 'イベント編集' : 'イベント登録'}</Text>
            <TextInput value={name} onChangeText={setName} placeholder="イベント名" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
            <View style={styles.twoColumnRow}>
              <TextInput value={date} onChangeText={setDate} placeholder="開催日 2026-09-15" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput, { backgroundColor: colors.input, color: colors.text }]} />
              <TextInput value={venue} onChangeText={setVenue} placeholder="会場" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput, { backgroundColor: colors.input, color: colors.text }]} />
            </View>
            <TextInput value={memo} onChangeText={setMemo} placeholder="メモ" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
            <Pressable onPress={saveEvent} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Ionicons color="#ffffff" name="save-outline" size={18} />
              <Text style={styles.primaryText}>{editingEventId ? 'イベントを更新' : 'イベントを追加'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calendarHeader}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>イベントカレンダー</Text>
            <View style={styles.monthNav}>
              <Pressable
                disabled={currentMonthIndex <= 0}
                onPress={() => setCurrentMonthIndex((index) => Math.max(0, index - 1))}
                style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex <= 0 ? 0.4 : 1 }]}
              >
                <Ionicons color={colors.text} name="chevron-back" size={18} />
              </Pressable>
              <Pressable
                disabled={currentMonthIndex >= calendarMonths.length - 1}
                onPress={() => setCurrentMonthIndex((index) => Math.min(calendarMonths.length - 1, index + 1))}
                style={[styles.monthNavButton, { borderColor: colors.border, opacity: currentMonthIndex >= calendarMonths.length - 1 ? 0.4 : 1 }]}
              >
                <Ionicons color={colors.text} name="chevron-forward" size={18} />
              </Pressable>
            </View>
          </View>
          {currentMonth ? (
            <>
              <Text style={[styles.monthTitle, { color: colors.text }]}>{currentMonth.label}</Text>
              <View style={styles.monthGrid}>
                {currentMonth.days.map((day) => {
                  const count = eventDateCounts.get(day.key) ?? 0;
                  return (
                    <View key={day.key} style={[styles.dayCell, { backgroundColor: count ? colors.primary : colors.elevated }]}>
                      <Text style={[styles.weekdayText, { color: count ? '#ffffff' : colors.muted }]}>{day.weekday}</Text>
                      <Text style={[styles.dayText, { color: count ? '#ffffff' : colors.text }]}>{day.day}</Text>
                      <Text style={[styles.dayCountText, { color: count ? '#ffffff' : colors.muted }]}>{count ? `${count}件` : '-'}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        {!!events.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChips}>
            {events.map((event) => {
              const active = event.id === selectedEvent?.id;
              return (
                <Pressable
                  key={event.id}
                  onPress={() => setSelectedEventId(event.id)}
                  style={[styles.eventChip, { backgroundColor: active ? colors.text : colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.eventChipText, { color: active ? colors.background : colors.text }]}>{event.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selectedEvent ? (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.eventHeader}>
              <View style={styles.eventHeaderText}>
                <Text style={[styles.panelTitle, { color: colors.text }]}>{selectedEvent.name}</Text>
                <Text style={[styles.eventMeta, { color: colors.muted }]}>
                  {[selectedEvent.date, selectedEvent.venue].filter(Boolean).join(' / ') || '日程未設定'}
                </Text>
              </View>
              <Pressable onPress={openEditForm} style={styles.iconButton}>
                <Ionicons color={colors.primary} name="create-outline" size={19} />
              </Pressable>
              <Pressable onPress={confirmRemoveEvent} style={styles.iconButton}>
                <Ionicons color={colors.danger} name="trash-outline" size={19} />
              </Pressable>
            </View>
            {!!selectedEvent.memo && <Text style={[styles.eventMeta, { color: colors.muted }]}>{selectedEvent.memo}</Text>}
            <Pressable onPress={() => setScreenMode('addGoods')} style={[styles.secondaryButton, { borderColor: colors.border }]}>
              <Ionicons color={colors.primary} name="add" size={18} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>購入予定を追加</Text>
            </Pressable>
          </View>
        ) : null}

        {eventGoods.map((item) => (
          <GoodsCard
            key={item.id}
            item={item}
            mode="manage"
            onDecrease={() => updateQuantity(item.id, -1)}
            onIncrease={() => updateQuantity(item.id, 1)}
            onToggleFavorite={() => updateGoods(item.id, { ...item, favorite: !item.favorite })}
            onRemove={() => removeGoods(item.id)}
          />
        ))}

        {selectedEvent && !eventGoods.length ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons color={colors.muted} name="bag-outline" size={40} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>購入予定はありません</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>登録タブのイベント、またはこの画面から購入予定を追加できます。</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 96 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  subHeader: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 54, justifyContent: 'space-between', paddingHorizontal: 12 },
  subHeaderTitle: { fontSize: 17, fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 2 },
  summaryBadge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 },
  summaryText: { fontSize: 12, fontWeight: '900' },
  panel: { borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  collapseButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  collapseButtonText: { flex: 1, fontSize: 15, fontWeight: '900' },
  input: { borderRadius: 8, fontSize: 15, minHeight: 44, paddingHorizontal: 12 },
  twoColumnRow: { flexDirection: 'row', gap: 8 },
  flexInput: { flex: 1 },
  primaryButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 7, height: 44, justifyContent: 'center' },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, height: 42, justifyContent: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  eventChips: { gap: 8 },
  eventChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', paddingHorizontal: 12 },
  eventChipText: { fontSize: 12, fontWeight: '900' },
  eventHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eventHeaderText: { flex: 1 },
  eventMeta: { fontSize: 12, fontWeight: '800', lineHeight: 18 },
  iconButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', gap: 8 },
  monthNavButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  monthTitle: { fontSize: 15, fontWeight: '900' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 58, paddingVertical: 6, width: 42 },
  weekdayText: { fontSize: 10, fontWeight: '900' },
  dayText: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  dayCountText: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
});
