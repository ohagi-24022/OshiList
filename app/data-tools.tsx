import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSettings } from '../src/store/AppSettingsContext';
import { useEvents } from '../src/store/EventContext';
import { useGoods } from '../src/store/GoodsContext';
import { useProfile } from '../src/store/ProfileContext';
import { useAppTheme } from '../src/store/ThemeContext';
import { EventPlan, Goods, GoodsInput } from '../src/types';

type BackupPayload = {
  app: 'OshiList';
  version: 1;
  exportedAt: string;
  goods: Goods[];
  events: EventPlan[];
  selectedEventId: string;
  settings: {
    exchangeEnabled: boolean;
    groupRandomGoods: boolean;
    homeCards: string[];
    utilityTabs: string[];
  };
  profiles: ReturnType<typeof useProfile>['profiles'];
  activeProfileId: string;
};

function goodsToInput(item: Goods): GoodsInput {
  return {
    boxName: item.boxName,
    characterName: item.characterName,
    collectionGoal: item.collectionGoal,
    eventId: item.eventId,
    exchangeQuantity: item.exchangeQuantity,
    favorite: item.favorite,
    imageUrl: item.imageUrl,
    inUseQuantity: item.inUseQuantity,
    isRandom: item.isRandom,
    janCode: item.janCode,
    keepQuantity: item.keepQuantity,
    pickupDate: item.pickupDate,
    quantity: item.quantity,
    releaseDate: item.releaseDate,
    reservationDeadline: item.reservationDeadline,
    seriesName: item.seriesName,
    status: item.status,
    storageLocation: item.storageLocation,
    tags: item.tags,
    targetQuantity: item.targetQuantity,
    usageLocation: item.usageLocation,
    variantName: item.variantName,
  };
}

function parseBackup(text: string): BackupPayload {
  const parsed = JSON.parse(text) as Partial<BackupPayload>;
  if (parsed.app !== 'OshiList' || !Array.isArray(parsed.goods)) {
    throw new Error('OshiListのバックアップJSONではありません。');
  }
  return {
    app: 'OshiList',
    version: 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    goods: parsed.goods as Goods[],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    selectedEventId: parsed.selectedEventId || '',
    settings: parsed.settings ?? {
      exchangeEnabled: false,
      groupRandomGoods: false,
      homeCards: [],
      utilityTabs: [],
    },
    profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
    activeProfileId: parsed.activeProfileId || '',
  };
}

export default function DataToolsScreen() {
  const { colors } = useAppTheme();
  const { goods, replaceGoods } = useGoods();
  const { events, replaceEvents, selectedEventId } = useEvents();
  const { activeProfileId, profiles, replaceProfiles } = useProfile();
  const { settings, updateSettings } = useAppSettings();
  const [backupText, setBackupText] = useState('');
  const [lastPath, setLastPath] = useState('');
  const [working, setWorking] = useState(false);

  const payload = useMemo<BackupPayload>(
    () => ({
      app: 'OshiList',
      version: 1,
      exportedAt: new Date().toISOString(),
      goods,
      events,
      selectedEventId,
      settings,
      profiles,
      activeProfileId,
    }),
    [activeProfileId, events, goods, profiles, selectedEventId, settings],
  );

  const exportBackup = async () => {
    try {
      setWorking(true);
      const json = JSON.stringify(payload, null, 2);
      setBackupText(json);
      const fileName = `oshilist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new FileSystem.File(FileSystem.Paths.document, fileName);
      file.write(json);
      setLastPath(file.uri);
      Alert.alert('バックアップを作成しました', '下のJSONを控えるか、表示された保存先からファイルを取り出せます。');
    } catch (error) {
      Alert.alert('バックアップに失敗しました', error instanceof Error ? error.message : '時間をおいて再度お試しください。');
    } finally {
      setWorking(false);
    }
  };

  const confirmRestore = () => {
    Alert.alert('バックアップから復元しますか？', '現在のローカルデータはバックアップ内容で置き換わります。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '復元',
        style: 'destructive',
        onPress: restoreBackup,
      },
    ]);
  };

  const restoreBackup = async () => {
    try {
      setWorking(true);
      const parsed = parseBackup(backupText);
      await replaceGoods(parsed.goods.map(goodsToInput));
      await replaceEvents(parsed.events, parsed.selectedEventId);
      await updateSettings(parsed.settings);
      await replaceProfiles(parsed.profiles, parsed.activeProfileId);
      Alert.alert('復元しました', 'ローカルのグッズ・イベント・設定・推しプロフィールを更新しました。');
    } catch (error) {
      Alert.alert('復元できませんでした', error instanceof Error ? error.message : 'JSONの内容を確認してください。');
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="戻る" onPress={() => router.back()} style={styles.backButton}>
              <Ionicons color={colors.text} name="chevron-back" size={24} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>データツール</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>バックアップと復元</Text>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>現在のデータ</Text>
            <View style={styles.statsRow}>
              <MiniStat label="グッズ" value={`${goods.length}件`} />
              <MiniStat label="イベント" value={`${events.length}件`} />
              <MiniStat label="推し" value={`${profiles.length}人`} />
            </View>
            <Pressable disabled={working} onPress={exportBackup} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Ionicons color="#ffffff" name="download-outline" size={19} />
              <Text style={styles.primaryButtonText}>{working ? '処理中' : 'JSONバックアップを作成'}</Text>
            </Pressable>
            {!!lastPath && <Text selectable style={[styles.pathText, { color: colors.muted }]}>{lastPath}</Text>}
          </View>

          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>復元</Text>
            <Text style={[styles.panelHelp, { color: colors.muted }]}>バックアップJSONを貼り付けて復元します。画像ファイル自体は端末内パスのため、端末移行時は再登録が必要な場合があります。</Text>
            <TextInput
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              value={backupText}
              onChangeText={setBackupText}
              placeholder="ここにバックアップJSONを貼り付け"
              placeholderTextColor={colors.muted}
              style={[styles.textArea, { backgroundColor: colors.input, color: colors.text }]}
            />
            <Pressable disabled={working || !backupText.trim()} onPress={confirmRestore} style={[styles.restoreButton, { backgroundColor: backupText.trim() ? colors.danger : colors.border }]}>
              <Ionicons color="#ffffff" name="refresh-outline" size={19} />
              <Text style={styles.primaryButtonText}>このJSONから復元</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: colors.input }]}>
      <Text style={[styles.miniValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.miniLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboard: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  panelHelp: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  miniStat: { borderRadius: 8, flex: 1, padding: 10 },
  miniValue: { fontSize: 17, fontWeight: '900' },
  miniLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  primaryButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 48, justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  pathText: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 10 },
  textArea: { borderRadius: 8, fontSize: 12, minHeight: 180, padding: 12, textAlignVertical: 'top' },
  restoreButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 48, justifyContent: 'center', marginTop: 12 },
});
