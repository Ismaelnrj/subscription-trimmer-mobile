import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../theme';
import { bearing, distanceMeters, angleDelta } from '../lib/geo';

const SIZE = Math.min(Dimensions.get('window').width * 0.85, 320);
const RADIUS = SIZE / 2;
const RINGS = [0.3, 0.6, 1.0]; // fraction of radius for distance rings

/** Distance rings in metres mapped to RINGS fractions */
const RING_METERS = [30, 60, 100];

function metersToRadius(m) {
  const maxM = RING_METERS[RING_METERS.length - 1];
  return Math.min(m / maxM, 1) * RADIUS * 0.9;
}

export default function RadarDisplay({ userLat, userLng, heading, drops }) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2800, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scanRotate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: SIZE, height: SIZE, borderRadius: RADIUS }]}>
      {/* Distance rings */}
      {RINGS.map((r, i) => (
        <View key={i} style={[styles.ring, {
          width: SIZE * r, height: SIZE * r,
          borderRadius: (SIZE * r) / 2,
          top: RADIUS - (SIZE * r) / 2,
          left: RADIUS - (SIZE * r) / 2,
        }]} />
      ))}

      {/* Ring labels */}
      {RING_METERS.map((m, i) => (
        <Text key={i} style={[styles.ringLabel, {
          top: RADIUS - (SIZE * RINGS[i]) / 2 - 14,
          left: RADIUS + 4,
        }]}>
          {m}m
        </Text>
      ))}

      {/* Cross-hairs */}
      <View style={styles.crossH} />
      <View style={styles.crossV} />

      {/* Scan sweep */}
      <Animated.View style={[styles.sweep, { transform: [{ rotate: scanRotate }] }]} />

      {/* North indicator */}
      <View style={[styles.northDot, { top: 4, left: RADIUS - 5 }]}>
        <Text style={styles.northLabel}>N</Text>
      </View>

      {/* Dead drop blips */}
      {drops.map(drop => {
        if (userLat == null || userLng == null) return null;
        const dist = distanceMeters(userLat, userLng, drop.lat, drop.lng);
        const brng = bearing(userLat, userLng, drop.lat, drop.lng);
        const relAngle = angleDelta(heading ?? 0, brng);
        const rads = toRad(brng - (heading ?? 0));
        const r = metersToRadius(dist);
        const bx = RADIUS + r * Math.sin(rads);
        const by = RADIUS - r * Math.cos(rads);
        const isClose = dist < 22;
        const isSecured = drop.secured;

        return (
          <Animated.View
            key={drop.id}
            style={[styles.blip,
              isSecured && styles.blipSecured,
              isClose && !isSecured && { transform: [{ scale: pulseAnim }] },
              { left: bx - 7, top: by - 7 }
            ]}
          >
            <Text style={styles.blipEmoji}>{drop.objectEmoji}</Text>
          </Animated.View>
        );
      })}

      {/* Centre dot (you) */}
      <View style={styles.centre} />
    </View>
  );
}

function toRad(deg) { return deg * Math.PI / 180; }

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020d02',
    borderWidth: 2,
    borderColor: COLORS.primaryDim,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: COLORS.primaryDim,
  },
  ringLabel: {
    position: 'absolute',
    fontFamily: 'Courier New',
    fontSize: 9,
    color: COLORS.dimText,
  },
  crossH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.primaryDim,
    opacity: 0.4,
  },
  crossV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.primaryDim,
    opacity: 0.4,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    left: RADIUS - 2,
    width: RADIUS,
    height: RADIUS,
    transformOrigin: '0% 100%',
    backgroundColor: 'transparent',
    borderTopRightRadius: RADIUS,
    // gradient-like effect via a rotated thin wedge
    borderTopWidth: RADIUS,
    borderRightWidth: RADIUS,
    borderTopColor: 'rgba(61,255,110,0.22)',
    borderRightColor: 'transparent',
  },
  northLabel: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: COLORS.amber,
    fontWeight: 'bold',
  },
  northDot: {
    position: 'absolute',
    alignItems: 'center',
  },
  blip: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(61,255,110,0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blipSecured: {
    borderColor: COLORS.dimText,
    opacity: 0.4,
  },
  blipEmoji: {
    fontSize: 12,
  },
  centre: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.amber,
    left: RADIUS - 5,
    top: RADIUS - 5,
  },
});
