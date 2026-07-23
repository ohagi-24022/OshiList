import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getCharacterAccentColor } from '../lib/characterAccent';
import { isOshiGoods } from '../lib/oshi';
import { useProfile } from '../store/ProfileContext';
import { useAppTheme } from '../store/ThemeContext';
import { Goods } from '../types';

type Props = {
  item: Goods;
};

export function HomeGoodsTile({ item }: Props) {
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const markedAsOshi = isOshiGoods(item, profile);
  const characterColor = getCharacterAccentColor(item, colors);
  const markColor = profile.markColor || colors.primary;
  const markIcon = (profile.markIcon || 'heart') as keyof typeof Ionicons.glyphMap;
  const accentColor = markedAsOshi ? markColor : characterColor;

  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: accentColor ?? colors.border }]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.elevated }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <Ionicons color={colors.muted} name="image-outline" size={38} />
        )}
        {markedAsOshi ? (
          <View style={[styles.oshiBadge, { backgroundColor: markColor }]}>
            <Ionicons color="#ffffff" name={markIcon} size={13} />
            <Text style={styles.oshiText}>推し</Text>
          </View>
        ) : null}
        <View style={[styles.quantityBadge, { backgroundColor: characterColor ?? colors.primary }]}>
          <Text style={styles.quantityText}>{item.quantity}個</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.series, { color: colors.muted }]}>
        {item.seriesName}
      </Text>
      <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
        {item.boxName}
      </Text>
      <Text numberOfLines={1} style={[styles.meta, { color: accentColor ?? colors.muted }]}>
        {item.characterName} / {item.variantName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: 8,
  },
  imageWrap: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 7,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  image: { height: '100%', width: '100%' },
  oshiBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    left: 7,
    minHeight: 28,
    paddingHorizontal: 9,
    position: 'absolute',
    top: 7,
  },
  oshiText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  quantityBadge: {
    alignItems: 'center',
    borderRadius: 999,
    bottom: 7,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 50,
    paddingHorizontal: 11,
    position: 'absolute',
    right: 7,
  },
  quantityText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  series: { fontSize: 10, fontWeight: '800', lineHeight: 14, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '800', lineHeight: 15, marginTop: 3 },
});
