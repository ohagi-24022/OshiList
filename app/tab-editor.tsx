import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSettings } from '../src/store/AppSettingsContext';
import { useAppTheme } from '../src/store/ThemeContext';

type UtilityTabId = 'schedule' | 'mypage' | 'event' | 'random';

const tabOptions = [
  { id: 'schedule', label: '予定', icon: 'calendar-outline' },
  { id: 'mypage', label: 'マイページ', icon: 'person-circle-outline' },
  { id: 'event', label: 'イベント', icon: 'sparkles-outline' },
  { id: 'random', label: 'ランダム開封', icon: 'cube-outline' },
] as const;

export default function TabEditorScreen() {
  const { colors } = useAppTheme();
  const { settings, updateSettings } = useAppSettings();
  const [draftTabs, setDraftTabs] = useState<UtilityTabId[]>(
    settings.utilityTabs.filter((tab): tab is UtilityTabId => tabOptions.some((option) => option.id === tab)).slice(0, 2),
  );

  const toggleTab = (id: UtilityTabId) => {
    setDraftTabs((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  };

  const save = async () => {
    if (draftTabs.length !== 2) {
      Alert.alert('タブを2つ選択してください', 'ホーム・コレクション・登録以外に表示するタブを2つ選んでください。');
      return;
    }
    await updateSettings({ utilityTabs: draftTabs });
    router.dismissTo('/(tabs)/settings');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>タブ編集</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>表示するタブを2つ選択</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            ホーム・コレクション・登録は固定です。設定はマイページから開けます。
          </Text>
        </View>

        <View style={styles.optionGrid}>
          {tabOptions.map((option) => {
            const selected = draftTabs.includes(option.id);
            return (
              <Pressable
                key={option.id}
                onPress={() => toggleTab(option.id)}
                style={[styles.option, { backgroundColor: selected ? colors.text : colors.surface, borderColor: selected ? colors.text : colors.border }]}
              >
                <Ionicons color={selected ? colors.background : colors.primary} name={option.icon} size={22} />
                <Text style={[styles.optionText, { color: selected ? colors.background : colors.text }]}>{option.label}</Text>
                {selected ? <Ionicons color={colors.background} name="checkmark-circle" size={20} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.fixedBox, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Text style={[styles.fixedTitle, { color: colors.text }]}>固定タブ</Text>
          <Text style={[styles.fixedText, { color: colors.muted }]}>ホーム / コレクション / 登録</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: draftTabs.length === 2 ? colors.primary : colors.border }]}>
          <Text style={styles.saveText}>このタブ構成にする</Text>
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
  optionGrid: { gap: 10 },
  option: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 58, paddingHorizontal: 14 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '900' },
  fixedBox: { borderRadius: 8, borderWidth: 1, padding: 12 },
  fixedTitle: { fontSize: 13, fontWeight: '900' },
  fixedText: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  footer: { borderTopWidth: 1, padding: 18, paddingTop: 12 },
  saveButton: { alignItems: 'center', borderRadius: 8, height: 50, justifyContent: 'center' },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
