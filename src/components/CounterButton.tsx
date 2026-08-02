import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../store/ThemeContext';

type Props = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function CounterButton({ quantity, onDecrease, onIncrease }: Props) {
  const { colors } = useAppTheme();
  const pressWithoutOpeningCard = (event: GestureResponderEvent, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.elevated }]}>
      <Pressable accessibilityLabel="所持数を減らす" onPress={(event) => pressWithoutOpeningCard(event, onDecrease)} style={styles.button}>
        <Ionicons color={colors.text} name="remove" size={16} />
      </Pressable>
      <Text style={[styles.count, { color: colors.text }]}>{quantity}</Text>
      <Pressable accessibilityLabel="所持数を増やす" onPress={(event) => pressWithoutOpeningCard(event, onIncrease)} style={styles.button}>
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
