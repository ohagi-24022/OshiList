import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsCard } from '../../src/components/GoodsCard';
import { ManualGoodsForm } from '../../src/components/ManualGoodsForm';
import { goodsStatusLabels } from '../../src/lib/goodsStatus';
import { useEvents } from '../../src/store/EventContext';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';

const eventStatuses = ['wanted', 'reserved', 'ordered', 'shipped'];

export default function EventScreen() {
  const { colors } = useAppTheme();
  const { addGoods, goods, updateGoods, updateQuantity, removeGoods } = useGoods();
  const { events, selectedEventId, setSelectedEventId, addEvent, removeEvent } = useEvents();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [memo, setMemo] = useState('');
  const [addingGoods, setAddingGoods] = useState(false);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const eventGoods = useMemo(
    () => goods.filter((item) => eventStatuses.includes(item.status) && item.eventId === selectedEvent?.id && item.quantity > 0),
    [goods, selectedEvent?.id],
  );
  const totalQuantity = eventGoods.reduce((sum, item) => sum + item.quantity, 0);

  const createEvent = async () => {
    if (!name.trim()) {
      Alert.alert('イベント名を入力してください');
      return;
    }
    await addEvent({ name: name.trim(), date: date.trim(), venue: venue.trim(), memo: memo.trim() });
    setName('');
    setDate('');
    setVenue('');
    setMemo('');
  };

  const confirmRemoveEvent = () => {
    if (!selectedEvent) return;
    Alert.alert('イベントを削除しますか？', selectedEvent.name, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeEvent(selectedEvent.id) },
    ]);
  };

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

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>イベント作成</Text>
          <TextInput value={name} onChangeText={setName} placeholder="イベント名" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
          <View style={styles.twoColumnRow}>
            <TextInput value={date} onChangeText={setDate} placeholder="開催日 2026-09-15" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput, { backgroundColor: colors.input, color: colors.text }]} />
            <TextInput value={venue} onChangeText={setVenue} placeholder="会場" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput, { backgroundColor: colors.input, color: colors.text }]} />
          </View>
          <TextInput value={memo} onChangeText={setMemo} placeholder="メモ" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, color: colors.text }]} />
          <Pressable onPress={createEvent} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="add" size={18} />
            <Text style={styles.primaryText}>イベントを追加</Text>
          </Pressable>
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
              <Pressable onPress={confirmRemoveEvent} style={styles.iconButton}>
                <Ionicons color={colors.danger} name="trash-outline" size={19} />
              </Pressable>
            </View>
            {!!selectedEvent.memo && <Text style={[styles.eventMeta, { color: colors.muted }]}>{selectedEvent.memo}</Text>}
            <Pressable onPress={() => setAddingGoods((current) => !current)} style={[styles.secondaryButton, { borderColor: colors.border }]}>
              <Ionicons color={colors.primary} name={addingGoods ? 'close' : 'add'} size={18} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>{addingGoods ? '追加を閉じる' : '購入予定を追加'}</Text>
            </Pressable>
            {addingGoods ? (
              <ManualGoodsForm
                initialStatus="wanted"
                initialEventId={selectedEvent.id}
                allowedStatuses={['wanted', 'reserved', 'ordered', 'shipped']}
                onSubmit={async (input) => {
                  await addGoods(input);
                  setAddingGoods(false);
                }}
              />
            ) : null}
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
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 2 },
  summaryBadge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 },
  summaryText: { fontSize: 12, fontWeight: '900' },
  panel: { borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
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
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
});
