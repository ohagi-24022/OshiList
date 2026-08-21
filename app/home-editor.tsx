import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSettings } from '../src/store/AppSettingsContext';
import { useAppTheme } from '../src/store/ThemeContext';

const homeCardOptions = [
  { id: 'oshi', label: '推しプロフィール', description: '推し画像と推しグッズ数を表示します。', icon: 'heart-outline' },
  { id: 'lineup', label: 'ラインナップ収集率', description: 'ランダムグッズの収集率を表示します。', icon: 'analytics-outline' },
  { id: 'unorganized', label: '未整理の整理提案', description: '未整理グッズへの導線を表示します。', icon: 'file-tray-outline' },
  { id: 'quickActions', label: 'クイック操作', description: 'コレクションとマイページへの近道を表示します。', icon: 'flash-outline' },
  { id: 'exchange', label: '交換可能グッズ', description: '交換管理がONのとき候補を表示します。', icon: 'swap-horizontal-outline' },
  { id: 'schedule', label: '予約・到着待ち', description: '予約や発送済みの予定を表示します。', icon: 'calendar-outline' },
  { id: 'favorites', label: 'お気に入り', description: 'お気に入り登録したグッズを表示します。', icon: 'star-outline' },
  { id: 'oshiGoods', label: '推しのグッズ', description: '推しプロフィールに一致する所持品を表示します。', icon: 'sparkles-outline' },
  { id: 'recent', label: '最近追加したグッズ', description: '登録したばかりのグッズを表示します。', icon: 'cube-outline' },
] as const;

type HomeCardId = (typeof homeCardOptions)[number]['id'];

export default function HomeEditorScreen() {
  const { colors } = useAppTheme();
  const { settings, updateSettings } = useAppSettings();
  const [draftCards, setDraftCards] = useState<HomeCardId[]>(
    settings.homeCards.filter((card): card is HomeCardId => homeCardOptions.some((option) => option.id === card)),
  );

  const toggleCard = (id: HomeCardId) => {
    setDraftCards((current) => {
      if (current.includes(id)) return current.filter((card) => card !== id);
      return [...current, id];
    });
  };

  const moveCard = (id: HomeCardId, direction: -1 | 1) => {
    setDraftCards((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const reset = () => {
    setDraftCards(homeCardOptions.map((option) => option.id));
  };

  const save = async () => {
    if (!draftCards.length) {
      Alert.alert('カードを1つ以上選択してください', 'ホームに表示するカードがないと、ホーム画面が空になってしまいます。');
      return;
    }
    await updateSettings({ homeCards: draftCards });
    router.back();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ホーム編集</Text>
        <Pressable accessibilityLabel="初期配置に戻す" onPress={reset} style={styles.iconButton}>
          <Ionicons color={colors.primary} name="refresh-outline" size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>カードの表示と並び順</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            表示したいカードを選び、矢印でホームでの順番を調整できます。
          </Text>
        </View>

        <View style={styles.cardList}>
          {homeCardOptions.map((option) => {
            const selected = draftCards.includes(option.id);
            const index = draftCards.indexOf(option.id);
            return (
              <View
                key={option.id}
                style={[
                  styles.cardOption,
                  { backgroundColor: selected ? colors.surface : colors.elevated, borderColor: selected ? colors.primary : colors.border },
                ]}
              >
                <Pressable onPress={() => toggleCard(option.id)} style={styles.cardMain}>
                  <View style={[styles.cardIcon, { backgroundColor: selected ? colors.primary : colors.surface }]}>
                    <Ionicons color={selected ? '#ffffff' : colors.muted} name={option.icon} size={20} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.cardDescription, { color: colors.muted }]}>{option.description}</Text>
                  </View>
                  <Ionicons color={selected ? colors.primary : colors.muted} name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
                </Pressable>

                {selected ? (
                  <View style={[styles.orderControls, { borderTopColor: colors.border }]}>
                    <Text style={[styles.orderText, { color: colors.muted }]}>表示順 {index + 1}</Text>
                    <View style={styles.orderButtons}>
                      <Pressable
                        accessibilityLabel={`${option.label}を上へ移動`}
                        disabled={index <= 0}
                        onPress={() => moveCard(option.id, -1)}
                        style={[styles.orderButton, { borderColor: colors.border, opacity: index <= 0 ? 0.35 : 1 }]}
                      >
                        <Ionicons color={colors.text} name="chevron-up" size={18} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${option.label}を下へ移動`}
                        disabled={index >= draftCards.length - 1}
                        onPress={() => moveCard(option.id, 1)}
                        style={[styles.orderButton, { borderColor: colors.border, opacity: index >= draftCards.length - 1 ? 0.35 : 1 }]}
                      >
                        <Ionicons color={colors.text} name="chevron-down" size={18} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: draftCards.length ? colors.primary : colors.border }]}>
          <Text style={styles.saveText}>ホームに反映</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 54, justifyContent: 'space-between', paddingHorizontal: 12 },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  content: { gap: 16, padding: 18, paddingBottom: 18 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  cardList: { gap: 10 },
  cardOption: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  cardMain: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 74, padding: 12 },
  cardIcon: { alignItems: 'center', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  cardDescription: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  orderControls: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 10, paddingLeft: 64 },
  orderText: { fontSize: 12, fontWeight: '900' },
  orderButtons: { flexDirection: 'row', gap: 8 },
  orderButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  footer: { borderTopWidth: 1, padding: 18, paddingTop: 12 },
  saveButton: { alignItems: 'center', borderRadius: 8, height: 50, justifyContent: 'center' },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
