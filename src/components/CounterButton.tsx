import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../store/ThemeContext';

type Props = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function CounterButton({ quantity, onDecrease, onIncrease }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.elevated }]}>
      <Pressable accessibilityLabel="所持数を減らす" onPress={onDecrease} style={styles.button}>
        <Ionicons color={colors.text} name="remove" size={16} />
      </Pressable>
      <Text style={[styles.count, { color: colors.text }]}>{quantity}</Text>
      <Pressable accessibilityLabel="所持数を増やす" onPress={onIncrease} style={styles.button}>
        <Ionicons color={colors.text} name="add" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    height: 34,
    overflow: 'hidden',
  },
  button: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
});
