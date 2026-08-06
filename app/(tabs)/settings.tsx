import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import { useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoods } from '../../src/store/GoodsContext';
import { useAppSettings } from '../../src/store/AppSettingsContext';
import { ThemePreset, useAppTheme } from '../../src/store/ThemeContext';

export default function SettingsScreen() {
  const { colors, presets, setPreset, customPresets, deleteCustomPreset } = useAppTheme();
  const { settings, updateSettings } = useAppSettings();
  const { goods } = useGoods();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const confirmDeletePreset = (preset: ThemePreset) => {
    if (!preset.custom) return;

    Alert.alert('テーマを削除しますか？', `「${preset.name}」をプリセットから削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => deleteCustomPreset(preset.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>設定</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            テーマのプリセット選択や、自分好みの配色編集ができます。
          </Text>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>プロフィール</Text>
          <View style={[styles.profileRow, { backgroundColor: colors.elevated }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Ionicons color="#ffffff" name="heart" size={22} />
            </View>
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: colors.text }]}>推しグッズ棚</Text>
              <Text style={[styles.profileMeta, { color: colors.muted }]}>{goods.length}種類をローカル保存中</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/theme-editor')}
          style={[styles.designButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons color="#ffffff" name="color-wand-outline" size={20} />
          <Text style={styles.designButtonText}>自分でデザインする</Text>
          <Ionicons color="#ffffff" name="chevron-forward" size={18} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/help')}
          style={[styles.helpButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.helpIcon, { backgroundColor: colors.elevated }]}>
            <Ionicons color={colors.primary} name="help-circle-outline" size={24} />
          </View>
          <View style={styles.helpText}>
            <Text style={[styles.helpTitle, { color: colors.text }]}>ヘルプ</Text>
            <Text style={[styles.helpBody, { color: colors.muted }]}>登録方法や写真登録α、未整理の整理方法を確認できます。</Text>
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={18} />
        </Pressable>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>交換管理</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.exchangeEnabled }}
            onPress={() => updateSettings({ exchangeEnabled: !settings.exchangeEnabled })}
            style={[styles.settingRow, { backgroundColor: colors.elevated }]}
          >
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>交換可能グッズを表示</Text>
              <Text style={[styles.settingHelp, { color: colors.muted }]}>
                所持数が2個以上のグッズをホームに交換候補として表示します。
              </Text>
            </View>
            <View style={[styles.switchTrack, { backgroundColor: settings.exchangeEnabled ? colors.primary : colors.border }]}>
              <View
                style={[
                  styles.switchThumb,
                  { backgroundColor: colors.surface, transform: [{ translateX: settings.exchangeEnabled ? 20 : 0 }] },
                ]}
              />
            </View>
          </Pressable>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>コレクション表示</Text>
          <View style={[styles.inlineSettingBox, { backgroundColor: colors.elevated }]}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.groupRandomGoods }}
              onPress={() => updateSettings({ groupRandomGoods: !settings.groupRandomGoods })}
              style={styles.inlineSettingRow}
            >
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>ランダムグッズをまとめて表示</Text>
                <Text style={[styles.settingHelp, { color: colors.muted }]}>
                  コレクションタブでは同じ親商品のランダムグッズを1つにまとめ、タップで内訳を確認できます。
                </Text>
              </View>
              <View style={[styles.switchTrack, { backgroundColor: settings.groupRandomGoods ? colors.primary : colors.border }]}>
                <View
                  style={[
                    styles.switchThumb,
                    { backgroundColor: colors.surface, transform: [{ translateX: settings.groupRandomGoods ? 20 : 0 }] },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>テーマプリセット</Text>
          {!!customPresets.length && (
            <Text style={[styles.panelHelp, { color: colors.muted }]}>
              保存したテーマは右上の削除ボタンから消せます。標準テーマは削除できません。
            </Text>
          )}
          <View style={styles.presetGrid}>
            {presets.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => setPreset(preset)}
                style={[styles.preset, { borderColor: colors.border, backgroundColor: preset.background }]}
              >
                {preset.custom ? (
                  <Pressable
                    accessibilityLabel={`${preset.name}を削除`}
                    onPress={(event) => {
                      event.stopPropagation();
                      confirmDeletePreset(preset);
                    }}
                    style={[styles.deleteButton, { backgroundColor: preset.surface, borderColor: preset.border }]}
                  >
                    <Ionicons color={preset.danger} name="trash-outline" size={16} />
                  </Pressable>
                ) : null}
                <View style={styles.presetSwatches}>
                  <View style={[styles.swatch, { backgroundColor: preset.primary }]} />
                  <View style={[styles.swatch, { backgroundColor: preset.secondary }]} />
                  <View style={[styles.swatch, { backgroundColor: preset.elevated }]} />
                </View>
                <Text style={[styles.presetText, { color: preset.text }]} numberOfLines={1}>
                  {preset.name}
                </Text>
                {preset.custom ? <Text style={[styles.customBadge, { color: preset.muted }]}>保存済み</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>データ管理</Text>
          <View style={styles.dataRow}>
            <Ionicons color={colors.muted} name="phone-portrait-outline" size={20} />
            <Text style={[styles.dataText, { color: colors.muted }]}>
              コレクションはexpo-sqliteに保存され、電波のない場所でも閲覧と数量変更ができます。
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 96 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  panelHelp: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  profileRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 12, padding: 12 },
  avatar: { alignItems: 'center', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  profileText: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '900' },
  profileMeta: { fontSize: 12, marginTop: 3 },
  designButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  designButtonText: { color: '#ffffff', flex: 1, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  helpButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    padding: 12,
  },
  helpIcon: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  helpText: { flex: 1 },
  helpTitle: { fontSize: 16, fontWeight: '900' },
  helpBody: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: {
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    gap: 7,
    justifyContent: 'center',
    minHeight: 84,
    paddingHorizontal: 10,
    position: 'relative',
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 30,
    zIndex: 2,
  },
  presetSwatches: { flexDirection: 'row', gap: 5 },
  swatch: { borderRadius: 999, height: 16, width: 16 },
  presetText: { fontSize: 13, fontWeight: '800', paddingRight: 26 },
  customBadge: { fontSize: 10, fontWeight: '800' },
  dataRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  dataText: { flex: 1, fontSize: 13, lineHeight: 19 },
  settingRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    padding: 12,
  },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '900' },
  settingHelp: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  inlineSettingBox: { borderRadius: 8, marginBottom: 12 },
  inlineSettingRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    padding: 12,
  },
  switchTrack: {
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 56,
  },
  switchThumb: {
    borderRadius: 999,
    height: 24,
    width: 24,
  },
});
