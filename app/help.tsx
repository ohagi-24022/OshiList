import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../src/store/ThemeContext';

const helpSections = [
  {
    icon: 'scan-outline',
    title: '登録方法の使い分け',
    body: 'バーコードはJANコードがある商品向け、領収書は複数の商品名をまとめて拾いたい時向け、写真登録αは商品を特定するより未整理登録を素早く作るための補助機能です。',
  },
  {
    icon: 'camera-outline',
    title: '写真登録α',
    body: '写真からシリーズ名、キャラクター名、グッズ種別をAIが推定します。精度が不安定なため、初期状態は未整理で保存し、あとから管理タブで修正する前提です。',
  },
  {
    icon: 'receipt-outline',
    title: '領収書スキャン',
    body: '領収書やレシートから商品名らしい行を抽出し、商品候補を表示します。同じグッズをすでに持っている可能性がある場合は、既存グッズへの加算候補も表示されます。',
  },
  {
    icon: 'albums-outline',
    title: 'コレクションと管理',
    body: 'コレクションは所持グッズを見る場所、管理は詳細編集や未整理の整理をする場所です。未整理だけを表示して、シリーズやキャラクターをまとめて設定できます。',
  },
  {
    icon: 'shuffle-outline',
    title: 'ランダムグッズ',
    body: 'ランダムグッズにすると収集率や交換可能グッズの対象になります。設定でランダムグッズをまとめて表示するかを切り替えられます。',
  },
  {
    icon: 'color-wand-outline',
    title: 'テーマと推しマーク',
    body: 'テーマはプリセット選択のほか、自分でデザインして保存できます。推しプロフィールでは推しマークの形や色も変更できます。',
  },
  {
    icon: 'cloud-outline',
    title: '商品APIとAI',
    body: 'バーコード、領収書、写真登録αのAI推定にはバックエンド設定が必要です。オフライン時やAPI未設定時は手動登録に切り替えてください。',
  },
] as const;

export default function HelpScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>ヘルプ</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>OshiListの使い方と困った時の確認ポイントです。</Text>
          </View>
        </View>

        <View style={[styles.heroPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="help-circle-outline" size={30} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>迷ったら未整理で登録</Text>
            <Text style={[styles.heroBody, { color: colors.muted }]}>
              情報が曖昧なグッズは、写真だけ先に残して未整理にしておくと後から直しやすくなります。
            </Text>
          </View>
        </View>

        <View style={styles.sectionList}>
          {helpSections.map((section) => (
            <View key={section.title} style={[styles.helpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.cardIcon, { backgroundColor: colors.elevated }]}>
                <Ionicons color={colors.primary} name={section.icon} size={22} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{section.title}</Text>
                <Text style={[styles.cardBody, { color: colors.muted }]}>{section.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 96 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  backButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  heroPanel: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  heroIcon: { alignItems: 'center', borderRadius: 999, height: 54, justifyContent: 'center', width: 54 },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroBody: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 4 },
  sectionList: { gap: 10 },
  helpCard: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  cardIcon: { alignItems: 'center', borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  cardBody: { fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 5 },
});
