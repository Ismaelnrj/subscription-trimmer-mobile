import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, SafeAreaView,
} from 'react-native';
import { COLORS } from '../theme';
import { STORY } from '../data/missions';

export default function BriefingScreen({ navigation }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [typedLine, setTypedLine] = useState('');
  const [done, setDone] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    typeLines();
  }, []);

  async function typeLines() {
    for (let i = 0; i < STORY.briefing.length; i++) {
      const line = STORY.briefing[i];
      setVisibleLines(i);
      for (let c = 0; c <= line.length; c++) {
        setTypedLine(line.slice(0, c));
        await sleep(28);
      }
      await sleep(300);
    }
    setVisibleLines(STORY.briefing.length);
    setTypedLine('');
    await sleep(600);
    setDone(true);
  }

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.inner, { opacity: fadeIn }]}>
        <Text style={styles.stamp}>// CLASSIFIED //</Text>
        <Text style={styles.missionName}>{STORY.missionName}</Text>
        <Text style={styles.agentLabel}>BRIEFING FOR: {STORY.agentName}</Text>

        <View style={styles.terminal}>
          {STORY.briefing.slice(0, visibleLines).map((line, i) => (
            <Text key={i} style={styles.line}>{line}</Text>
          ))}
          {visibleLines < STORY.briefing.length && (
            <Text style={styles.line}>{typedLine}<Text style={styles.cursor}>█</Text></Text>
          )}
        </View>

        {done && (
          <Pressable
            style={styles.btn}
            onPress={() => navigation.replace('Radar')}
          >
            <Text style={styles.btnText}>[ BEGIN MISSION ]</Text>
          </Pressable>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  stamp: {
    fontFamily: 'Courier New',
    color: COLORS.red,
    fontSize: 11,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 8,
  },
  missionName: {
    fontFamily: 'Courier New',
    color: COLORS.textBright,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
  },
  agentLabel: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 32,
  },
  terminal: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 16,
    minHeight: 160,
  },
  line: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  cursor: {
    color: COLORS.primary,
  },
  btn: {
    marginTop: 36,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(61,255,110,0.07)',
  },
  btnText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 15,
    letterSpacing: 3,
  },
});
