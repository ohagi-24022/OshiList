import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hexToHsl, hslToHex, HslColor, normalizeHex } from '../src/lib/color';
import { useGoods } from '../src/store/GoodsContext';
import { CharacterAccent, ColorRole, useAppTheme } from '../src/store/ThemeContext';

const colorRoles: Array<[ColorRole, string, string]> = [
  ['primary', 'メイン', '主要ボタンや選択中の色'],
  ['secondary', 'アクセント', 'バッジや小さな強調色'],
  ['background', '背景', '画面全体の背景'],
  ['surface', 'カード', 'カードやパネルの背景'],
  ['elevated', '浮いた面', '入力欄周辺や装飾エリア'],
  ['input', '入力欄', '検索欄やフォーム'],
  ['text', '本文', '主要な文字'],
  ['muted', '補助文字', '説明文やメタ情報'],
  ['border', '境界線', 'カードや区切り線'],
  ['success', '成功', '完了や安全な操作'],
  ['danger', '警告', '削除やエラー'],
];

const accentColorOptions = ['#e94f7d', '#f5a400', '#7b61ff', '#00a7b5', '#31c759', '#111111'];
const sliderSteps = Array.from({ length: 24 }, (_, index) => index / 23);

export default function ThemeEditorScreen() {
  const { colors, setCustomColor, saveCurrentAsPreset, upsertCharacterAccent, removeCharacterAccent } = useAppTheme();
  const { goods } = useGoods();
  const [selectedRole, setSelectedRole] = useState<ColorRole>('primary');
  const [presetName, setPresetName] = useState('');
  const [accentSeries, setAccentSeries] = useState('');
  const [accentCharacter, setAccentCharacter] = useState('');
  const [accentColor, setAccentColor] = useState(colors.primary);

  const selectedHex = colors[selectedRole];
  const selectedHsl = useMemo(() => hexToHsl(selectedHex), [selectedHex]);
  const characterAccents = colors.custom ? colors.characterAccents ?? [] : [];
  const canUseCharacterAccents = !!colors.custom;

  useEffect(() => {
    setAccentColor(colors.primary);
  }, [colors.primary]);

  const characterSuggestions = useMemo(() => {
    const pairs = new Map<string, { seriesName: string; characterName: string }>();
    goods.forEach((item) => {
      const seriesName = item.seriesName.trim();
      const characterName = item.characterName.trim();
      if (!seriesName || !characterName || characterName === '未分類') return;
      pairs.set(`${seriesName}::${characterName}`, { seriesName, characterName });
    });
    return Array.from(pairs.values()).sort((a, b) =>
      `${a.seriesName}${a.characterName}`.localeCompare(`${b.seriesName}${b.characterName}`, 'ja'),
    );
  }, [goods]);

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

  const selectSuggestion = (seriesName: string, characterName: string) => {
    setAccentSeries(seriesName);
    setAccentCharacter(characterName);
  };

  const saveCharacterAccent = () => {
    if (!accentSeries.trim() || !accentCharacter.trim()) {
      Alert.alert('シリーズとキャラクターを入力してください', 'キャラクター別カラーはシリーズ名とキャラクター名の組み合わせで保存します。');
      return;
    }
    upsertCharacterAccent({
      seriesName: accentSeries,
      characterName: accentCharacter,
      color: accentColor,
    });
    setAccentCharacter('');
    Alert.alert('追加しました', 'このテーマ内でキャラクター別カラーを反映します。');
  };

  const editCharacterAccent = (accent: CharacterAccent) => {
    setAccentSeries(accent.seriesName);
    setAccentCharacter(accent.characterName);
    setAccentColor(accent.color);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable accessibilityLabel="設定へ戻る" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>テーマデザイン</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>全体配色と、シリーズ内のキャラクター色を調整できます。</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: accentColor || colors.border }]}>
            <View style={[styles.previewImage, { backgroundColor: colors.input }]}>
              <Ionicons color={colors.secondary} name="image-outline" size={26} />
            </View>
            <View style={styles.previewBody}>
              <Text style={[styles.previewGoodsTitle, { color: colors.text }]}>トレーディング缶バッジ</Text>
              <Text style={[styles.previewGoodsMeta, { color: accentColor || colors.muted }]}>
                {accentCharacter.trim() || 'キャラクター'} / ホログラム仕様
              </Text>
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

          <ColorPicker
            colors={colors}
            hex={selectedHex}
            hsl={selectedHsl}
            onHslChange={updateHsl}
            onNudge={nudge}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>キャラクター別カラー</Text>
          <Text style={[styles.panelHelp, { color: colors.muted }]}>
            自作テーマの中だけで、シリーズとキャラクターの組み合わせに色を割り当てます。
          </Text>
          {!canUseCharacterAccents ? (
            <View style={[styles.notice, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons color={colors.primary} name="information-circle-outline" size={19} />
              <Text style={[styles.noticeText, { color: colors.muted }]}>
                まず全体色を編集するか、現在の配色をプリセット保存すると利用できます。
              </Text>
            </View>
          ) : null}

          {!!characterSuggestions.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
              {characterSuggestions.map((item) => (
                <Pressable
                  key={`${item.seriesName}-${item.characterName}`}
                  onPress={() => selectSuggestion(item.seriesName, item.characterName)}
                  style={[styles.suggestionChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
                >
                  <Text numberOfLines={1} style={[styles.suggestionSeries, { color: colors.muted }]}>
                    {item.seriesName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.suggestionName, { color: colors.text }]}>
                    {item.characterName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.formLabel, { color: colors.muted }]}>シリーズ</Text>
          <TextInput
            value={accentSeries}
            onChangeText={setAccentSeries}
            placeholder="作品名・シリーズ名"
            placeholderTextColor={colors.muted}
            style={[styles.nameInput, { backgroundColor: colors.input, color: colors.text }]}
          />
          <Text style={[styles.formLabel, { color: colors.muted }]}>キャラクター</Text>
          <TextInput
            value={accentCharacter}
            onChangeText={setAccentCharacter}
            placeholder="キャラクター名"
            placeholderTextColor={colors.muted}
            style={[styles.nameInput, { backgroundColor: colors.input, color: colors.text }]}
          />
          <View style={styles.accentColorLine}>
            <View style={[styles.selectedChip, { backgroundColor: accentColor, borderColor: colors.border }]} />
            <TextInput
              value={accentColor}
              onChangeText={(value) => setAccentColor(normalizeHex(value))}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.accentHexInput, { backgroundColor: colors.input, color: colors.text }]}
            />
          </View>
          <View style={styles.accentSwatches}>
            {accentColorOptions.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`${color}をキャラクター色に設定`}
                onPress={() => setAccentColor(color)}
                style={[
                  styles.accentSwatch,
                  { backgroundColor: color, borderColor: accentColor.toLowerCase() === color.toLowerCase() ? colors.text : colors.border },
                ]}
              />
            ))}
          </View>
          <ColorPicker
            compact
            colors={colors}
            hex={accentColor}
            hsl={hexToHsl(accentColor)}
            onHslChange={(patch) => setAccentColor(hslToHex({ ...hexToHsl(accentColor), ...patch }))}
            onNudge={(key, amount) => {
              const current = hexToHsl(accentColor);
              const max = key === 'h' ? 360 : 100;
              const next = Math.max(0, Math.min(max, current[key] + amount));
              setAccentColor(hslToHex({ ...current, [key]: next }));
            }}
          />
          <Pressable
            disabled={!canUseCharacterAccents}
            onPress={saveCharacterAccent}
            style={[styles.addAccentButton, { backgroundColor: canUseCharacterAccents ? colors.primary : colors.border }]}
          >
            <Ionicons color="#ffffff" name="color-palette-outline" size={18} />
            <Text style={styles.saveText}>このキャラ色を追加</Text>
          </Pressable>

          {!!characterAccents.length && (
            <View style={styles.accentList}>
              {characterAccents.map((accent) => (
                <View key={accent.id} style={[styles.accentItem, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <View style={[styles.accentItemColor, { backgroundColor: accent.color }]} />
                  <Pressable onPress={() => editCharacterAccent(accent)} style={styles.accentItemText}>
                    <Text numberOfLines={1} style={[styles.accentItemName, { color: colors.text }]}>
                      {accent.characterName}
                    </Text>
                    <Text numberOfLines={1} style={[styles.accentItemSeries, { color: colors.muted }]}>
                      {accent.seriesName}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityLabel={`${accent.characterName}の色を削除`} onPress={() => removeCharacterAccent(accent.id)} style={styles.deleteButton}>
                    <Ionicons color={colors.danger} name="trash-outline" size={18} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
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
            <Text style={styles.saveText}>現在のデザインを保存</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ColorPicker({
  compact = false,
  colors,
  hex,
  hsl,
  onHslChange,
  onNudge,
}: {
  compact?: boolean;
  colors: ReturnType<typeof useAppTheme>['colors'];
  hex: string;
  hsl: HslColor;
  onHslChange: (patch: Partial<HslColor>) => void;
  onNudge: (key: keyof HslColor, amount: number) => void;
}) {
  return (
    <View style={[styles.colorPicker, compact && styles.compactColorPicker]}>
      {!compact ? (
        <View style={[styles.colorPreviewLarge, { backgroundColor: hex, borderColor: colors.border }]}>
          <Text style={[styles.colorPreviewText, { color: hsl.l > 55 ? '#111111' : '#ffffff' }]}>{hex.toUpperCase()}</Text>
        </View>
      ) : null}
      <ColorSlider
        label="色相"
        value={hsl.h}
        max={360}
        colors={colors}
        valueText={`${hsl.h}`}
        getColor={(ratio) => hslToHex({ h: Math.round(ratio * 360), s: 86, l: 54 })}
        onChange={(next) => onHslChange({ h: next })}
        onNudge={(amount) => onNudge('h', amount)}
      />
      <ColorSlider
        label="彩度"
        value={hsl.s}
        max={100}
        colors={colors}
        valueText={`${hsl.s}%`}
        getColor={(ratio) => hslToHex({ ...hsl, s: Math.round(ratio * 100) })}
        onChange={(next) => onHslChange({ s: next })}
        onNudge={(amount) => onNudge('s', amount)}
      />
      <ColorSlider
        label="明度"
        value={hsl.l}
        max={100}
        colors={colors}
        valueText={`${hsl.l}%`}
        getColor={(ratio) => hslToHex({ ...hsl, l: Math.round(ratio * 100) })}
        onChange={(next) => onHslChange({ l: next })}
        onNudge={(amount) => onNudge('l', amount)}
      />
    </View>
  );
}

function ColorSlider({
  label,
  value,
  max,
  colors,
  valueText,
  getColor,
  onChange,
  onNudge,
}: {
  label: string;
  value: number;
  max: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
  valueText: string;
  getColor: (ratio: number) => string;
  onChange: (value: number) => void;
  onNudge: (amount: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const ratio = Math.max(0, Math.min(1, value / max));
  const updateFromEvent = (event: GestureResponderEvent) => {
    const nextRatio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    onChange(Math.round(nextRatio * max));
  };

  return (
    <View style={styles.sliderBlock}>
      <PickerHeader label={label} value={valueText} colors={colors} onMinus={() => onNudge(max === 360 ? -5 : -2)} onPlus={() => onNudge(max === 360 ? 5 : 2)} />
      <View
        onLayout={(event: LayoutChangeEvent) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateFromEvent}
        onResponderMove={updateFromEvent}
        style={[styles.sliderTrack, { borderColor: colors.border }]}
      >
        {sliderSteps.map((step) => (
          <View key={`${label}-${step}`} style={[styles.sliderSegment, { backgroundColor: getColor(step) }]} />
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            {
              backgroundColor: getColor(ratio),
              borderColor: colors.text,
              left: `${ratio * 100}%`,
            },
          ]}
        />
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
  previewGoodsMeta: { fontSize: 12, fontWeight: '800', marginTop: 5 },
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
  colorPicker: { gap: 14, marginTop: 14 },
  compactColorPicker: { gap: 12, marginTop: 12 },
  colorPreviewLarge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
  },
  colorPreviewText: { fontSize: 18, fontWeight: '900' },
  sliderBlock: { gap: 8 },
  sliderTrack: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    height: 34,
    overflow: 'visible',
    position: 'relative',
  },
  sliderSegment: { flex: 1 },
  sliderThumb: {
    borderRadius: 999,
    borderWidth: 3,
    height: 42,
    marginLeft: -21,
    position: 'absolute',
    top: -5,
    width: 42,
  },
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
  notice: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 10,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  suggestionRow: { gap: 8, paddingTop: 12 },
  suggestionChip: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 12,
    width: 148,
  },
  suggestionSeries: { fontSize: 10, fontWeight: '800' },
  suggestionName: { fontSize: 13, fontWeight: '900', marginTop: 3 },
  formLabel: { fontSize: 12, fontWeight: '800', marginBottom: 7, marginTop: 12 },
  nameInput: { borderRadius: 8, fontSize: 15, height: 44, marginTop: 12, paddingHorizontal: 12 },
  accentColorLine: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 12 },
  accentHexInput: { borderRadius: 8, flex: 1, fontSize: 15, height: 46, paddingHorizontal: 12 },
  accentSwatches: { flexDirection: 'row', gap: 9, marginTop: 10 },
  accentSwatch: { borderRadius: 999, borderWidth: 3, height: 36, width: 36 },
  addAccentButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 12,
  },
  accentList: { gap: 8, marginTop: 14 },
  accentItem: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
  },
  accentItemColor: { borderRadius: 999, height: 28, width: 28 },
  accentItemText: { flex: 1, justifyContent: 'center', minHeight: 58 },
  accentItemName: { fontSize: 14, fontWeight: '900' },
  accentItemSeries: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  deleteButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
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
