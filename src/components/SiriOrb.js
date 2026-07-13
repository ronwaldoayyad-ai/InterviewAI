import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

// iOS 27-style Siri orb: liquid-glass droplet with swirling multi-colored
// glow. Drops in from the top of the screen (a nod to the Dynamic Island)
// and animates by state: speaking | countdown | listening | processing.
const SPEED = { speaking: 2600, countdown: 4200, listening: 1800, processing: 6000 };
const PULSE = { speaking: 1.08, countdown: 1.05, listening: 1.16, processing: 1.03 };

export default function SiriOrb({ state = 'speaking', size = 84 }) {
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.5)).current;
  const drop = useRef(new Animated.Value(0)).current;

  // Droplet entrance from the top edge, with a liquid overshoot
  useEffect(() => {
    drop.setValue(0);
    Animated.spring(drop, {
      toValue: 1,
      tension: 26,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const speed = SPEED[state] || 3000;
    const spinLoopA = Animated.loop(
      Animated.timing(spinA, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: true })
    );
    const spinLoopB = Animated.loop(
      Animated.timing(spinB, { toValue: 1, duration: speed * 1.6, easing: Easing.linear, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: PULSE[state] || 1.06, duration: speed / 3, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.97, duration: speed / 3, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.9, duration: speed / 2.5, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.45, duration: speed / 2.5, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    spinA.setValue(0);
    spinB.setValue(0);
    spinLoopA.start();
    spinLoopB.start();
    pulseLoop.start();
    glowLoop.start();
    return () => {
      spinLoopA.stop();
      spinLoopB.stop();
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [state]);

  const rotA = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotB = spinB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: [-size * 2.2, 0] });
  const dropScaleY = drop.interpolate({
    inputRange: [0, 0.7, 0.85, 1],
    outputRange: [1.25, 1.12, 0.94, 1], // stretch while falling, squash on landing
  });
  const c = size / 2;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: dropY }, { scaleY: dropScaleY }, { scale: pulse }],
      }}
      pointerEvents="none"
    >
      {/* Outer glow halo */}
      <Animated.View style={{ position: 'absolute', width: size * 1.7, height: size * 1.7, opacity: glow }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="35%" stopColor="#7c6cff" stopOpacity="0.55" />
              <Stop offset="70%" stopColor="#4fd2ff" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#4fd2ff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#halo)" />
        </Svg>
      </Animated.View>

      {/* Glass sphere with swirling color layers */}
      <View style={[styles.orbClip, { width: size, height: size, borderRadius: c }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="base" cx="50%" cy="42%" r="65%">
              <Stop offset="0%" stopColor="#dff3ff" stopOpacity="0.95" />
              <Stop offset="45%" stopColor="#7ab8ff" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#3b4fd8" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill="url(#base)" />
        </Svg>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotA }] }]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="blobA" cx="30%" cy="30%" r="60%">
                <Stop offset="0%" stopColor="#ff5fa2" stopOpacity="0.9" />
                <Stop offset="55%" stopColor="#b06cff" stopOpacity="0.5" />
                <Stop offset="100%" stopColor="#b06cff" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={c * 0.65} cy={c * 0.7} rx={c * 0.85} ry={c * 0.62} fill="url(#blobA)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotB }] }]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="blobB" cx="70%" cy="65%" r="60%">
                <Stop offset="0%" stopColor="#3ef2d0" stopOpacity="0.85" />
                <Stop offset="55%" stopColor="#38b6ff" stopOpacity="0.45" />
                <Stop offset="100%" stopColor="#38b6ff" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={c * 1.3} cy={c * 1.25} rx={c * 0.9} ry={c * 0.66} fill="url(#blobB)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotA }, { scale: 1.05 }] }]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="blobC" cx="50%" cy="85%" r="55%">
                <Stop offset="0%" stopColor="#ffb45f" stopOpacity="0.75" />
                <Stop offset="60%" stopColor="#ff5fa2" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#ff5fa2" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={c} cy={c * 1.55} rx={c * 0.8} ry={c * 0.5} fill="url(#blobC)" />
          </Svg>
        </Animated.View>

        {/* Liquid-glass sheen: bright specular highlight up top */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="sheen" cx="38%" cy="18%" r="45%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="rim" cx="50%" cy="50%" r="50%">
              <Stop offset="82%" stopColor="#ffffff" stopOpacity="0" />
              <Stop offset="96%" stopColor="#ffffff" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={c * 0.78} cy={c * 0.48} rx={c * 0.62} ry={c * 0.42} fill="url(#sheen)" />
          <Circle cx={c} cy={c} r={c} fill="url(#rim)" />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orbClip: {
    overflow: 'hidden',
    shadowColor: '#7c6cff',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
});
