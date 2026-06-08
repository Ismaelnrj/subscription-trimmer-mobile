import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, SafeAreaView } from 'react-native';
import { COLORS } from '../theme';
import { STORY } from '../data/missions';

const LINES = [
  '  ██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗',
  '  ██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝',
  '  ██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ',
  '  ╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ',
  '   ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ',
  '    ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝  ',
];

export default function CompletedScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {LINES.map((line, i) => (
          <Text key={i} style={styles.ascii}>{line}</Text>
        ))}

        <Text style={styles.missionName}>{STORY.missionName}</Text>
        <Text style={styles.status}>STATUS: COMPLETE</Text>

        <View style={styles.intelBox}>
          <Text style={styles.intelTitle}>// ASSEMBLED INTEL</Text>
          <Text style={styles.intelText}>{STORY.finalIntel}</Text>
        </View>

        <Text style={styles.sign}>
          {STORY.agentName} — MISSION ACCOMPLISHED
        </Text>

        <Pressable
          style={styles.replayBtn}
          onPress={() => navigation.replace('Briefing')}
        >
          <Text style={styles.replayText}>[ NEW MISSION ]</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 12 },
  ascii: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 6.5,
    lineHeight: 9,
  },
  missionName: {
    fontFamily: 'Courier New',
    color: COLORS.textBright,
    fontSize: 14,
    letterSpacing: 3,
    marginTop: 12,
  },
  status: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 12,
    letterSpacing: 4,
  },
  intelBox: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    padding: 16,
    alignSelf: 'stretch',
  },
  intelTitle: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    marginBottom: 8,
  },
  intelText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 12,
    lineHeight: 20,
  },
  sign: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  replayBtn: {
    borderWidth: 1,
    borderColor: COLORS.primaryDim,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  replayText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 13,
    letterSpacing: 2,
  },
});
