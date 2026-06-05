import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, StyleSheet, TouchableOpacity, Easing } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';
import Icon from './Icon';

/**
 * A continuously scrolling (marquee) banner — used to keep nudging a partner for
 * something (e.g. bank/settlement details) without taking over the screen.
 * Tap to act. Animation is native-driven (translateX) so it stays smooth.
 */
export default function Marquee({ text, onPress, icon = 'credit-card', tone = 'primary' }) {
  const [trackW, setTrackW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trackW || !textW) return undefined;
    const distance = trackW + textW;
    const duration = (distance / 55) * 1000; // ~55px per second
    x.setValue(trackW);
    const anim = Animated.loop(
      Animated.timing(x, { toValue: -textW, duration, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [trackW, textW, x]);

  const palette =
    tone === 'warning'
      ? { bg: colors.warningSoft, fg: colors.warning }
      : { bg: colors.primarySoft, fg: colors.primary };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Icon name={icon} size={16} color={palette.fg} style={{ marginRight: spacing.sm }} />
      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.animated, { transform: [{ translateX: x }] }]}>
          <Text numberOfLines={1} onLayout={(e) => setTextW(e.nativeEvent.layout.width)} style={[styles.text, { color: palette.fg }]}>
            {text}
          </Text>
        </Animated.View>
      </View>
      <Icon name="chevron-right" size={18} color={palette.fg} style={{ marginLeft: spacing.sm }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, overflow: 'hidden' },
  track: { flex: 1, height: 20, overflow: 'hidden', justifyContent: 'center' },
  animated: { position: 'absolute', flexDirection: 'row' },
  text: { fontSize: 13, fontWeight: '700' },
});
