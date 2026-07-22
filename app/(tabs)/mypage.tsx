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

export default function MyPageScreen() {
  const { colors } = useAppTheme();
  const { goods } = useGoods();
  const { profile, updateProfile } = useProfile();
  const [oshiName, setOshiName] = useState(profile.oshiName);
  const [seriesName, setSeriesName] = useState(profile.seriesName);
  const [imageUrl, setImageUrl] = useState(profile.imageUrl ?? '');
  const [note, setNote] = useState(profile.note);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ProductSearchCandidate[]>([]);

  useEffect(() => {
    setOshiName(profile.oshiName);
    setSeriesName(profile.seriesName);
    setImageUrl(profile.imageUrl ?? '');
    setNote(profile.note);
  }, [profile]);

  const ownedForOshi = useMemo(() => {
    const targetName = oshiName.trim() || profile.oshiName.trim();
    if (!targetName) return [];
    return goods.filter((item) => item.characterName === targetName && item.status === 'owned');
  }, [goods, oshiName, profile.oshiName]);

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
    });
    Alert.alert('保存しました', 'マイページに推し設定を反映しました。');
  };

  const allCandidates = [...localImageCandidates, ...imageCandidates];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>マイページ</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>推しプロフィールと画像を設定できます。</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroImage, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            {imageUrl.trim() ? (
              <Image source={{ uri: imageUrl.trim() }} style={styles.heroImageInner} />
            ) : (
              <Ionicons color={colors.muted} name="person-circle-outline" size={54} />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
              {oshiName.trim() || '推し未設定'}
            </Text>
            <Text style={[styles.heroMeta, { color: colors.muted }]} numberOfLines={1}>
              {seriesName.trim() || 'シリーズ未設定'}
            </Text>
            <Text style={[styles.heroCount, { color: colors.primary }]}>{ownedForOshi.length}種類の所持グッズ</Text>
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
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
    width: 88,
  },
  heroImageInner: { height: '100%', width: '100%' },
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
