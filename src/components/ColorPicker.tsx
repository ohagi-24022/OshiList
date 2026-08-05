import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { hexToHsv, hslToHex, hsvToHex, HsvColor } from '../lib/color';
import { useAppTheme } from '../store/ThemeContext';

const sliderSteps = Array.from({ length: 24 }, (_, index) => index / 23);
const colorAreaColumns = Array.from({ length: 12 }, (_, index) => index / 11);
const colorAreaRows = Array.from({ length: 8 }, (_, index) => index / 7);

type Props = {
  compact?: boolean;
  value: string;
  onChange: (hex: string) => void;
};

export function ColorPicker({ compact = false, value, onChange }: Props) {
  const { colors } = useAppTheme();
  const hsv = useMemo(() => hexToHsv(value), [value]);
  const previewTextColor = hsv.v > 62 && hsv.s < 75 ? '#111111' : '#ffffff';
  const updateHsv = (patch: Partial<HsvColor>) => {
    onChange(hsvToHex({ ...hsv, ...patch }));
  };

  return (
    <View style={[styles.colorPicker, compact && styles.compactColorPicker]}>
      {!compact ? (
        <View style={[styles.colorPreviewLarge, { backgroundColor: value, borderColor: colors.border }]}>
          <Text style={[styles.colorPreviewText, { color: previewTextColor }]}>{value.toUpperCase()}</Text>
        </View>
      ) : null}
      <ColorArea hsv={hsv} onChange={(s, v) => updateHsv({ s, v })} />
      <ColorSlider
        label="色相"
        value={hsv.h}
        max={360}
        valueText={`${hsv.h}`}
        getColor={(ratio) => hslToHex({ h: Math.round(ratio * 360), s: 86, l: 54 })}
        onChange={(next) => updateHsv({ h: next })}
        onNudge={(amount) => updateHsv({ h: Math.max(0, Math.min(360, hsv.h + amount)) })}
      />
    </View>
  );
}

function ColorArea({ hsv, onChange }: { hsv: HsvColor; onChange: (saturation: number, value: number) => void }) {
  const { colors } = useAppTheme();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const saturationRatio = Math.max(0, Math.min(1, hsv.s / 100));
  const valueRatio = Math.max(0, Math.min(1, hsv.v / 100));

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}
      style={[styles.colorArea, { borderColor: colors.border }]}
    >
      {colorAreaRows.map((row) => (
        <View key={`row-${row}`} style={styles.colorAreaRow}>
          {colorAreaColumns.map((column) => (
            <Pressable
              key={`cell-${row}-${column}`}
              onPress={() => onChange(Math.round(column * 100), Math.round((1 - row) * 100))}
              style={[
                styles.colorAreaCell,
                { backgroundColor: hsvToHex({ h: hsv.h, s: Math.round(column * 100), v: Math.round((1 - row) * 100) }) },
              ]}
            />
          ))}
        </View>
      ))}
      <View
        pointerEvents="none"
        style={[
          styles.colorAreaThumb,
          {
            borderColor: colors.text,
            left: saturationRatio * size.width,
            top: (1 - valueRatio) * size.height,
          },
        ]}
      />
    </View>
  );
}

function ColorSlider({
  label,
  value,
  max,
  valueText,
  getColor,
  onChange,
  onNudge,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  getColor: (ratio: number) => string;
  onChange: (value: number) => void;
  onNudge: (amount: number) => void;
}) {
  const { colors } = useAppTheme();
  const ratio = Math.max(0, Math.min(1, value / max));

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.pickerHeader}>
        <View>
          <Text style={[styles.pickerLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.pickerValue, { color: colors.muted }]}>{valueText}</Text>
        </View>
        <View style={styles.nudgeRow}>
          <Pressable onPress={() => onNudge(-5)} style={[styles.nudgeButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[styles.nudgeText, { color: colors.text }]}>-</Text>
          </Pressable>
          <Pressable onPress={() => onNudge(5)} style={[styles.nudgeButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[styles.nudgeText, { color: colors.text }]}>+</Text>
          </Pressable>
        </View>
      </View>
      <View
        style={[styles.sliderTrack, { borderColor: colors.border }]}
      >
        {sliderSteps.map((step) => (
          <Pressable
            key={`${label}-${step}`}
            onPress={() => onChange(Math.round(step * max))}
            style={[styles.sliderSegment, { backgroundColor: getColor(step) }]}
          />
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

const styles = StyleSheet.create({
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
  colorArea: {
    borderRadius: 8,
    borderWidth: 1,
    height: 188,
    overflow: 'visible',
    position: 'relative',
  },
  colorAreaRow: { flex: 1, flexDirection: 'row' },
  colorAreaCell: { flex: 1 },
  colorAreaThumb: {
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderWidth: 3,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    position: 'absolute',
    width: 28,
  },
  sliderBlock: { gap: 8 },
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
  nudgeText: { fontSize: 20, fontWeight: '900' },
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
});
