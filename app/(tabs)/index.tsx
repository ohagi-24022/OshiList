import { useScrollToTop } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeGoodsTile } from '../../src/components/HomeGoodsTile';
import { isOshiGoods } from '../../src/lib/oshi';
import { useAppSettings } from '../../src/store/AppSettingsContext';
import { useGoods } from '../../src/store/GoodsContext';
import { useProfile } from '../../src/store/ProfileContext';
import { useAppTheme } from '../../src/store/ThemeContext';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { settings } = useAppSettings();
  const { goods, loading } = useGoods();
  const { profile, profiles } = useProfile();
  const scrollRef = useRef<ScrollView>(null);

  const ownedGoods = useMemo(() => goods.filter((item) => item.status === 'owned' && item.quantity > 0), [goods]);
  const oshiGoods = useMemo(() => ownedGoods.filter((item) => isOshiGoods(item, profile)), [ownedGoods, profile]);
  const recentGoods = useMemo(() => [...goods].sort((a, b) => b.id - a.id).slice(0, 4), [goods]);
  const unorganizedGoods = useMemo(() => goods.filter((item) => item.status === 'unorganized'), [goods]);
  const exchangeGoods = useMemo(
    () => ownedGoods.filter((item) => item.isRandom && item.quantity > 1).sort((a, b) => b.quantity - a.quantity).slice(0, 4),
    [ownedGoods],
  );
  const lineupProgress = useMemo(() => {
    const groups = new Map<string, { boxName: string; seriesName: string; owned: Set<string>; total: Set<string> }>();
    goods
      .filter((item) => item.isRandom && item.status !== 'unorganized')
      .forEach((item) => {
        const key = `${item.seriesName}::${item.boxName}`;
        const group = groups.get(key) ?? {
          boxName: item.boxName,
          seriesName: item.seriesName,
          owned: new Set<string>(),
          total: new Set<string>(),
        };
        const variantKey = `${item.characterName}::${item.variantName}`;
        group.total.add(variantKey);
        if (item.status === 'owned' && item.quantity > 0) {
          group.owned.add(variantKey);
        }
        groups.set(key, group);
      });
    return Array.from(groups.values())
      .filter((group) => group.total.size >= 2)
      .sort((a, b) => b.total.size - a.total.size)[0] ?? null;
  }, [goods]);
  const totalQuantity = ownedGoods.reduce((sum, item) => sum + item.quantity, 0);
  const oshiQuantity = oshiGoods.reduce((sum, item) => sum + item.quantity, 0);
  const lineupRate = lineupProgress ? Math.round((lineupProgress.owned.size / lineupProgress.total.size) * 100) : 0;
  useScrollToTop(scrollRef);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>ホーム</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? '読み込み中' : `${ownedGoods.length}種類 / ${totalQuantity}個を所持`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="マイページを開く"
            onPress={() => router.push('/mypage')}
            style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons color={colors.primary} name="person-circle-outline" size={24} />
          </Pressable>
        </View>

        <View style={[styles.oshiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.oshiImageWrap, { backgroundColor: colors.elevated }]}>
            {profile.imageUrl ? (
              <Image source={{ uri: profile.imageUrl }} style={styles.oshiImage} />
            ) : (
              <Ionicons color={colors.muted} name="sparkles-outline" size={34} />
            )}
          </View>
          <View style={styles.oshiBody}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>推し</Text>
            <Text numberOfLines={1} style={[styles.oshiName, { color: colors.text }]}>
              {profile.oshiName.trim() || '推し未設定'}
            </Text>
            <Text numberOfLines={1} style={[styles.oshiMeta, { color: colors.muted }]}>
              {profile.seriesName.trim() || 'シリーズ未設定'}
            </Text>
            <View style={styles.statRow}>
              <MiniStat label="推しグッズ" value={`${oshiGoods.length}種類`} />
              <MiniStat label="合計" value={`${oshiQuantity}個`} />
              <MiniStat label="推し" value={`${profiles.length}人`} />
            </View>
          </View>
        </View>

        {lineupProgress ? (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={[styles.cardLabel, { color: colors.muted }]}>ラインナップ収集率</Text>
                <Text numberOfLines={1} style={[styles.progressTitle, { color: colors.text }]}>
                  {lineupProgress.seriesName}
                </Text>
                <Text numberOfLines={1} style={[styles.progressMeta, { color: colors.muted }]}>
                  {lineupProgress.boxName}
                </Text>
              </View>
              <Text style={[styles.progressRate, { color: colors.primary }]}>{lineupRate}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.input }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${lineupRate}%` }]} />
            </View>
            <View style={styles.progressStats}>
              <MiniStat label="全体" value={`${lineupProgress.total.size}種`} />
              <MiniStat label="所持" value={`${lineupProgress.owned.size}種`} />
              <MiniStat label="未所持" value={`${Math.max(lineupProgress.total.size - lineupProgress.owned.size, 0)}種`} />
            </View>
          </View>
        ) : null}

        {unorganizedGoods.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/manage')}
            style={[styles.suggestionCard, { backgroundColor: colors.primary }]}
          >
            <View style={styles.suggestionIcon}>
              <Ionicons color="#ffffff" name="file-tray-outline" size={22} />
            </View>
            <View style={styles.suggestionBody}>
              <Text style={styles.suggestionTitle}>未整理を整理しましょう</Text>
              <Text style={styles.suggestionText}>{unorganizedGoods.length}件のグッズが未整理です</Text>
            </View>
            <Ionicons color="#ffffff" name="chevron-forward" size={20} />
          </Pressable>
        ) : (
          <View style={[styles.cleanCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.primary} name="checkmark-circle-outline" size={22} />
            <Text style={[styles.cleanText, { color: colors.text }]}>未整理のグッズはありません</Text>
          </View>
        )}

        <View style={styles.quickGrid}>
          <QuickAction
            icon="albums-outline"
            label="コレクション"
            text="所持グッズを見る"
            onPress={() => router.push('/(tabs)/collection')}
          />
          <QuickAction
            icon="person-circle-outline"
            label="マイページ"
            text="推し設定を編集"
            onPress={() => router.push('/mypage')}
          />
        </View>

        {settings.exchangeEnabled && exchangeGoods.length ? (
          <>
            <SectionHeader
              title="交換可能グッズ"
              actionLabel="管理へ"
              onPress={() => router.push('/(tabs)/manage')}
            />
            <View style={styles.tileGrid}>
              {exchangeGoods.map((item) => (
                <View key={item.id} style={styles.tileItem}>
                  <HomeGoodsTile item={item} />
                  <View style={[styles.exchangeBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons color="#ffffff" name="swap-horizontal-outline" size={13} />
                    <Text style={styles.exchangeBadgeText}>交換可能 {item.quantity - 1}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader
          title="推しのグッズ"
          actionLabel="コレクションへ"
          onPress={() => router.push('/(tabs)/collection')}
        />
        {oshiGoods.length ? (
          <View style={styles.tileGrid}>
            {oshiGoods.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.tileItem}>
                <HomeGoodsTile item={item} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyPanel icon="heart-outline" text="推し設定をすると、ここに推しのグッズが表示されます" />
        )}

        <SectionHeader
          title="最近追加したグッズ"
          actionLabel="管理へ"
          onPress={() => router.push('/(tabs)/manage')}
        />
        {recentGoods.length ? (
          <View style={styles.tileGrid}>
            {recentGoods.map((item) => (
              <View key={item.id} style={styles.tileItem}>
                <HomeGoodsTile item={item} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyPanel icon="cube-outline" text="スキャンや手動登録をすると、最近追加したグッズが表示されます" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: colors.input }]}>
      <Text style={[styles.miniStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  text: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons color={colors.primary} name={icon} size={22} />
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.quickText, { color: colors.muted }]}>{text}</Text>
    </Pressable>
  );
}

function SectionHeader({ actionLabel, onPress, title }: { actionLabel: string; onPress: () => void; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Pressable onPress={onPress} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: colors.primary }]}>{actionLabel}</Text>
        <Ionicons color={colors.primary} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

function EmptyPanel({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons color={colors.muted} name={icon} size={24} />
      <Text style={[styles.emptyText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingBottom: 96 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, marginTop: 3 },
  profileButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  oshiCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    padding: 14,
  },
  oshiImageWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 108,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 86,
  },
  oshiImage: { height: '100%', width: '100%' },
  oshiBody: { flex: 1, minWidth: 0 },
  cardLabel: { fontSize: 11, fontWeight: '900' },
  oshiName: { fontSize: 21, fontWeight: '900', marginTop: 4 },
  oshiMeta: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniStat: { borderRadius: 8, flex: 1, padding: 9 },
  miniStatValue: { fontSize: 16, fontWeight: '900' },
  miniStatLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  progressCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  progressHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  progressTitle: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  progressMeta: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  progressRate: { fontSize: 28, fontWeight: '900' },
  progressTrack: { borderRadius: 999, height: 9, marginTop: 12, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: '100%' },
  progressStats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  suggestionCard: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    minHeight: 72,
    padding: 14,
  },
  suggestionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  suggestionBody: { flex: 1 },
  suggestionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  suggestionText: { color: '#ffffff', fontSize: 12, fontWeight: '800', marginTop: 3, opacity: 0.88 },
  cleanCard: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  cleanText: { fontSize: 14, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickAction: { borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 92, padding: 13 },
  quickLabel: { fontSize: 15, fontWeight: '900', marginTop: 10 },
  quickText: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionAction: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: 36 },
  sectionActionText: { fontSize: 12, fontWeight: '900' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tileItem: { width: '48.5%' },
  exchangeBadge: {
    alignItems: 'center',
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    minHeight: 26,
    paddingHorizontal: 8,
  },
  exchangeBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  emptyPanel: {
    alignItems: 'center',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    minHeight: 72,
    padding: 14,
  },
  emptyText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18 },
});
