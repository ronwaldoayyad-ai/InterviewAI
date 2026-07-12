import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { colors } from '../theme';

const BAR_COUNT = 24;

// Animated voice waveform shown while recording (PRD §4.2 real-time indicators)
export default function Waveform({ active, tint = colors.primary, height = 44 }) {
  const anims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) => a.setValue(0.2));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: 0.35 + Math.random() * 0.65,
            duration: 220 + (i % 5) * 60,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(a, {
            toValue: 0.15 + Math.random() * 0.25,
            duration: 220 + (i % 4) * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height,
        gap: 3,
      }}
    >
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            borderRadius: 2,
            backgroundColor: active ? tint : colors.border,
            height: a.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
          }}
        />
      ))}
    </View>
  );
}
