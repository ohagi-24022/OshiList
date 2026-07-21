import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hexToHsl, hslToHex, HslColor, normalizeHex } from '../src/lib/color';
import { ColorRole, useAppTheme } from '../src/store/ThemeContext';

const colorRoles: Array<[ColorRole, string, string]> = [
  ['primary', 'メイン', '主要ボタンや選択中の色'],
  ['secondary', 'アクセント', 'バッジや小さな強調色'],
  ['background', '背景', '画面全体の背景'],
  ['surface', 'カード', 'カードやパネルの背景'],
  ['elevated', '淡い面', '入力周辺や補助エリア'],
  ['input', '入力欄', '検索欄やフォーム'],
  ['text', '本文', '主要な文字'],
  ['muted', '補助文字', '説明文やメタ情報'],
  ['border', '境界線', 'カードや区切り線'],
  ['success', '成功', '完了や安全な操作'],
  ['danger', '警告', '削除やエラー'],
];

const hueStops = [0, 30, 60, 120, 200, 270, 320];
const percentStops = [0, 25, 50, 75, 100];

export default function ThemeEditorScreen() {
  const { colors, setCustomColor, saveCurrentAsPreset } = useAppTheme();
  const [selectedRole, setSelectedRole] = useState<ColorRole>('primary');
  const [presetName, setPresetName] = useState('');

  const selectedHex = colors[selectedRole];
  const selectedHsl = useMemo(() => hexToHsl(selectedHex), [selectedHex]);

  const updateHsl = (patch: Partial<HslColor>) => {
    setCustomColor(selectedRole, hslToHex({ ...selectedHsl, ...patch }));
  };

  const nudge = (key: keyof HslColor, amount: number) => {
    const max = key === 'h' ? 360 : 100;
    const min = 0;
    const next = Math.max(min, Math.min(max, selectedHsl[key] + amount));
    updateHsl({ [key]: next } as Partial<HslColor>);
  };

  const savePreset = async () => {
    await saveCurrentAsPreset(presetName);
    Alert.alert('保存しました', '設定タブのテーマプリセットに追加しました。');
    setPresetName('');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>テーマデザイン</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>大きなボタンで色を調整できます。</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.previewPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.previewHeader, { backgroundColor: colors.elevated }]}>
            <View>
              <Text style={[styles.previewTitle, { color: colors.text }]}>OshiList</Text>
              <Text style={[styles.previewMeta, { color: colors.muted }]}>プレビュー / 12種類</Text>
            </View>
            <View style={[styles.previewBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.previewBadgeText}>所持</Text>
            </View>
          </View>
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.previewImage, { backgroundColor: colors.input }]}>
              <Ionicons color={colors.secondary} name="image-outline" size={26} />
            </View>
            <View style={styles.previewBody}>
              <Text style={[styles.previewGoodsTitle, { color: colors.text }]}>トレーディング缶バッジ</Text>
              <Text style={[styles.previewGoodsMeta, { color: colors.muted }]}>酒寄彩葉 / ホログラム仕様</Text>
              <View style={[styles.previewCounter, { backgroundColor: colors.elevated }]}>
                <Text style={[styles.previewCounterText, { color: colors.text }]}>- 2 +</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>編集する色</Text>
          <View style={styles.roleGrid}>
            {colorRoles.map(([role, label]) => {
              const active = selectedRole === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => setSelectedRole(role)}
                  style={[
                    styles.roleButton,
                    { borderColor: active ? colors.text : colors.border, backgroundColor: active ? colors.elevated : colors.surface },
                  ]}
                >
                  <View style={[styles.roleChip, { backgroundColor: colors[role], borderColor: colors.border }]} />
                  <Text style={[styles.roleText, { color: colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.selectedHeader}>
            <View style={[styles.selectedChip, { backgroundColor: selectedHex, borderColor: colors.border }]} />
            <View style={styles.selectedTextBlock}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>
                {colorRoles.find(([role]) => role === selectedRole)?.[1]}
              </Text>
              <Text style={[styles.panelHelp, { color: colors.muted }]}>
                {colorRoles.find(([role]) => role === selectedRole)?.[2]}
              </Text>
            </View>
          </View>

          <TextInput
            value={selectedHex}
            onChangeText={(value) => setCustomColor(selectedRole, normalizeHex(value))}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.hexInput, { backgroundColor: colors.input, color: colors.text }]}
          />

          <HuePicker
            value={selectedHsl.h}
            colors={colors}
            onSelect={(next) => updateHsl({ h: next })}
            onNudge={(amount) => nudge('h', amount)}
          />
          <PercentPicker
            label="彩度"
            value={selectedHsl.s}
            colors={colors}
            getColor={(next) => hslToHex({ ...selectedHsl, s: next })}
            onSelect={(next) => updateHsl({ s: next })}
            onNudge={(amount) => nudge('s', amount)}
          />
          <PercentPicker
            label="明度"
            value={selectedHsl.l}
            colors={colors}
            getColor={(next) => hslToHex({ ...selectedHsl, l: next })}
            onSelect={(next) => updateHsl({ l: next })}
            onNudge={(amount) => nudge('l', amount)}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>プリセットに保存</Text>
          <TextInput
            value={presetName}
            onChangeText={setPresetName}
            placeholder="例: 彩葉ライブ用"
            placeholderTextColor={colors.muted}
            style={[styles.nameInput, { backgroundColor: colors.input, color: colors.text }]}
          />
          <Pressable onPress={savePreset} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="bookmark-outline" size={18} />
            <Text style={styles.saveText}>現在の配色を保存</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HuePicker({
  value,
  colors,
  onSelect,
  onNudge,
}: {
  value: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onSelect: (value: number) => void;
  onNudge: (amount: number) => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <PickerHeader label="色相" value={`${value}`} colors={colors} onMinus={() => onNudge(-10)} onPlus={() => onNudge(10)} />
      <View style={styles.largeGrid}>
        {hueStops.map((hue) => (
          <Pressable
            key={hue}
            onPress={() => onSelect(hue)}
            style={[
              styles.hueButton,
              {
                backgroundColor: hslToHex({ h: hue, s: 82, l: 54 }),
                borderColor: Math.abs(hue - value) <= 12 ? colors.text : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function PercentPicker({
  label,
  value,
  colors,
  getColor,
  onSelect,
  onNudge,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
  getColor: (value: number) => string;
  onSelect: (value: number) => void;
  onNudge: (amount: number) => void;
}) {
  const closest = percentStops.reduce((best, next) => (Math.abs(next - value) < Math.abs(best - value) ? next : best), 0);

  return (
    <View style={styles.pickerBlock}>
      <PickerHeader label={label} value={`${value}%`} colors={colors} onMinus={() => onNudge(-5)} onPlus={() => onNudge(5)} />
      <View style={styles.percentRow}>
        {percentStops.map((stop) => (
          <Pressable
            key={`${label}-${stop}`}
            onPress={() => onSelect(stop)}
            style={[
              styles.percentButton,
              {
                backgroundColor: getColor(stop),
                borderColor: stop === closest ? colors.text : colors.border,
              },
            ]}
          >
            <Text style={[styles.percentText, { color: stop >= 50 ? '#ffffff' : '#111111' }]}>{stop}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PickerHeader({
  label,
  value,
  colors,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.pickerHeader}>
      <View>
        <Text style={[styles.pickerLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.pickerValue, { color: colors.muted }]}>{value}</Text>
      </View>
      <View style={styles.nudgeRow}>
        <Pressable onPress={onMinus} style={[styles.nudgeButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Ionicons color={colors.text} name="remove" size={18} />
        </Pressable>
        <Pressable onPress={onPlus} style={[styles.nudgeButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Ionicons color={colors.text} name="add" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitleBlock: { flex: 1 },
  title: { fontSize: 23, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  content: { gap: 14, padding: 18, paddingBottom: 36 },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  panelHelp: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  previewPanel: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  previewHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  previewTitle: { fontSize: 19, fontWeight: '900' },
  previewMeta: { fontSize: 12, marginTop: 2 },
  previewBadge: { alignItems: 'center', borderRadius: 999, height: 30, justifyContent: 'center', paddingHorizontal: 12 },
  previewBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  previewCard: { borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, margin: 12, padding: 10 },
  previewImage: { alignItems: 'center', borderRadius: 6, height: 74, justifyContent: 'center', width: 56 },
  previewBody: { flex: 1 },
  previewGoodsTitle: { fontSize: 14, fontWeight: '900' },
  previewGoodsMeta: { fontSize: 12, marginTop: 5 },
  previewCounter: { alignItems: 'center', borderRadius: 8, height: 28, justifyContent: 'center', marginTop: 10, width: 82 },
  previewCounterText: { fontSize: 13, fontWeight: '900' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  roleButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  roleChip: { borderRadius: 999, borderWidth: 1, height: 20, width: 20 },
  roleText: { flex: 1, fontSize: 13, fontWeight: '800' },
  selectedHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  selectedChip: { borderRadius: 8, borderWidth: 1, height: 52, width: 52 },
  selectedTextBlock: { flex: 1 },
  hexInput: { borderRadius: 8, fontSize: 16, height: 46, marginTop: 14, paddingHorizontal: 12 },
  pickerBlock: { marginTop: 18 },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pickerLabel: { fontSize: 14, fontWeight: '900' },
  pickerValue: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  nudgeRow: { flexDirection: 'row', gap: 8 },
  nudgeButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 52,
  },
  largeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hueButton: { borderRadius: 8, borderWidth: 3, height: 50, width: 50 },
  percentRow: { flexDirection: 'row', gap: 8 },
  percentButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 3,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  percentText: { fontSize: 13, fontWeight: '900' },
  nameInput: { borderRadius: 8, fontSize: 15, height: 44, marginTop: 12, paddingHorizontal: 12 },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 12,
  },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
