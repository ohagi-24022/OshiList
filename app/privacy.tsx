import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../src/store/ThemeContext';

const policySections = [
  {
    title: '取得する情報',
    body: 'OshiListでは、ユーザーが登録したグッズ名、シリーズ名、キャラクター名、所持数、ステータス、画像、テーマ設定、推しプロフィールを扱います。バーコード登録ではJANコード、領収書や写真登録αでは選択または撮影した画像を扱います。',
  },
  {
    title: '利用目的',
    body: '取得した情報は、コレクション管理、重複や交換可能グッズの確認、未整理グッズの整理、商品情報の取得、AIによる入力補助、テーマや推し設定の反映のために利用します。',
  },
  {
    title: '端末内への保存',
    body: '登録したコレクション情報や画像、設定は主に端末内に保存されます。ネットワークがない場所でも、登録済みデータの閲覧や編集ができるようにするためです。',
  },
  {
    title: '外部サービスへの送信',
    body: '商品情報の取得やAI解析を行う場合、バックエンドを通じて楽天市場API、Yahoo!ショッピングAPI、Gemini APIなどの外部サービスへ、JANコード、商品名、領収書画像、商品写真などを送信することがあります。',
  },
  {
    title: 'カメラと写真ライブラリ',
    body: 'カメラはバーコード読取、領収書撮影、商品画像撮影に使用します。写真ライブラリは商品画像や解析対象画像を選択するために使用します。許可された画像以外をアプリが自動で取得することはありません。',
  },
  {
    title: '第三者提供',
    body: '法令に基づく場合を除き、ユーザーが登録したコレクション情報を第三者へ販売または提供することはありません。ただし、商品検索やAI解析に必要な範囲で外部APIへ送信される場合があります。',
  },
  {
    title: 'データの削除',
    body: '登録したグッズや画像はアプリ内の削除操作で削除できます。端末からアプリを削除した場合、端末内に保存されたアプリデータも削除される場合があります。',
  },
  {
    title: '注意事項',
    body: '領収書や写真を解析する場合、氏名、住所、電話番号、決済情報などの個人情報が写り込まないようにしてください。必要に応じて撮影前に隠す、または写らない角度で撮影してください。',
  },
  {
    title: '改定',
    body: '機能追加や利用する外部サービスの変更に合わせて、本ポリシーを更新することがあります。重要な変更がある場合は、アプリ内で分かる形で案内します。',
  },
] as const;

export default function PrivacyScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>プライバシーポリシー</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>最終更新日: 2026年8月6日</Text>
          </View>
        </View>

        <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="shield-checkmark-outline" size={28} />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>コレクション情報は主に端末内で管理します</Text>
            <Text style={[styles.summaryBody, { color: colors.muted }]}>
              商品検索やAI解析を使う時だけ、必要な情報をバックエンドや外部APIへ送信します。
            </Text>
          </View>
        </View>

        <View style={styles.sectionList}>
          {policySections.map((section) => (
            <View key={section.title} style={[styles.policyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.cardBody, { color: colors.muted }]}>{section.body}</Text>
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
  title: { fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  summaryPanel: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  summaryIcon: { alignItems: 'center', borderRadius: 999, height: 54, justifyContent: 'center', width: 54 },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 16, fontWeight: '900', lineHeight: 22 },
  summaryBody: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 4 },
  sectionList: { gap: 10 },
  policyCard: { borderRadius: 8, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  cardBody: { fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 6 },
});
