import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMyStores } from '../src/store/MyStoreContext';
import { useAppTheme } from '../src/store/ThemeContext';

export default function MyStoresScreen() {
  const { colors } = useAppTheme();
  const { addStore, removeStore, selectStore, selectedStoreId, stores, updateStore } = useMyStores();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const submitStore = async () => {
    if (!name.trim() && !url.trim()) return;
    await addStore({ name, url, priority: !stores.length });
    setName('');
    setUrl('');
  };

  const confirmRemove = (id: string, storeName: string) => {
    Alert.alert('マイストアを削除しますか？', `「${storeName}」を検索候補から外します。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeStore(id) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>マイストア</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>登録時に選んだストアだけを優先して検索します。</Text>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>ストアを追加</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="ストア名 例: 公式通販"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
          />
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://example-store.jp/"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
          />
          <Pressable onPress={submitStore} style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <Ionicons color="#ffffff" name="add" size={20} />
            <Text style={styles.addButtonText}>追加する</Text>
          </Pressable>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>登録済みストア</Text>
          <Pressable
            onPress={() => selectStore(null)}
            style={[styles.storeRow, { backgroundColor: selectedStoreId ? colors.elevated : colors.text, borderColor: colors.border }]}
          >
            <Ionicons color={selectedStoreId ? colors.muted : colors.background} name="earth-outline" size={21} />
            <View style={styles.storeText}>
              <Text style={[styles.storeName, { color: selectedStoreId ? colors.text : colors.background }]}>指定なし</Text>
              <Text style={[styles.storeDomain, { color: selectedStoreId ? colors.muted : colors.background }]}>通常の検索順で探します</Text>
            </View>
            {!selectedStoreId ? <Ionicons color={colors.background} name="checkmark-circle" size={22} /> : null}
          </Pressable>

          {stores.map((store) => {
            const active = store.id === selectedStoreId;
            return (
              <View key={store.id} style={[styles.storeCard, { backgroundColor: active ? colors.text : colors.elevated, borderColor: active ? colors.text : colors.border }]}>
                <Pressable onPress={() => selectStore(store.id)} style={styles.storeMain}>
                  <Ionicons color={active ? colors.background : colors.primary} name="storefront-outline" size={22} />
                  <View style={styles.storeText}>
                    <Text numberOfLines={1} style={[styles.storeName, { color: active ? colors.background : colors.text }]}>{store.name}</Text>
                    <Text numberOfLines={1} style={[styles.storeDomain, { color: active ? colors.background : colors.muted }]}>{store.domain}</Text>
                  </View>
                  {active ? <Ionicons color={colors.background} name="checkmark-circle" size={22} /> : null}
                </Pressable>
                <View style={styles.storeActions}>
                  <Pressable
                    onPress={() => updateStore(store.id, { priority: !store.priority })}
                    style={[styles.smallAction, { borderColor: active ? colors.background : colors.border }]}
                  >
                    <Ionicons color={active ? colors.background : colors.primary} name={store.priority ? 'star' : 'star-outline'} size={17} />
                    <Text style={[styles.smallActionText, { color: active ? colors.background : colors.text }]}>優先</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmRemove(store.id, store.name)}
                    style={[styles.iconAction, { borderColor: active ? colors.background : colors.border }]}
                  >
                    <Ionicons color={active ? colors.background : colors.muted} name="trash-outline" size={17} />
                  </Pressable>
                </View>
              </View>
            );
          })}

          {!stores.length ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              公式通販やよく使うストアを登録すると、JAN検索失敗時にそのストアだけを優先検索できます。
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 96 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  backButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  panel: { borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  input: { borderRadius: 8, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
  addButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 46, justifyContent: 'center' },
  addButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  storeRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 62, padding: 12 },
  storeCard: { borderRadius: 8, borderWidth: 1, gap: 10, padding: 12 },
  storeMain: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  storeText: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 15, fontWeight: '900' },
  storeDomain: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  storeActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  smallAction: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 10 },
  smallActionText: { fontSize: 12, fontWeight: '900' },
  iconAction: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  emptyText: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
