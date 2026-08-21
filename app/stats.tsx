import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isOshiGoods } from '../src/lib/oshi';
import { useGoods } from '../src/store/GoodsContext';
import { useProfile } from '../src/store/ProfileContext';
import { useAppTheme } from '../src/store/ThemeContext';
import { Goods } from '../src/types';

type RankingRow = { label: string; count: number; quantity: number };

function summarize(items: Goods[], getLabel: (item: Goods) => string): RankingRow[] {
  const map = new Map<string, RankingRow>();
  items.forEach((item) => {
    const label = getLabel(item).trim() || '未設定';
    const current = map.get(label) ?? { label, count: 0, quantity: 0 };
    current.count += 1;
    current.quantity += item.quantity;
    map.set(label, current);
  });
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity || b.count - a.count || a.label.localeCompare(b.label, 'ja'));
}

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const { profile, profiles } = useProfile();

  const collectionGoods = useMemo(() => goods.filter((item) => (item.status === 'owned' || item.status === 'unorganized') && item.quantity > 0), [goods]);
  const randomGoods = useMemo(() => collectionGoods.filter((item) => item.isRandom), [collectionGoods]);
  const oshiGoods = useMemo(() => collectionGoods.filter((item) => isOshiGoods(item, profile)), [collectionGoods, profile]);
  const exchangeGoods = useMemo(() => collectionGoods.filter((item) => item.exchangeQuantity > 0), [collectionGoods]);
  const seriesRanking = useMemo(() => summarize(collectionGoods, (item) => item.seriesName).slice(0, 8), [collectionGoods]);
  const characterRanking = useMemo(() => summarize(collectionGoods, (item) => item.characterName).slice(0, 8), [collectionGoods]);
  const storageRanking = useMemo(() => summarize(collectionGoods.filter((item) => item.storageLocation), (item) => item.storageLocation).slice(0, 8), [collectionGoods]);

  const totalQuantity = collectionGoods.reduce((sum, item) => sum + item.quantity, 0);
  const randomQuantity = randomGoods.reduce((sum, item) => sum + item.quantity, 0);
  const oshiQuantity = oshiGoods.reduce((sum, item) => sum + item.quantity, 0);
  const exchangeQuantity = exchangeGoods.reduce((sum, item) => sum + item.exchangeQuantity, 0);
  const missingImageCount = collectionGoods.filter((item) => !item.imageUrl).length;
  const unorganizedCount = collectionGoods.filter((item) => item.status === 'unorganized').length;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="戻る" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>統計</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>コレクションの偏りと整理状況</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard icon="albums-outline" label="種類" value={`${collectionGoods.length}`} />
          <StatCard icon="cube-outline" label="合計数" value={`${totalQuantity}`} />
          <StatCard icon="shuffle-outline" label="ランダム" value={`${randomQuantity}`} />
          <StatCard icon="swap-horizontal-outline" label="交換可能" value={`${exchangeQuantity}`} />
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>推し別</Text>
          <View style={styles.oshiRow}>
            <MiniMetric label="登録中の推し" value={`${profiles.length}人`} />
            <MiniMetric label="現在の推しグッズ" value={`${oshiGoods.length}種 / ${oshiQuantity}個`} />
          </View>
          <Text style={[styles.note, { color: colors.muted }]}>
            {profile.oshiName.trim() || '推し未設定'} / {profile.seriesName.trim() || 'シリーズ未設定'}
          </Text>
        </View>

        <RankingPanel title="シリーズ別" rows={seriesRanking} />
        <RankingPanel title="キャラクター別" rows={characterRanking} />
        <RankingPanel title="保管場所" rows={storageRanking} emptyText="保管場所を設定すると、ここに所在の偏りが表示されます。" />

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>整理チェック</Text>
          <ActionRow
            icon="file-tray-outline"
            label="未整理"
            value={`${unorganizedCount}件`}
            onPress={() => router.push('/(tabs)/collection?mode=manage&filter=unorganized')}
          />
          <ActionRow
            icon="image-outline"
            label="画像なし"
            value={`${missingImageCount}件`}
            onPress={() => router.push('/(tabs)/collection?mode=manage')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons color={colors.primary} name={icon} size={20} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.miniMetric, { backgroundColor: colors.input }]}>
      <Text style={[styles.miniValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.miniLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function RankingPanel({ emptyText = 'まだ集計できるデータがありません。', rows, title }: { emptyText?: string; rows: RankingRow[]; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.text }]}>{title}</Text>
      {rows.length ? rows.map((row, index) => <RankingItem key={row.label} index={index} row={row} max={rows[0].quantity} />) : (
        <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyText}</Text>
      )}
    </View>
  );
}

function RankingItem({ index, max, row }: { index: number; max: number; row: RankingRow }) {
  const { colors } = useAppTheme();
  const width = (max > 0 ? `${Math.max(8, Math.round((row.quantity / max) * 100))}%` : '8%') as `${number}%`;
  return (
    <View style={styles.rankingItem}>
      <View style={styles.rankingHeader}>
        <Text numberOfLines={1} style={[styles.rankingName, { color: colors.text }]}>{index + 1}. {row.label}</Text>
        <Text style={[styles.rankingValue, { color: colors.muted }]}>{row.count}種 / {row.quantity}個</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.input }]}>
        <View style={[styles.barFill, { backgroundColor: colors.primary, width }]} />
      </View>
    </View>
  );
}

function ActionRow({ icon, label, onPress, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; value: string }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.actionRow, { backgroundColor: colors.elevated }]}>
      <Ionicons color={colors.primary} name={icon} size={20} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.actionValue, { color: colors.muted }]}>{value}</Text>
      <Ionicons color={colors.muted} name="chevron-forward" size={17} />
    </Pressable>
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
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { borderRadius: 8, borderWidth: 1, flexBasis: '47%', gap: 6, minHeight: 96, padding: 13 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '800' },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  oshiRow: { flexDirection: 'row', gap: 8 },
  miniMetric: { borderRadius: 8, flex: 1, padding: 10 },
  miniValue: { fontSize: 15, fontWeight: '900' },
  miniLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  note: { fontSize: 12, fontWeight: '800', marginTop: 10 },
  rankingItem: { marginTop: 10 },
  rankingHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  rankingName: { flex: 1, fontSize: 13, fontWeight: '900' },
  rankingValue: { fontSize: 11, fontWeight: '800' },
  barTrack: { borderRadius: 999, height: 8, marginTop: 7, overflow: 'hidden' },
  barFill: { borderRadius: 999, height: '100%' },
  emptyText: { fontSize: 12, fontWeight: '800', lineHeight: 18 },
  actionRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 10, minHeight: 52, padding: 12, marginTop: 8 },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '900' },
  actionValue: { fontSize: 12, fontWeight: '900' },
});
