import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoodsImageField } from '../../src/components/GoodsImageField';
import { searchProductsByName } from '../../src/lib/productLookup';
import { useGoods } from '../../src/store/GoodsContext';
import { useProfile } from '../../src/store/ProfileContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { ProductSearchCandidate } from '../../src/types';

const markIconOptions: Array<[keyof typeof Ionicons.glyphMap, string]> = [
  ['heart', 'ハート'],
  ['star', '星'],
  ['sparkles', 'きらめき'],
  ['diamond', 'ダイヤ'],
  ['ribbon', 'リボン'],
  ['happy', '笑顔'],
];

const markColorOptions = ['#e94f7d', '#f5a400', '#7b61ff', '#00a7b5', '#31c759', '#111111'];

export default function MyPageScreen() {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const { profile, updateProfile } = useProfile();
  const [oshiName, setOshiName] = useState(profile.oshiName);
  const [seriesName, setSeriesName] = useState(profile.seriesName);
  const [imageUrl, setImageUrl] = useState(profile.imageUrl ?? '');
  const [note, setNote] = useState(profile.note);
  const [markIcon, setMarkIcon] = useState<keyof typeof Ionicons.glyphMap>(
    (profile.markIcon || 'heart') as keyof typeof Ionicons.glyphMap,
  );
  const [markColor, setMarkColor] = useState(profile.markColor ?? colors.primary);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ProductSearchCandidate[]>([]);

  useEffect(() => {
    setOshiName(profile.oshiName);
    setSeriesName(profile.seriesName);
    setImageUrl(profile.imageUrl ?? '');
    setNote(profile.note);
    setMarkIcon((profile.markIcon || 'heart') as keyof typeof Ionicons.glyphMap);
    setMarkColor(profile.markColor ?? colors.primary);
  }, [colors.primary, profile]);

  const ownedForOshi = useMemo(() => {
    const targetName = oshiName.trim() || profile.oshiName.trim();
    const targetSeries = seriesName.trim() || profile.seriesName.trim();
    if (!targetName) return [];
    return goods.filter((item) => {
      const characterMatches = item.characterName === targetName;
      const seriesMatches = !targetSeries || item.seriesName === targetSeries;
      return characterMatches && seriesMatches && item.status === 'owned';
    });
  }, [goods, oshiName, profile.oshiName, profile.seriesName, seriesName]);

  const localImageCandidates = useMemo(
    () =>
      ownedForOshi
        .filter((item) => !!item.imageUrl)
        .map((item) => ({
          boxName: item.boxName,
          imageUrl: item.imageUrl,
          sourceLabel: '登録済みグッズ',
        })),
    [ownedForOshi],
  );

  const fetchImageCandidates = async () => {
    const name = oshiName.trim();
    if (!name) {
      Alert.alert('推し名を入力してください', '画像候補を探すにはキャラクター名が必要です。');
      return;
    }

    setLoadingImage(true);
    try {
      const query = [seriesName.trim(), name, 'グッズ'].filter(Boolean).join(' ');
      const candidates = await searchProductsByName(query, 8);
      const withImages = candidates.filter((candidate) => !!candidate.imageUrl);
      setImageCandidates(withImages);
      if (!imageUrl && withImages[0]?.imageUrl) {
        setImageUrl(withImages[0].imageUrl);
      }
      if (!withImages.length) {
        Alert.alert('画像候補が見つかりませんでした', '登録済みグッズ画像または手動の画像設定を利用してください。');
      }
    } catch (error) {
      Alert.alert('画像候補を取得できませんでした', error instanceof Error ? error.message : 'もう一度お試しください。');
    } finally {
      setLoadingImage(false);
    }
  };

  const save = async () => {
    await updateProfile({
      oshiName: oshiName.trim(),
      seriesName: seriesName.trim(),
      imageUrl: imageUrl.trim() || null,
      note: note.trim(),
      markIcon,
      markColor: markColor.trim() || null,
    });
    Alert.alert('保存しました', 'マイページに推し設定を反映しました。');
  };

  const allCandidates = [...localImageCandidates, ...imageCandidates];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>マイページ</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>推しプロフィール、画像、推しマークを設定できます。</Text>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroImage, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            {imageUrl.trim() ? (
              <Image source={{ uri: imageUrl.trim() }} style={styles.heroImageInner} />
            ) : (
              <Ionicons color={colors.muted} name="person-circle-outline" size={54} />
            )}
            <View style={[styles.heroMark, { backgroundColor: markColor }]}>
              <Ionicons color="#ffffff" name={markIcon} size={14} />
            </View>
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
              {oshiName.trim() || '推し未設定'}
            </Text>
            <Text style={[styles.heroMeta, { color: colors.muted }]} numberOfLines={1}>
              {seriesName.trim() || 'シリーズ未設定'}
            </Text>
            <Text style={[styles.heroCount, { color: markColor }]}>{ownedForOshi.length}種類の所持グッズ</Text>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>推し設定</Text>

          <Text style={[styles.label, { color: colors.muted }]}>推し名</Text>
          <TextInput
            value={oshiName}
            onChangeText={setOshiName}
            placeholder="キャラクター名"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
          />

          <Text style={[styles.label, { color: colors.muted }]}>シリーズ</Text>
          <TextInput
            value={seriesName}
            onChangeText={setSeriesName}
            placeholder="作品名・シリーズ名"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
          />

          <Text style={[styles.label, { color: colors.muted }]}>画像</Text>
          <GoodsImageField value={imageUrl} onChange={setImageUrl} />

          <Pressable
            disabled={loadingImage}
            onPress={fetchImageCandidates}
            style={[styles.fetchButton, { backgroundColor: loadingImage ? colors.border : colors.primary }]}
          >
            {loadingImage ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons color="#ffffff" name="sparkles-outline" size={18} />}
            <Text style={styles.fetchButtonText}>推し画像候補を取得</Text>
          </Pressable>

          {!!allCandidates.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidateRow}>
              {allCandidates.map((candidate, index) => (
                <Pressable
                  key={`${candidate.sourceLabel}-${candidate.boxName}-${index}`}
                  onPress={() => candidate.imageUrl && setImageUrl(candidate.imageUrl)}
                  style={[styles.imageCandidate, { borderColor: colors.border, backgroundColor: colors.elevated }]}
                >
                  {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={styles.imageCandidateInner} /> : null}
                  <Text numberOfLines={1} style={[styles.candidateLabel, { color: colors.muted }]}>
                    {candidate.sourceLabel}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.label, { color: colors.muted }]}>推しマーク</Text>
          <View style={styles.markPreviewRow}>
            <View style={[styles.markPreview, { backgroundColor: markColor }]}>
              <Ionicons color="#ffffff" name={markIcon} size={20} />
              <Text style={styles.markPreviewText}>推し</Text>
            </View>
            <TextInput
              value={markColor}
              onChangeText={setMarkColor}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="#e94f7d"
              placeholderTextColor={colors.muted}
              style={[styles.markColorInput, { backgroundColor: colors.input, color: colors.text }]}
            />
          </View>

          <View style={styles.markIconGrid}>
            {markIconOptions.map(([icon, label]) => {
              const active = markIcon === icon;
              return (
                <Pressable
                  key={icon}
                  onPress={() => setMarkIcon(icon)}
                  style={[
                    styles.markIconButton,
                    { borderColor: active ? markColor : colors.border, backgroundColor: active ? colors.elevated : colors.surface },
                  ]}
                >
                  <Ionicons color={active ? markColor : colors.text} name={icon} size={20} />
                  <Text style={[styles.markIconText, { color: colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.markColorRow}>
            {markColorOptions.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`${color}を推しマーク色に設定`}
                onPress={() => setMarkColor(color)}
                style={[
                  styles.markColorChip,
                  { backgroundColor: color, borderColor: markColor.toLowerCase() === color.toLowerCase() ? colors.text : colors.border },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>メモ</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="好きな衣装、集めたいグッズなど"
            placeholderTextColor={colors.muted}
            style={[styles.noteInput, { backgroundColor: colors.input, color: colors.text }]}
          />

          <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="save-outline" size={18} />
            <Text style={styles.saveText}>保存</Text>
          </Pressable>
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
  hero: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  heroImage: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 88,
  },
  heroImageInner: { height: '100%', width: '100%' },
  heroMark: {
    alignItems: 'center',
    borderRadius: 999,
    bottom: 6,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    width: 30,
  },
  heroText: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: '900' },
  heroMeta: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  heroCount: { fontSize: 12, fontWeight: '900', marginTop: 7 },
  panel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: {
    borderRadius: 8,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  fetchButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
    marginTop: 12,
  },
  fetchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  candidateRow: { gap: 10, paddingTop: 12 },
  imageCandidate: {
    borderRadius: 8,
    borderWidth: 1,
    height: 94,
    overflow: 'hidden',
    width: 78,
  },
  imageCandidateInner: { height: 68, width: '100%' },
  candidateLabel: { fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingTop: 5 },
  markPreviewRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  markPreview: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 13,
  },
  markPreviewText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  markColorInput: {
    borderRadius: 8,
    flex: 1,
    fontSize: 15,
    height: 42,
    paddingHorizontal: 12,
  },
  markIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  markIconButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    gap: 5,
    height: 58,
    justifyContent: 'center',
  },
  markIconText: { fontSize: 11, fontWeight: '800' },
  markColorRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  markColorChip: {
    borderRadius: 999,
    borderWidth: 3,
    height: 34,
    width: 34,
  },
  noteInput: {
    borderRadius: 8,
    fontSize: 15,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
