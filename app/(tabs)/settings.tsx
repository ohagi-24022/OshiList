import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoods } from '../../src/store/GoodsContext';
import { ThemePreset, useAppTheme } from '../../src/store/ThemeContext';

export default function SettingsScreen() {
  const { colors, presets, setPreset, customPresets, deleteCustomPreset } = useAppTheme();
  const { goods } = useGoods();

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
      <ScrollView contentContainerStyle={styles.content}>
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
});
