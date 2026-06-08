import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Pressable } from 'react-native';
import { COLORS } from '../theme';

/**
 * A floating spy "object" rendered at a specific (x,y) screen position.
 * The x/y coords are computed by ARScreen from GPS bearing + device heading.
 */
export default function ARDropObject({ x, y, drop, distance, onIntercept }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -14, duration: 1200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const canIntercept = distance < 30 || __DEV__;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          left: x - 40,
          top: y - 80,
          transform: [{ translateY: floatAnim }],
        },
      ]}
    >
      {/* Glowing ring behind object */}
      <Animated.View style={[styles.glow, { opacity: glowAnim }]} />

      <Text style={styles.emoji}>{drop.objectEmoji}</Text>

      <View style={styles.label}>
        <Text style={styles.codeName}>{drop.codeName}</Text>
        <Text style={styles.dist}>{Math.round(distance)}m</Text>
      </View>

      {canIntercept && (
        <Pressable onPress={onIntercept} style={styles.interceptBtn}>
          <Text style={styles.interceptText}>[ INTERCEPT ]</Text>
        </Pressable>
      )}

      {!canIntercept && (
        <Text style={styles.approach}>APPROACH TO INTERCEPT</Text>
      )}
    </Animated.View>
  );
}

const __DEV__ = true; // allow intercept at any distance in dev mode

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    width: 80,
  },
  glow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(61,255,110,0.25)',
    top: 0,
  },
  emoji: {
    fontSize: 44,
  },
  label: {
    alignItems: 'center',
    marginTop: 4,
  },
  codeName: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  dist: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: COLORS.amber,
    fontWeight: 'bold',
  },
  interceptBtn: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(61,255,110,0.1)',
  },
  interceptText: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  approach: {
    marginTop: 6,
    fontFamily: 'Courier New',
    fontSize: 9,
    color: COLORS.dimText,
    letterSpacing: 1,
  },
});
