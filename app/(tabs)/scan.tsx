import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManualGoodsForm } from '../../src/components/ManualGoodsForm';
import { lookupProductByJan } from '../../src/lib/productLookup';
import { useGoods } from '../../src/store/GoodsContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { ProductLookupResult } from '../../src/types';

export default function ScanScreen() {
  const { colors } = useAppTheme();
  const { addGoods } = useGoods();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manualJan, setManualJan] = useState('');
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductLookupResult | null>(null);

  const resolveJan = async (janCode: string) => {
    if (!janCode.trim() || loading) return;
    setScanning(false);
    setLoading(true);
    try {
      const product = await lookupProductByJan(janCode);
      setManualJan(product.janCode);
      setResult(product);
    } catch (error) {
      Alert.alert(
        '手動登録に切り替えます',
        error instanceof Error ? error.message : '商品情報を取得できませんでした。',
      );
      setManualJan(janCode.trim());
    } finally {
      setLoading(false);
      setTimeout(() => setScanning(true), 1200);
    }
  };

  const cameraReady = Platform.OS !== 'web' && permission?.granted;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>スキャン登録</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            JANコードから商品情報と画像、ラインナップ候補を取得します。
          </Text>
        </View>

        <View style={[styles.notice, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
          <Text style={[styles.noticeText, { color: colors.muted }]}>
            カメラはバーコード読取のみに使用します。写真や映像は保存しません。
          </Text>
        </View>

        <View style={[styles.cameraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {cameraReady ? (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              enableTorch={torch}
              onBarcodeScanned={scanning ? ({ data }) => resolveJan(data) : undefined}
              style={styles.camera}
            >
              <View style={[styles.guide, { borderColor: colors.primary }]} />
            </CameraView>
          ) : (
            <View style={[styles.cameraFallback, { backgroundColor: colors.elevated }]}>
              <Ionicons color={colors.muted} name="barcode-outline" size={46} />
              <Text style={[styles.fallbackTitle, { color: colors.text }]}>カメラを準備します</Text>
              <Text style={[styles.fallbackText, { color: colors.muted }]}>
                許可するとJANコードを読み取れます。許可しない場合も下の入力欄から登録できます。
              </Text>
              {!permission?.granted && Platform.OS !== 'web' && (
                <Pressable onPress={requestPermission} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.primaryButtonText}>カメラを許可する</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.scanActions}>
          <Pressable
            onPress={() => setTorch((value) => !value)}
            style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons color={colors.text} name={torch ? 'flash' : 'flash-outline'} size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>ライト</Text>
          </Pressable>
          <Pressable
            onPress={() => setManualJan('')}
            style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons color={colors.text} name="create-outline" size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>手動登録</Text>
          </Pressable>
        </View>

        <View style={[styles.lookupBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>JANコードを入力</Text>
          <View style={styles.lookupRow}>
            <TextInput
              value={manualJan}
              onChangeText={setManualJan}
              keyboardType="number-pad"
              placeholder="4900000000000"
              placeholderTextColor={colors.muted}
              style={[styles.janInput, { backgroundColor: colors.input, color: colors.text }]}
            />
            <Pressable
              disabled={loading}
              onPress={() => resolveJan(manualJan)}
              style={[styles.lookupButton, { backgroundColor: loading ? colors.border : colors.primary }]}
            >
              <Ionicons color="#ffffff" name="search" size={18} />
            </Pressable>
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>
            実商品を取得するには `EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL` にバックエンドURLを設定してください。
          </Text>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>完全手動登録</Text>
          <ManualGoodsForm initialJanCode={manualJan || null} onSubmit={addGoods} />
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={!!result} onRequestClose={() => setResult(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBlock}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>取得した商品情報</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.muted }]} numberOfLines={1}>
                  {result?.sourceLabel} / JAN: {result?.janCode}
                </Text>
              </View>
              <Pressable onPress={() => setResult(null)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>

            {!!result && (
              <>
                <View style={[styles.productPreview, { backgroundColor: colors.elevated }]}>
                  <View style={[styles.productImage, { borderColor: colors.border }]}>
                    {result.imageUrl ? <Image source={{ uri: result.imageUrl }} style={styles.productImageInner} /> : null}
                  </View>
                  <View style={styles.productText}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                      {result.boxName}
                    </Text>
                    <Text style={[styles.productMeta, { color: colors.muted }]}>
                      {result.lineup.length ? `${result.lineup.length}件の候補` : '候補なし'}
                    </Text>
                  </View>
                </View>
                {!!result.warnings?.length && (
                  <View style={[styles.warningBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    {result.warnings.map((warning) => (
                      <Text key={warning} style={[styles.warningText, { color: colors.muted }]}>
                        {warning}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}

            <ScrollView style={styles.candidateList}>
              {!!result && result.lineup.length > 0 ? (
                result.lineup.map((candidate) => (
                  <Pressable
                    key={`${candidate.characterName}-${candidate.variantName}`}
                    onPress={async () => {
                      await addGoods({
                        janCode: result.janCode,
                        boxName: result.boxName,
                        characterName: candidate.characterName,
                        variantName: candidate.variantName,
                        imageUrl: result.imageUrl,
                      });
                      setResult(null);
                    }}
                    style={[styles.candidate, { borderColor: colors.border }]}
                  >
                    <View>
                      <Text style={[styles.candidateName, { color: colors.text }]}>{candidate.characterName}</Text>
                      <Text style={[styles.candidateVariant, { color: colors.muted }]}>{candidate.variantName}</Text>
                    </View>
                    <Ionicons color={colors.primary} name="add-circle-outline" size={24} />
                  </Pressable>
                ))
              ) : (
                !!result && (
                  <ManualGoodsForm
                    initialJanCode={result.janCode}
                    initialBoxName={result.boxName}
                    initialImageUrl={result.imageUrl}
                    onSubmit={async (input) => {
                      await addGoods(input);
                      setResult(null);
                    }}
                  />
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 18, paddingBottom: 96 },
  titleBlock: { gap: 3 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  notice: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  cameraCard: { borderRadius: 8, borderWidth: 1, height: 260, overflow: 'hidden' },
  camera: { flex: 1 },
  guide: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 3,
    height: 96,
    marginTop: 82,
    width: '76%',
  },
  cameraFallback: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 22 },
  fallbackTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  fallbackText: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  scanActions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '800' },
  lookupBox: { borderRadius: 8, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  lookupRow: { flexDirection: 'row', gap: 10 },
  janInput: { borderRadius: 8, flex: 1, fontSize: 15, height: 44, paddingHorizontal: 12 },
  lookupButton: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', width: 48 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 9 },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.36)', flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 8, borderTopRightRadius: 8, maxHeight: '82%', padding: 18 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  productPreview: { borderRadius: 8, flexDirection: 'row', gap: 12, marginTop: 14, padding: 10 },
  productImage: { borderRadius: 6, borderWidth: 1, height: 72, overflow: 'hidden', width: 54 },
  productImageInner: { height: '100%', width: '100%' },
  productText: { flex: 1, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '900', lineHeight: 20 },
  productMeta: { fontSize: 12, marginTop: 5 },
  warningBox: { borderRadius: 8, borderWidth: 1, gap: 4, marginTop: 10, padding: 10 },
  warningText: { fontSize: 11, lineHeight: 16 },
  candidateList: { marginTop: 14 },
  candidate: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 12,
  },
  candidateName: { fontSize: 15, fontWeight: '900' },
  candidateVariant: { fontSize: 12, marginTop: 4 },
});
