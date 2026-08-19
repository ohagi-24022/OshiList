import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManualGoodsForm } from '../../src/components/ManualGoodsForm';
import { useTabReset } from '../../src/hooks/useTabReset';
import { persistPickedImage, requestPhotoCameraPermission, requestPhotoLibraryPermission } from '../../src/lib/localImage';
import { inferGoodsFromPhoto, lookupProductByJan, parseReceiptImage, sendLineupFeedback, sendLookupCandidateFeedback } from '../../src/lib/productLookup';
import { goodsStatusLabels } from '../../src/lib/goodsStatus';
import { inferIsRandomGoods } from '../../src/lib/randomGoods';
import { useEvents } from '../../src/store/EventContext';
import { useGoods } from '../../src/store/GoodsContext';
import { MyStore, useMyStores } from '../../src/store/MyStoreContext';
import { useAppTheme } from '../../src/store/ThemeContext';
import { Goods, PhotoInferResult, ProductLookupResult, ReceiptParseResult } from '../../src/types';

type ScanMode = 'barcode' | 'receipt' | 'photo' | 'manual' | 'plan' | 'check' | 'event';
type RegistrationFlow = 'owned' | 'planned';
type ReceiptSource = 'camera' | 'library';
type ReceiptCandidateChoice = {
  boxName: string;
  imageUrl: string | null;
  sourceLabel: string;
  existingGoodsId?: number;
  existingGoodsLabel?: string;
};

export default function ScanScreen() {
  const { colors } = useAppTheme();
  const { addGoods, goods } = useGoods();
  const { events, selectedEventId, setSelectedEventId } = useEvents();
  const { selectedStore, selectedStoreId, selectStore, stores } = useMyStores();
  const params = useLocalSearchParams<{ mode?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [registrationFlow, setRegistrationFlow] = useState<RegistrationFlow>('owned');
  const [torch, setTorch] = useState(false);
  const [manualJan, setManualJan] = useState('');
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('枠内にJANコードを合わせてください。');
  const [result, setResult] = useState<ProductLookupResult | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptParseResult | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoInferResult | null>(null);
  const [photoImageUri, setPhotoImageUri] = useState<string | null>(null);
  const [checkJan, setCheckJan] = useState('');
  const [checkResult, setCheckResult] = useState<Goods[]>([]);
  const scanLockRef = useRef(false);
  const lastScannedJanRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      params.mode === 'barcode' ||
      params.mode === 'receipt' ||
      params.mode === 'photo' ||
      params.mode === 'manual' ||
      params.mode === 'plan' ||
      params.mode === 'check' ||
      params.mode === 'event'
    ) {
      setMode(params.mode);
      setRegistrationFlow(params.mode === 'plan' || params.mode === 'check' || params.mode === 'event' ? 'planned' : 'owned');
    }
  }, [params.mode]);

  const ownedModes: ScanMode[] = ['barcode', 'receipt', 'photo', 'manual'];
  const plannedModes: ScanMode[] = ['plan', 'check', 'event'];
  const visibleModes = registrationFlow === 'owned' ? ownedModes : plannedModes;

  const switchRegistrationFlow = (nextFlow: RegistrationFlow) => {
    setRegistrationFlow(nextFlow);
    setMode(nextFlow === 'owned' ? 'barcode' : 'plan');
  };

  const resetScanLock = () => {
    scanLockRef.current = false;
    lastScannedJanRef.current = null;
    setScanning(true);
    setLoading(false);
    setStatusMessage('枠内にJANコードを合わせてください。');
  };

  const resolveJan = async (janCode: string) => {
    const normalizedJan = janCode.trim();
    if (!normalizedJan || scanLockRef.current) return;

    scanLockRef.current = true;
    lastScannedJanRef.current = normalizedJan;
    setScanning(false);
    setLoading(true);
    setStatusMessage(`JAN ${normalizedJan} を読み取りました。商品情報を検索中です。`);
    try {
      const product = await lookupProductByJan(normalizedJan, { preferredStoreDomain: selectedStore?.domain });
      setManualJan(product.janCode ?? normalizedJan);
      setStatusMessage('商品情報を取得しました。登録内容を確認してください。');
      setResult(product);
    } catch (error) {
      setStatusMessage('商品情報を取得できませんでした。再スキャンするか、手動登録を選んでください。');
      Alert.alert(
        '商品情報を取得できませんでした',
        error instanceof Error ? error.message : '商品情報を取得できませんでした。',
        [
          {
            text: '再スキャン',
            onPress: resetScanLock,
          },
          {
            text: '手動登録',
            onPress: () => {
              resetScanLock();
              setMode('manual');
            },
          },
        ],
      );
      setManualJan(normalizedJan);
    } finally {
      setLoading(false);
    }
  };

  const closeResult = () => {
    setResult(null);
    resetScanLock();
  };

  const checkBeforeBuy = (janCode: string) => {
    const normalizedJan = janCode.trim();
    if (!normalizedJan) return;
    setCheckJan(normalizedJan);
    setCheckResult(goods.filter((item) => item.janCode === normalizedJan));
  };

  const readReceiptImage = async (source: ReceiptSource) => {
    setReceiptStatus(source === 'camera' ? 'カメラを起動中...' : '写真ライブラリを開いています...');
    if (source === 'camera') {
      await requestPhotoCameraPermission();
    } else {
      await requestPhotoLibraryPermission();
    }

    const permissionResult =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      throw new Error(source === 'camera' ? 'カメラの使用が許可されていません。' : '写真ライブラリの使用が許可されていません。');
    }

    const pickerResult =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.65, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65, base64: true });

    if (pickerResult.canceled || !pickerResult.assets[0]) {
      return null;
    }

    setReceiptStatus('画像を準備中...');
    const asset = pickerResult.assets[0];
    const imageBase64 =
      asset.base64 ??
      (await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      }));

    return {
      imageBase64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    };
  };

  const analyzeReceipt = async (source: ReceiptSource) => {
    setLoading(true);
    setReceiptStatus('');
    try {
      const image = await readReceiptImage(source);
      if (!image) return;
      setReceiptStatus('領収書を解析中...');
      const parsed = await parseReceiptImage(image.imageBase64, image.mimeType);
      setReceiptResult(parsed);
      if (!parsed.items.length) {
        Alert.alert('商品名を抽出できませんでした', '手動登録または別の写真で再試行してください。');
      }
    } catch (error) {
      Alert.alert('領収書を解析できませんでした', error instanceof Error ? error.message : 'もう一度お試しください。');
    } finally {
      setReceiptStatus('');
      setLoading(false);
    }
  };

  const analyzeProductPhoto = async (source: ReceiptSource) => {
    setLoading(true);
    setReceiptStatus('');
    try {
      const image = await readReceiptImage(source);
      if (!image) return;
      setPhotoImageUri(image.uri);
      setReceiptStatus('写真から登録情報を推定中...');
      const parsed = await inferGoodsFromPhoto(image.imageBase64, image.mimeType);
      setPhotoResult(parsed);
      if (!parsed.boxName && !parsed.seriesName && !parsed.characterName && !parsed.goodsType) {
        Alert.alert('推定できる情報が少なめです', '撮影した写真を商品画像にして、未整理として登録できます。');
      }
    } catch (error) {
      Alert.alert('写真登録αを実行できませんでした', error instanceof Error ? error.message : 'もう一度お試しください。');
    } finally {
      setReceiptStatus('');
      setLoading(false);
    }
  };

  const cameraReady = Platform.OS !== 'web' && permission?.granted && isFocused && (mode === 'barcode' || mode === 'check');
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  useTabReset(scrollRef);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: colors.text }]}>登録</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              所持コレクションへの追加と、予約・欲しい物の登録を分けて管理します。
            </Text>
          </View>

          <View style={[styles.flowSegment, { backgroundColor: colors.input }]}>
            <Pressable
              onPress={() => switchRegistrationFlow('owned')}
              style={[styles.flowButton, registrationFlow === 'owned' && { backgroundColor: colors.surface }]}
            >
              <Ionicons color={registrationFlow === 'owned' ? colors.primary : colors.muted} name="albums-outline" size={19} />
              <Text style={[styles.flowText, { color: registrationFlow === 'owned' ? colors.text : colors.muted }]}>所持に追加</Text>
            </Pressable>
            <Pressable
              onPress={() => switchRegistrationFlow('planned')}
              style={[styles.flowButton, registrationFlow === 'planned' && { backgroundColor: colors.surface }]}
            >
              <Ionicons color={registrationFlow === 'planned' ? colors.primary : colors.muted} name="calendar-outline" size={19} />
              <Text style={[styles.flowText, { color: registrationFlow === 'planned' ? colors.text : colors.muted }]}>予定・欲しい</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.segment, { backgroundColor: colors.input }]}>
            {visibleModes.map((value) => {
              const active = mode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setMode(value)}
                  style={[styles.segmentButton, active && { backgroundColor: colors.surface }]}
                >
                  <Ionicons
                    color={active ? colors.primary : colors.muted}
                    name={
                      value === 'barcode'
                        ? 'barcode-outline'
                        : value === 'receipt'
                          ? 'receipt-outline'
                          : value === 'photo'
                            ? 'camera-outline'
                            : value === 'manual'
                              ? 'create-outline'
                              : value === 'plan'
                                  ? 'calendar-outline'
                        : value === 'check'
                          ? 'shield-checkmark-outline'
                          : 'sparkles-outline'
                    }
                    size={18}
                  />
                  <Text style={[styles.segmentText, { color: active ? colors.text : colors.muted }]}>
                    {value === 'barcode'
                      ? 'バーコード'
                      : value === 'receipt'
                        ? '領収書'
                        : value === 'photo'
                          ? '写真登録α'
                          : value === 'manual'
                            ? '手動登録'
                            : value === 'plan'
                                ? '予定登録'
                                : value === 'check'
                                  ? '買う前'
                                  : 'イベント'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {mode === 'barcode' ? (
            <>
              <StoreSelector
                selectedStoreId={selectedStoreId}
                stores={stores}
                onSelect={selectStore}
              />

              <View style={[styles.cameraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {cameraReady ? (
                  <CameraView
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                    enableTorch={torch}
                    onBarcodeScanned={scanning ? ({ data }) => resolveJan(data) : undefined}
                    style={styles.camera}
                  >
                    <View style={[styles.guide, { borderColor: loading ? colors.secondary : colors.primary }]} />
                    <View style={[styles.cameraStatus, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {loading ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons color={colors.primary} name="scan" size={18} />}
                      <Text style={[styles.cameraStatusText, { color: colors.text }]}>{statusMessage}</Text>
                    </View>
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
                <Pressable onPress={resetScanLock} style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Ionicons color={colors.text} name="scan-outline" size={18} />
                  <Text style={[styles.actionText, { color: colors.text }]}>再スキャン</Text>
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
                    onPress={() => {
                      resetScanLock();
                      setTimeout(() => resolveJan(manualJan), 0);
                    }}
                    style={[styles.lookupButton, { backgroundColor: loading ? colors.border : colors.primary }]}
                  >
                    {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons color="#ffffff" name="search" size={18} />}
                  </Pressable>
                </View>
                {!!lastScannedJanRef.current && (
                  <Text style={[styles.helper, { color: colors.muted }]}>処理中のJAN: {lastScannedJanRef.current}</Text>
                )}
              </View>
            </>
          ) : mode === 'plan' ? (
            <View>
              <View style={[styles.manualIntro, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <Ionicons color={colors.primary} name="calendar-outline" size={22} />
                <View style={styles.manualIntroText}>
                  <Text style={[styles.manualIntroTitle, { color: colors.text }]}>予約・欲しい物を登録</Text>
                  <Text style={[styles.manualIntroBody, { color: colors.muted }]}>
                    まだ所持していないグッズを予定として登録します。コレクション一覧には表示せず、予定タブで管理します。
                  </Text>
                </View>
              </View>
              <ManualGoodsForm
                initialStatus="wanted"
                allowedStatuses={['wanted', 'reserved', 'ordered', 'shipped']}
                onSubmit={addGoods}
              />
            </View>
          ) : mode === 'check' ? (
            <View style={[styles.receiptPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptIcon}>
                <Ionicons color={colors.primary} name="shield-checkmark-outline" size={34} />
              </View>
              <Text style={[styles.receiptTitle, { color: colors.text }]}>買う前チェック</Text>
              <Text style={[styles.receiptText, { color: colors.muted }]}>
                店頭やイベント会場でJANを読むと、所持・予約済み・欲しい登録をローカルから確認します。
              </Text>
              <View style={[styles.checkCameraBox, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                {cameraReady ? (
                  <CameraView
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                    onBarcodeScanned={({ data }) => checkBeforeBuy(data)}
                    style={styles.checkCamera}
                  />
                ) : (
                  <View style={styles.checkFallback}>
                    <Ionicons color={colors.muted} name="barcode-outline" size={34} />
                    {!permission?.granted && Platform.OS !== 'web' ? (
                      <Pressable onPress={requestPermission} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                        <Text style={styles.primaryButtonText}>カメラを許可する</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
              <View style={styles.lookupRow}>
                <TextInput
                  value={checkJan}
                  onChangeText={setCheckJan}
                  keyboardType="number-pad"
                  placeholder="4900000000000"
                  placeholderTextColor={colors.muted}
                  style={[styles.janInput, { backgroundColor: colors.input, color: colors.text }]}
                />
                <Pressable onPress={() => checkBeforeBuy(checkJan)} style={[styles.lookupButton, { backgroundColor: colors.primary }]}>
                  <Ionicons color="#ffffff" name="search" size={18} />
                </Pressable>
              </View>
              {checkJan ? (
                <View style={[styles.checkResultBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Text style={[styles.checkResultTitle, { color: colors.text }]}>
                    {checkResult.length ? `登録済み ${checkResult.length}件` : '未所持'}
                  </Text>
                  {checkResult.length ? (
                    checkResult.map((item) => (
                      <View key={`check-${item.id}`} style={styles.checkResultRow}>
                        <Text numberOfLines={1} style={[styles.checkResultName, { color: colors.text }]}>
                          {item.characterName} / {item.variantName}
                        </Text>
                        <Text style={[styles.checkResultMeta, { color: colors.muted }]}>
                          {goodsStatusLabels[item.status]} / {item.quantity}個
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.receiptText, { color: colors.muted }]}>このJANはローカル登録に見つかりませんでした。</Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : mode === 'event' ? (
            <View style={[styles.receiptPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptIcon}>
                <Ionicons color={colors.primary} name="sparkles-outline" size={34} />
              </View>
              <Text style={[styles.receiptTitle, { color: colors.text }]}>イベント購入予定を登録</Text>
              <Text style={[styles.receiptText, { color: colors.muted }]}>
                イベントで買う予定のグッズを、選択中のイベントリストへ追加します。数量管理はイベントタブで行えます。
              </Text>
              {!!events.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChips}>
                  {events.map((event) => {
                    const active = event.id === selectedEvent?.id;
                    return (
                      <Pressable
                        key={event.id}
                        onPress={() => setSelectedEventId(event.id)}
                        style={[styles.eventChip, { backgroundColor: active ? colors.text : colors.elevated, borderColor: colors.border }]}
                      >
                        <Text style={[styles.eventChipText, { color: active ? colors.background : colors.text }]}>{event.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[styles.receiptText, { color: colors.muted }]}>先にイベントタブでイベントを作成してください。</Text>
              )}
              {selectedEvent ? (
                <ManualGoodsForm
                  initialStatus="wanted"
                  initialEventId={selectedEvent.id}
                  allowedStatuses={['wanted', 'reserved', 'ordered', 'shipped']}
                  onSubmit={async (input) => {
                    await addGoods(input);
                  }}
                />
              ) : null}
            </View>
          ) : mode === 'receipt' ? (
            <View style={[styles.receiptPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptIcon}>
                <Ionicons color={colors.primary} name="receipt-outline" size={34} />
              </View>
              <Text style={[styles.receiptTitle, { color: colors.text }]}>領収書から商品名を探す</Text>
              <Text style={[styles.receiptText, { color: colors.muted }]}>
                領収書を撮影すると、AIが商品名らしい行を抽出し、楽天/Yahooの商品候補を表示します。
              </Text>
              <View style={styles.receiptActions}>
                <Pressable
                  disabled={loading}
                  onPress={() => analyzeReceipt('camera')}
                  style={[styles.receiptButton, { backgroundColor: colors.primary }]}
                >
                  {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons color="#ffffff" name="camera-outline" size={19} />}
                  <Text style={styles.receiptButtonText}>撮影する</Text>
                </Pressable>
                <Pressable
                  disabled={loading}
                  onPress={() => analyzeReceipt('library')}
                  style={[styles.secondaryReceiptButton, { borderColor: colors.border }]}
                >
                  <Ionicons color={colors.text} name="images-outline" size={19} />
                  <Text style={[styles.secondaryReceiptText, { color: colors.text }]}>写真から選択</Text>
                </Pressable>
              </View>
              {!!receiptStatus && <Text style={[styles.receiptStatus, { color: colors.muted }]}>{receiptStatus}</Text>}
            </View>
          ) : mode === 'photo' ? (
            <View style={[styles.receiptPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptIcon}>
                <Ionicons color={colors.primary} name="camera-outline" size={34} />
              </View>
              <View style={[styles.alphaBadge, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Text style={[styles.alphaBadgeText, { color: colors.primary }]}>α版</Text>
              </View>
              <Text style={[styles.receiptTitle, { color: colors.text }]}>写真からかんたん登録</Text>
              <Text style={[styles.receiptText, { color: colors.muted }]}>
                商品やパッケージを撮影すると、AIがシリーズやキャラ、グッズ種別を控えめに推定します。登録時は撮影した写真を商品画像にして未整理で保存します。
              </Text>
              <View style={styles.receiptActions}>
                <Pressable
                  disabled={loading}
                  onPress={() => analyzeProductPhoto('camera')}
                  style={[styles.receiptButton, { backgroundColor: colors.primary }]}
                >
                  {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons color="#ffffff" name="camera-outline" size={19} />}
                  <Text style={styles.receiptButtonText}>撮影する</Text>
                </Pressable>
                <Pressable
                  disabled={loading}
                  onPress={() => analyzeProductPhoto('library')}
                  style={[styles.secondaryReceiptButton, { borderColor: colors.border }]}
                >
                  <Ionicons color={colors.text} name="images-outline" size={19} />
                  <Text style={[styles.secondaryReceiptText, { color: colors.text }]}>写真から選択</Text>
                </Pressable>
              </View>
              {!!receiptStatus && <Text style={[styles.receiptStatus, { color: colors.muted }]}>{receiptStatus}</Text>}
            </View>
          ) : (
            <View>
              <View style={[styles.manualIntro, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <Ionicons color={colors.primary} name="create-outline" size={22} />
                <View style={styles.manualIntroText}>
                  <Text style={[styles.manualIntroTitle, { color: colors.text }]}>手動でグッズを登録</Text>
                  <Text style={[styles.manualIntroBody, { color: colors.muted }]}>
                    予約済み・欲しい・未整理など、バーコードや領収書を使わないグッズをそのまま登録できます。
                  </Text>
                </View>
              </View>
              <ManualGoodsForm initialJanCode={manualJan || null} allowedStatuses={['owned', 'unorganized']} onSubmit={addGoods} />
            </View>
          )}
        </ScrollView>

        <ProductResultModal result={result} onClose={closeResult} />
        <ReceiptResultModal result={receiptResult} onClose={() => setReceiptResult(null)} />
        <PhotoInferModal
          result={photoResult}
          onClose={() => {
            setPhotoResult(null);
            setPhotoImageUri(null);
          }}
          imageUri={photoImageUri}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function StoreSelector({
  onSelect,
  selectedStoreId,
  stores,
}: {
  onSelect: (id: string | null) => Promise<void>;
  selectedStoreId: string | null;
  stores: MyStore[];
}) {
  const { colors } = useAppTheme();
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;

  return (
    <View style={[styles.storeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.storeSelectorHeader}>
        <View style={styles.storeSelectorTitleBlock}>
          <Text style={[styles.storeSelectorLabel, { color: colors.muted }]}>使用ストア</Text>
          <Text numberOfLines={1} style={[styles.storeSelectorTitle, { color: colors.text }]}>
            {selectedStore ? selectedStore.name : '指定なし'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChips} style={styles.storeChipScroll}>
          <Pressable
            onPress={() => onSelect(null)}
            style={[
              styles.storeChip,
              { backgroundColor: selectedStoreId ? colors.elevated : colors.text, borderColor: selectedStoreId ? colors.border : colors.text },
            ]}
          >
            <Ionicons color={selectedStoreId ? colors.muted : colors.background} name="earth-outline" size={15} />
            <Text style={[styles.storeChipText, { color: selectedStoreId ? colors.text : colors.background }]}>指定なし</Text>
          </Pressable>
          {stores.map((store) => {
            const active = store.id === selectedStoreId;
            return (
              <Pressable
                key={store.id}
                onPress={() => onSelect(store.id)}
                style={[
                  styles.storeChip,
                  { backgroundColor: active ? colors.text : colors.elevated, borderColor: active ? colors.text : colors.border },
                ]}
              >
                <Ionicons color={active ? colors.background : colors.primary} name={store.priority ? 'star' : 'storefront-outline'} size={15} />
                <Text numberOfLines={1} style={[styles.storeChipText, { color: active ? colors.background : colors.text }]}>
                  {store.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => router.push('/my-stores')} style={[styles.storeManageButton, { backgroundColor: colors.elevated }]}>
          <Ionicons color={colors.primary} name="settings-outline" size={17} />
        </Pressable>
      </View>
    </View>
  );
}

function ProductResultModal({ result, onClose }: { result: ProductLookupResult | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { addGoods, goods } = useGoods();
  const [seriesName, setSeriesName] = useState('');
  const [candidates, setCandidates] = useState(result?.candidates ?? []);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(result?.selectedCandidateId ?? result?.candidates?.[0]?.id ?? null);
  const [hiddenLineupIds, setHiddenLineupIds] = useState<Set<string>>(new Set());
  const seriesSuggestions = useMemo(
    () => Array.from(new Set(goods.map((item) => item.seriesName).filter(Boolean))).slice(0, 10),
    [goods],
  );
  const activeCandidate = candidates.find((candidate) => candidate.id === activeCandidateId) ?? candidates[0] ?? null;
  const previewResult = result
    ? {
        ...result,
        boxName: activeCandidate?.boxName ?? result.boxName,
        imageUrl: activeCandidate?.imageUrl ?? result.imageUrl,
        sourceLabel: activeCandidate?.sourceLabel ?? result.sourceLabel,
        confidence: activeCandidate?.confidence ?? result.confidence,
        sourceUrls: activeCandidate?.sourceUrl ? [activeCandidate.sourceUrl] : result.sourceUrls,
      }
    : null;
  const userLineup = useMemo(
    () => (previewResult ? findUserLineupForProduct(previewResult, seriesName, goods) : []),
    [goods, previewResult?.boxName, previewResult?.janCode, seriesName],
  );
  const displayLineup = (result?.lineup.length ? result.lineup : userLineup).filter(
    (item) => !item.suggestionId || !hiddenLineupIds.has(item.suggestionId),
  );
  const previewWithLineup = previewResult ? { ...previewResult, lineup: displayLineup } : null;
  const inferredIsRandom = previewResult ? Boolean(previewResult.isRandom) || inferIsRandomGoods(previewResult.boxName, displayLineup.length) : false;

  useEffect(() => {
    setSeriesName('');
    setCandidates(result?.candidates ?? []);
    setActiveCandidateId(result?.selectedCandidateId ?? result?.candidates?.[0]?.id ?? null);
    setHiddenLineupIds(new Set());
  }, [result?.janCode, result?.boxName]);

  const sendFeedback = async (action: 'selected' | 'rejected', candidateId = activeCandidateId) => {
    try {
      const updatedCandidates = await sendLookupCandidateFeedback(result?.janCode, candidateId, action);
      if (updatedCandidates.length) {
        setCandidates(updatedCandidates);
        if (action === 'rejected') {
          const nextCandidate = updatedCandidates.find((candidate) => candidate.id !== candidateId) ?? updatedCandidates[0] ?? null;
          setActiveCandidateId(nextCandidate?.id ?? null);
        }
      }
    } catch {
      // Ranking feedback should never block registration.
    }
  };

  const sendLineupLearning = async (
    candidate: ProductLookupResult['lineup'][number],
    action: 'selected' | 'rejected' | 'reported',
  ) => {
    if (!previewResult) return;
    try {
      await sendLineupFeedback({
        janCode: result?.janCode,
        boxName: previewResult.boxName,
        characterName: candidate.characterName,
        variantName: candidate.variantName,
        suggestionId: candidate.suggestionId,
        action,
      });
      if (candidate.suggestionId && action !== 'selected') {
        setHiddenLineupIds((current) => new Set(current).add(candidate.suggestionId ?? ''));
      }
    } catch {
      // Shared lineup feedback should never block local registration.
    }
  };

  return (
    <Modal animationType="slide" transparent visible={!!result} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>取得した商品情報</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.muted }]} numberOfLines={1}>
                {result?.sourceLabel}
                {result?.janCode ? ` / JAN: ${result.janCode}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          {!!result && (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.productResultContent}>
              {candidates.length > 1 ? (
                <View style={styles.productCandidatePicker}>
                  <Text style={[styles.seriesPickerLabel, { color: colors.muted }]}>商品候補</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCandidateChips}>
                    {candidates.map((candidate, index) => {
                      const active = candidate.id === activeCandidateId;
                      return (
                        <Pressable
                          key={candidate.id}
                          onPress={() => setActiveCandidateId(candidate.id)}
                          style={[
                            styles.productCandidateChip,
                            {
                              backgroundColor: active ? colors.primary : colors.elevated,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text numberOfLines={2} style={[styles.productCandidateText, { color: active ? '#ffffff' : colors.text }]}>
                            {index + 1}. {candidate.boxName}
                          </Text>
                          <Text style={[styles.productCandidateMeta, { color: active ? '#ffffff' : colors.muted }]}>
                            選択 {candidate.selectedCount} / 違う {candidate.rejectedCount}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable
                    onPress={() => sendFeedback('rejected')}
                    disabled={!activeCandidateId}
                    style={[styles.rejectCandidateButton, { borderColor: colors.border, backgroundColor: colors.input }]}
                  >
                    <Ionicons color={colors.muted} name="thumbs-down-outline" size={16} />
                    <Text style={[styles.rejectCandidateText, { color: colors.muted }]}>これは違う</Text>
                  </Pressable>
                </View>
              ) : null}
              {previewWithLineup ? <ProductPreview result={previewWithLineup} /> : null}
              {!result.lineup.length && !!userLineup.length ? (
                <Text style={[styles.lineupSourceHelp, { color: colors.muted }]}>過去に登録した内容からラインナップ候補を表示しています。</Text>
              ) : null}
              <View style={styles.seriesPicker}>
                <Text style={[styles.seriesPickerLabel, { color: colors.muted }]}>シリーズ</Text>
                <TextInput
                  value={seriesName}
                  onChangeText={setSeriesName}
                  placeholder="シリーズ未設定"
                  placeholderTextColor={colors.muted}
                  style={[styles.seriesInput, { backgroundColor: colors.input, color: colors.text }]}
                />
                {!!seriesSuggestions.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesChips}>
                    {seriesSuggestions.map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setSeriesName(value)}
                        style={[styles.seriesChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
                      >
                        <Text numberOfLines={1} style={[styles.seriesChipText, { color: colors.text }]}>
                          {value}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={styles.candidateList}>
                {displayLineup.length > 0 ? (
                  displayLineup.map((candidate) => (
                    <Pressable
                      key={`${candidate.suggestionId ?? 'lineup'}-${candidate.characterName}-${candidate.variantName}`}
                      onPress={async () => {
                        await sendFeedback('selected');
                        await sendLineupLearning(candidate, 'selected');
                        await addGoods({
                          janCode: result.janCode,
                          boxName: previewResult?.boxName ?? result.boxName,
                          seriesName: seriesName.trim(),
                          characterName: candidate.characterName,
                          variantName: candidate.variantName,
                          imageUrl: previewResult?.imageUrl ?? result.imageUrl,
                          isRandom: inferredIsRandom,
                        });
                        onClose();
                      }}
                      style={[styles.candidate, { borderColor: colors.border }]}
                    >
                      <View>
                        <Text style={[styles.candidateName, { color: colors.text }]}>{candidate.characterName}</Text>
                        <Text style={[styles.candidateVariant, { color: colors.muted }]}>
                          {candidate.variantName}
                          {candidate.source === 'user' ? ` / 共有候補 ${candidate.selectedCount ?? 0}` : ''}
                        </Text>
                      </View>
                      {candidate.suggestionId ? (
                        <View style={styles.lineupFeedbackActions}>
                          <Pressable
                            accessibilityLabel="このラインナップ候補は違う"
                            onPress={(event) => {
                              event.stopPropagation();
                              sendLineupLearning(candidate, 'rejected');
                            }}
                            style={[styles.lineupFeedbackButton, { borderColor: colors.border }]}
                          >
                            <Ionicons color={colors.muted} name="thumbs-down-outline" size={16} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="このラインナップ候補を通報"
                            onPress={(event) => {
                              event.stopPropagation();
                              sendLineupLearning(candidate, 'reported');
                            }}
                            style={[styles.lineupFeedbackButton, { borderColor: colors.border }]}
                          >
                            <Ionicons color={colors.muted} name="flag-outline" size={16} />
                          </Pressable>
                        </View>
                      ) : (
                        <Ionicons color={colors.primary} name="add-circle-outline" size={24} />
                      )}
                    </Pressable>
                  ))
                ) : (
                  <ManualGoodsForm
                    initialJanCode={result.janCode}
                    initialBoxName={previewResult?.boxName ?? result.boxName}
                    initialSeriesName={seriesName}
                    initialImageUrl={previewResult?.imageUrl ?? result.imageUrl}
                    initialIsRandom={inferredIsRandom}
                    allowedStatuses={['owned', 'unorganized']}
                    onSubmit={async (input) => {
                      await sendFeedback('selected');
                      await addGoods(input);
                      onClose();
                    }}
                  />
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function normalizeGoodsName(value: string) {
  return value
    .toLowerCase()
    .replace(/[【】「」『』（）()［\]\[\]<>＜＞]/g, ' ')
    .replace(/[^\p{L}\p{N}ー]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeGoodsName(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeGoodsName(right).split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function findUserLineupForProduct(result: ProductLookupResult, seriesName: string, goods: Goods[]): ProductLookupResult['lineup'] {
  const selectedSeries = seriesName.trim();
  const normalizedBoxName = normalizeGoodsName(result.boxName);
  const lineupMap = new Map<string, { characterName: string; variantName: string }>();

  goods
    .filter((item) => item.status === 'owned' || item.status === 'unorganized')
    .filter((item) => {
      if (result.janCode && item.janCode === result.janCode) return true;
      if (tokenSimilarity(normalizedBoxName, item.boxName) >= 0.55) return true;
      return !!selectedSeries && selectedSeries !== 'シリーズ未設定' && item.seriesName === selectedSeries && tokenSimilarity(normalizedBoxName, item.boxName) >= 0.35;
    })
    .forEach((item) => {
      const characterName = item.characterName.trim();
      const variantName = item.variantName.trim() || '通常版';
      if (!characterName || characterName === '未分類') return;
      const key = `${characterName}::${variantName}`;
      if (!lineupMap.has(key)) {
        lineupMap.set(key, { characterName, variantName });
      }
    });

  return Array.from(lineupMap.values()).slice(0, 50);
}

function findExistingGoodsMatches(candidateName: string, goods: Goods[]) {
  const normalizedCandidate = normalizeGoodsName(candidateName);
  const compactCandidate = normalizedCandidate.replace(/\s/g, '');
  return goods
    .map((item) => {
      const normalizedExisting = normalizeGoodsName(item.boxName);
      const compactExisting = normalizedExisting.replace(/\s/g, '');
      const includesScore =
        compactCandidate.includes(compactExisting) || compactExisting.includes(compactCandidate) ? 0.9 : 0;
      return {
        item,
        score: Math.max(includesScore, tokenSimilarity(candidateName, item.boxName)),
      };
    })
    .filter(({ score }) => score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
}

function ReceiptResultModal({
  result,
  onClose,
  registrationImageUri = null,
  title = '領収書の候補',
  subtitle = '商品名候補を確認して登録してください。',
}: {
  result: ReceiptParseResult | null;
  onClose: () => void;
  registrationImageUri?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const { colors } = useAppTheme();
  const { addGoods, goods, updateQuantity } = useGoods();
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, ReceiptCandidateChoice>>({});
  const selectedCount = Object.keys(selectedCandidates).length;

  const toggleCandidate = (key: string, candidate: ReceiptCandidateChoice) => {
    setSelectedCandidates((current) => {
      const next = { ...current };
      const baseKey = key.replace(/-existing-\d+$/, '');
      if (next[key]) {
        delete next[key];
      } else {
        Object.keys(next).forEach((selectedKey) => {
          if (selectedKey === baseKey || selectedKey.startsWith(`${baseKey}-existing-`)) {
            delete next[selectedKey];
          }
        });
        next[key] = candidate;
      }
      return next;
    });
  };

  const closeReceiptModal = () => {
    setSelectedCandidates({});
    onClose();
  };

  const registerSelectedCandidates = async () => {
    const candidates = Object.values(selectedCandidates);
    for (const candidate of candidates) {
      if (candidate.existingGoodsId) {
        await updateQuantity(candidate.existingGoodsId, 1);
        continue;
      }
      await addGoods({
        janCode: null,
        boxName: candidate.boxName,
        characterName: '',
        variantName: '通常版',
        imageUrl: registrationImageUri ? await persistPickedImage(registrationImageUri) : candidate.imageUrl,
        isRandom: inferIsRandomGoods(candidate.boxName),
      });
    }
    closeReceiptModal();
  };

  return (
    <Modal animationType="slide" transparent visible={!!result} onRequestClose={closeReceiptModal}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{subtitle}</Text>
            </View>
            <Pressable onPress={closeReceiptModal} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          {registrationImageUri ? (
            <View style={[styles.photoSourcePreview, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              <Image source={{ uri: registrationImageUri }} style={styles.photoSourceImage} />
              <View style={styles.photoSourceTextBlock}>
                <Text style={[styles.photoSourceTitle, { color: colors.text }]}>登録画像</Text>
                <Text style={[styles.photoSourceText, { color: colors.muted }]}>この写真を商品の画像として保存します。</Text>
              </View>
            </View>
          ) : null}

          <ScrollView style={styles.candidateList} showsVerticalScrollIndicator={false}>
            {result?.items.map((item, itemIndex) => (
              <View key={`receipt-${itemIndex}-${item.rawText}-${item.normalizedQuery}`} style={[styles.receiptItem, { borderColor: colors.border }]}>
                <Text style={[styles.receiptQuery, { color: colors.text }]}>{item.normalizedQuery}</Text>
                <Text style={[styles.receiptRaw, { color: colors.muted }]}>
                  読取: {item.rawText} / 信頼度 {Math.round(item.confidence * 100)}%
                </Text>
                {item.candidates.length ? (
                  item.candidates.map((candidate, candidateIndex) => {
                    const candidateKey = `receipt-${itemIndex}-candidate-${candidateIndex}-${item.normalizedQuery}-${candidate.boxName}`;
                    const selected = !!selectedCandidates[candidateKey];
                    const existingMatches = findExistingGoodsMatches(candidate.boxName, goods);
                    return (
                      <View key={candidateKey}>
                        <Pressable
                          onPress={() => toggleCandidate(candidateKey, candidate)}
                          style={[
                            styles.receiptCandidate,
                            {
                              backgroundColor: selected ? colors.input : colors.elevated,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <View style={[styles.receiptCandidateImage, { borderColor: colors.border }]}>
                            {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={styles.productImageInner} /> : null}
                          </View>
                          <View style={styles.receiptCandidateText}>
                            <Text numberOfLines={2} style={[styles.candidateName, { color: colors.text }]}>
                              {candidate.boxName}
                            </Text>
                            <Text style={[styles.candidateVariant, { color: colors.muted }]}>{candidate.sourceLabel} / 新規登録</Text>
                          </View>
                          <Ionicons color={selected ? colors.primary : colors.muted} name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={24} />
                        </Pressable>
                        {!!existingMatches.length && (
                          <View style={styles.existingMatchBlock}>
                            <Text style={[styles.existingMatchLabel, { color: colors.muted }]}>すでに持っている場合</Text>
                            {existingMatches.map((match) => {
                              const existingKey = `${candidateKey}-existing-${match.id}`;
                              const existingSelected = !!selectedCandidates[existingKey];
                              return (
                                <Pressable
                                  key={existingKey}
                                  onPress={() =>
                                    toggleCandidate(existingKey, {
                                      ...candidate,
                                      existingGoodsId: match.id,
                                      existingGoodsLabel: match.boxName,
                                    })
                                  }
                                  style={[
                                    styles.existingMatchChip,
                                    {
                                      backgroundColor: existingSelected ? colors.input : colors.surface,
                                      borderColor: existingSelected ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  <Ionicons color={existingSelected ? colors.primary : colors.muted} name={existingSelected ? 'checkmark-circle' : 'add-circle-outline'} size={16} />
                                  <Text numberOfLines={1} style={[styles.existingMatchText, { color: colors.text }]}>
                                    {match.boxName}
                                  </Text>
                                  <Text style={[styles.existingMatchQuantity, { color: colors.muted }]}>+1</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.noCandidate, { color: colors.muted }]}>商品検索候補が見つかりませんでした。</Text>
                )}
              </View>
            ))}
            {!!result?.warnings?.length && (
              <View style={[styles.warningBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                {result.warnings.slice(0, 4).map((warning, warningIndex) => (
                  <Text key={`receipt-warning-${warningIndex}-${warning}`} style={[styles.warningText, { color: colors.muted }]}>
                    {warning}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={[styles.receiptFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.receiptSelectionText, { color: colors.muted }]}>{selectedCount}件選択中</Text>
            <Pressable
              disabled={!selectedCount}
              onPress={registerSelectedCandidates}
              style={[styles.registerSelectedButton, { backgroundColor: selectedCount ? colors.primary : colors.border }]}
            >
              <Ionicons color="#ffffff" name="checkmark-done-outline" size={18} />
              <Text style={styles.registerSelectedText}>選択した候補を登録/加算</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PhotoInferModal({ result, imageUri, onClose }: { result: PhotoInferResult | null; imageUri: string | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { addGoods } = useGoods();
  const fallbackBoxName = useMemo(() => {
    if (!result) return '';
    if (result.boxName.trim()) return result.boxName.trim();
    const inferredName = [result.seriesName, result.characterName, result.goodsType].map((value) => value.trim()).filter(Boolean).join(' ');
    return inferredName || '写真から登録したグッズ';
  }, [result]);
  const variantName = result?.variantName.trim() || result?.goodsType.trim() || '通常版';

  return (
    <Modal animationType="slide" transparent visible={!!result} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>写真からかんたん登録α</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>AI推定を確認して、未整理として保存します。</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          {imageUri ? (
            <View style={[styles.photoSourcePreview, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              <Image source={{ uri: imageUri }} style={styles.photoSourceImage} />
              <View style={styles.photoSourceTextBlock}>
                <Text style={[styles.photoSourceTitle, { color: colors.text }]}>登録画像</Text>
                <Text style={[styles.photoSourceText, { color: colors.muted }]}>この写真を商品の画像として保存します。</Text>
              </View>
            </View>
          ) : null}

          {!!result?.warnings?.length && (
            <View style={[styles.warningBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
              {result.warnings.slice(0, 3).map((warning, warningIndex) => (
                <Text key={`photo-warning-${warningIndex}-${warning}`} style={[styles.warningText, { color: colors.muted }]}>
                  {warning}
                </Text>
              ))}
            </View>
          )}

          {!!result && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.photoFormScroll}>
              <ManualGoodsForm
                initialBoxName={fallbackBoxName}
                initialSeriesName={result.seriesName}
                initialCharacterName={result.characterName}
                initialVariantName={variantName}
                initialImageUrl={imageUri}
                initialIsRandom={result.isRandom}
                initialStatus="unorganized"
                allowedStatuses={['owned', 'unorganized']}
                onSubmit={async (input) => {
                  await addGoods({
                    ...input,
                    imageUrl: imageUri && input.imageUrl === imageUri ? await persistPickedImage(imageUri) : input.imageUrl,
                    status: 'unorganized',
                  });
                  onClose();
                }}
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProductPreview({ result }: { result: ProductLookupResult }) {
  const { colors } = useAppTheme();
  return (
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
          {typeof result.confidence === 'number' ? (
            <Text style={[styles.productMeta, { color: colors.muted }]}>
              信頼度 {Math.round(result.confidence * 100)}%{result.sourceUrls?.length ? ` / 参照元 ${result.sourceUrls.length}件` : ''}
            </Text>
          ) : null}
        </View>
      </View>
      {!!result.warnings?.length && (
        <View style={[styles.warningBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
          {result.warnings.map((warning, warningIndex) => (
            <Text key={`product-warning-${warningIndex}-${warning}`} style={[styles.warningText, { color: colors.muted }]}>
              {warning}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  content: { gap: 10, padding: 14, paddingBottom: 120 },
  titleBlock: { gap: 2 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, lineHeight: 17 },
  flowSegment: { borderRadius: 8, flexDirection: 'row', gap: 4, padding: 4 },
  flowButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    justifyContent: 'center',
  },
  flowText: { fontSize: 13, fontWeight: '900' },
  segment: { borderRadius: 8, flexDirection: 'row', gap: 4, padding: 4 },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 7,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentText: { fontSize: 12, fontWeight: '900' },
  notice: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  storeSelector: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  storeSelectorHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  storeSelectorTitleBlock: { flexShrink: 0, width: 84 },
  storeSelectorLabel: { fontSize: 10, fontWeight: '800' },
  storeSelectorTitle: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  storeManageButton: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 5, height: 32, justifyContent: 'center', width: 32 },
  storeManageText: { fontSize: 12, fontWeight: '900' },
  storeChipScroll: { flex: 1 },
  storeChips: { gap: 8, paddingRight: 6 },
  storeChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, height: 32, maxWidth: 132, paddingHorizontal: 10 },
  storeChipText: { flexShrink: 1, fontSize: 12, fontWeight: '900' },
  storeSelectorHelp: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  cameraCard: { borderRadius: 8, borderWidth: 1, height: 272, overflow: 'hidden' },
  camera: { flex: 1 },
  guide: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 3,
    height: 96,
    marginTop: 68,
    width: '76%',
  },
  cameraStatus: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    left: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 14,
  },
  cameraStatusText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17 },
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
  receiptPanel: { alignItems: 'center', borderRadius: 8, borderWidth: 1, padding: 18 },
  receiptIcon: { marginBottom: 6 },
  alphaBadge: { borderRadius: 999, borderWidth: 1, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 4 },
  alphaBadgeText: { fontSize: 11, fontWeight: '900' },
  receiptTitle: { fontSize: 19, fontWeight: '900' },
  receiptText: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  receiptActions: { gap: 10, marginTop: 16, width: '100%' },
  receiptStatus: { fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: 12, textAlign: 'center' },
  checkCameraBox: { borderRadius: 8, borderWidth: 1, height: 150, marginTop: 14, overflow: 'hidden', width: '100%' },
  checkCamera: { flex: 1 },
  checkFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  checkResultBox: { borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 12, padding: 12, width: '100%' },
  checkResultTitle: { fontSize: 18, fontWeight: '900' },
  checkResultRow: { gap: 2 },
  checkResultName: { fontSize: 14, fontWeight: '900' },
  checkResultMeta: { fontSize: 12, fontWeight: '800' },
  quickList: { gap: 8, marginTop: 14, width: '100%' },
  quickRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 10,
  },
  quickText: { flex: 1 },
  quickTitle: { fontSize: 15, fontWeight: '900' },
  quickMeta: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  quickAdd: { alignItems: 'center', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  eventSummary: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 12,
    width: '100%',
  },
  eventSummaryLabel: { fontSize: 11, fontWeight: '800' },
  eventSummaryValue: { fontSize: 17, fontWeight: '900', marginTop: 2 },
  eventAddButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  eventAddText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  eventChips: { gap: 8, paddingTop: 14, width: '100%' },
  eventChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', paddingHorizontal: 12 },
  eventChipText: { fontSize: 12, fontWeight: '900' },
  eventQuantityControls: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  eventQuantityButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  eventQuantityText: { fontSize: 14, fontWeight: '900', minWidth: 20, textAlign: 'center' },
  eventDoneButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', paddingHorizontal: 12 },
  eventDoneText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  manualIntro: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  manualIntroText: { flex: 1 },
  manualIntroTitle: { fontSize: 16, fontWeight: '900' },
  manualIntroBody: { fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: 4 },
  receiptButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
  },
  receiptButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  secondaryReceiptButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
  },
  secondaryReceiptText: { fontSize: 15, fontWeight: '900' },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.36)', flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 8, borderTopRightRadius: 8, maxHeight: '86%', padding: 18 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  productResultContent: { paddingBottom: 24 },
  lineupSourceHelp: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 10 },
  photoSourcePreview: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 10,
  },
  photoSourceImage: { borderRadius: 6, height: 58, width: 58 },
  photoSourceTextBlock: { flex: 1 },
  photoSourceTitle: { fontSize: 14, fontWeight: '900' },
  photoSourceText: { fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 3 },
  photoFormScroll: { marginTop: 12 },
  productPreview: { borderRadius: 8, flexDirection: 'row', gap: 12, marginTop: 14, padding: 10 },
  productImage: { borderRadius: 6, borderWidth: 1, height: 72, overflow: 'hidden', width: 54 },
  productImageInner: { height: '100%', width: '100%' },
  productText: { flex: 1, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '900', lineHeight: 20 },
  productMeta: { fontSize: 12, marginTop: 5 },
  productCandidatePicker: { gap: 8, marginTop: 12 },
  productCandidateChips: { gap: 10, paddingRight: 6 },
  productCandidateChip: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 76,
    padding: 10,
    width: 230,
  },
  productCandidateText: { fontSize: 12, fontWeight: '900', lineHeight: 17 },
  productCandidateMeta: { fontSize: 11, fontWeight: '800', marginTop: 8 },
  rejectCandidateButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
  },
  rejectCandidateText: { fontSize: 12, fontWeight: '900' },
  seriesPicker: { marginTop: 12 },
  seriesPickerLabel: { fontSize: 12, fontWeight: '800', marginBottom: 7 },
  seriesInput: {
    borderRadius: 8,
    fontSize: 15,
    height: 44,
    paddingHorizontal: 12,
  },
  seriesChips: { gap: 8, paddingTop: 8 },
  seriesChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    maxWidth: 180,
    paddingHorizontal: 12,
  },
  seriesChipText: { fontSize: 12, fontWeight: '800' },
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
  lineupFeedbackActions: { flexDirection: 'row', gap: 8 },
  lineupFeedbackButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  receiptItem: { borderRadius: 8, borderWidth: 1, marginBottom: 12, padding: 12 },
  receiptQuery: { fontSize: 16, fontWeight: '900' },
  receiptRaw: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  receiptCandidate: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  receiptCandidateImage: { borderRadius: 6, borderWidth: 1, height: 54, overflow: 'hidden', width: 54 },
  receiptCandidateText: { flex: 1 },
  existingMatchBlock: { gap: 7, marginTop: 7, paddingHorizontal: 2 },
  existingMatchLabel: { fontSize: 11, fontWeight: '800' },
  existingMatchChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  existingMatchText: { flex: 1, fontSize: 12, fontWeight: '800' },
  existingMatchQuantity: { fontSize: 11, fontWeight: '900' },
  noCandidate: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  receiptFooter: { borderTopWidth: 1, gap: 10, paddingTop: 12 },
  receiptSelectionText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  registerSelectedButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
  },
  registerSelectedText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
