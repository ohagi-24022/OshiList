import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoods } from '../src/store/GoodsContext';
import { useAppTheme } from '../src/store/ThemeContext';
import { Goods } from '../src/types';

type Mode = 'give' | 'want';

function lineFor(item: Goods, mode: Mode) {
  const prefix = mode === 'give' ? `譲 ${item.exchangeQuantity}` : '求';
  return `${prefix} / ${item.seriesName} / ${item.characterName} ${item.variantName} / ${item.boxName}`;
}

export default function ExchangeListScreen() {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const [mode, setMode] = useState<Mode>('give');

  const giveGoods = useMemo(
    () => goods.filter((item) => item.status === 'owned' && item.quantity > 0 && item.exchangeQuantity > 0).sort((a, b) => b.exchangeQuantity - a.exchangeQuantity || b.id - a.id),
    [goods],
  );
  const wantGoods = useMemo(
    () => goods.filter((item) => item.status === 'wanted' && item.quantity > 0).sort((a, b) => b.id - a.id),
    [goods],
  );
  const activeGoods = mode === 'give' ? giveGoods : wantGoods;
  const shareText = activeGoods.map((item) => lineFor(item, mode)).join('\n');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="戻る" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>交換リスト</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>譲・求をイベントで確認</Text>
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.input }]}>
          <SegmentButton active={mode === 'give'} icon="swap-horizontal-outline" label={`譲 ${giveGoods.length}`} onPress={() => setMode('give')} />
          <SegmentButton active={mode === 'want'} icon="heart-outline" label={`求 ${wantGoods.length}`} onPress={() => setMode('want')} />
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{mode === 'give' ? '交換可能グッズ' : '欲しいグッズ'}</Text>
          <Text style={[styles.panelHelp, { color: colors.muted }]}>
            {mode === 'give'
              ? '目標数や保存用を超えた分が交換可能数として表示されます。'
              : '登録タブの予定・欲しいから追加したものが表示されます。'}
          </Text>
          {activeGoods.length ? (
            <View style={styles.list}>
              {activeGoods.map((item) => <ExchangeRow key={item.id} item={item} mode={mode} />)}
            </View>
          ) : (
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Ionicons color={colors.muted} name={mode === 'give' ? 'swap-horizontal-outline' : 'heart-outline'} size={34} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {mode === 'give' ? '交換可能数があるグッズはありません。' : '欲しいグッズはまだ登録されていません。'}
              </Text>
            </View>
          )}
        </View>

        {!!shareText && (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>テキストリスト</Text>
            <Text style={[styles.panelHelp, { color: colors.muted }]}>長押しで選択し、SNSやメモへ貼り付けられます。</Text>
            <Text selectable style={[styles.shareText, { backgroundColor: colors.input, color: colors.text }]}>{shareText}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentButton({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && { backgroundColor: colors.surface }]}>
      <Ionicons color={active ? colors.primary : colors.muted} name={icon} size={18} />
      <Text style={[styles.segmentText, { color: active ? colors.text : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function ExchangeRow({ item, mode }: { item: Goods; mode: Mode }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.input }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <Ionicons color={colors.muted} name="image-outline" size={22} />}
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.series, { color: colors.muted }]}>{item.seriesName}</Text>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{item.characterName} {item.variantName}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{item.boxName}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: mode === 'give' ? colors.primary : colors.secondary }]}>
        <Text style={styles.badgeText}>{mode === 'give' ? `譲 ${item.exchangeQuantity}` : '求'}</Text>
      </View>
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
  segment: { borderRadius: 8, flexDirection: 'row', gap: 4, padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 7, flex: 1, flexDirection: 'row', gap: 7, height: 42, justifyContent: 'center' },
  segmentText: { fontSize: 13, fontWeight: '900' },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 17, fontWeight: '900', marginBottom: 6 },
  panelHelp: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 12 },
  list: { gap: 10 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 72, padding: 9 },
  imageWrap: { alignItems: 'center', borderRadius: 7, height: 54, justifyContent: 'center', overflow: 'hidden', width: 54 },
  image: { height: '100%', width: '100%' },
  rowText: { flex: 1, minWidth: 0 },
  series: { fontSize: 11, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  badge: { alignItems: 'center', borderRadius: 999, minHeight: 30, justifyContent: 'center', minWidth: 52, paddingHorizontal: 10 },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, gap: 10, padding: 22 },
  emptyText: { fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  shareText: { borderRadius: 8, fontSize: 12, fontWeight: '700', lineHeight: 18, padding: 12 },
});
