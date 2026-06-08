import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  Animated, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../theme';
import { MISSIONS } from '../data/missions';
import { autoDecode } from '../lib/ciphers';

function normalize(s) {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export default function DecipherScreen({ navigation, route }) {
  const { dropId, secured: securedArr } = route.params;
  const drop = MISSIONS.find(m => m.id === dropId);

  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const flashAnim = useRef(new Animated.Value(1)).current;

  function flash(color) {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (normalize(input) === normalize(drop.plaintext)) {
      setSolved(true);
      setFeedback('');
      flash();
    } else {
      setFeedback('DECRYPTION FAILED. RETRY.');
      flash();
    }
  }

  function handleAutoDecrypt() {
    const [best] = autoDecode(drop.ciphertext);
    if (best) {
      setAutoResult({ cipher: best.cipher, text: best.plaintext });
    }
  }

  function handleContinue() {
    const newSecured = [...new Set([...securedArr, dropId])];
    navigation.replace('Radar', { secured: newSecured });
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>INTERCEPTED TRANSMISSION</Text>
          <Text style={styles.dropLabel}>{drop.codeName}  //  {drop.cipherType.toUpperCase()}</Text>

          <View style={styles.cipherBox}>
            <Text style={styles.cipherLabel}>// RAW CIPHERTEXT</Text>
            <Text style={styles.cipherText}>{drop.ciphertext}</Text>
          </View>

          {!solved ? (
            <>
              <View style={styles.row}>
                <Pressable style={styles.smallBtn} onPress={() => setShowHint(!showHint)}>
                  <Text style={styles.smallBtnText}>[ HINT ]</Text>
                </Pressable>
                <Pressable style={styles.smallBtn} onPress={handleAutoDecrypt}>
                  <Text style={styles.smallBtnText}>[ AUTO-DECRYPT ]</Text>
                </Pressable>
              </View>

              {showHint && (
                <Text style={styles.hint}>CIPHER: {drop.cipherType.toUpperCase()}</Text>
              )}

              {autoResult && (
                <View style={styles.autoBox}>
                  <Text style={styles.autoLabel}>ENGINE RESULT  [{autoResult.cipher.toUpperCase()}]</Text>
                  <Text style={styles.autoText}>{autoResult.text}</Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="ENTER DECODED MESSAGE..."
                placeholderTextColor={COLORS.dimText}
                autoCapitalize="characters"
                onSubmitEditing={handleSubmit}
              />

              {feedback ? (
                <Text style={styles.error}>{feedback}</Text>
              ) : null}

              <Pressable style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitText}>[ SUBMIT DECRYPTION ]</Text>
              </Pressable>
            </>
          ) : (
            <Animated.View style={[styles.solvedBox, { opacity: flashAnim }]}>
              <Text style={styles.solvedTitle}>// DROP SECURED</Text>
              <Text style={styles.solvedPlain}>{drop.plaintext}</Text>
              <Text style={styles.fragment}>INTEL FRAGMENT: {drop.intelFragment}</Text>
              <Pressable style={styles.continueBtn} onPress={handleContinue}>
                <Text style={styles.continueText}>[ RETURN TO RADAR ]</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  title: {
    fontFamily: 'Courier New',
    color: COLORS.red,
    fontSize: 12,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 4,
  },
  dropLabel: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 20,
  },
  cipherBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 16,
  },
  cipherLabel: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    marginBottom: 8,
  },
  cipherText: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  smallBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primaryDim,
    padding: 8,
    alignItems: 'center',
  },
  smallBtnText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  autoBox: {
    borderWidth: 1,
    borderColor: COLORS.primaryDim,
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    marginBottom: 12,
  },
  autoLabel: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    marginBottom: 4,
  },
  autoText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.textBright,
    fontFamily: 'Courier New',
    fontSize: 13,
    padding: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  error: {
    fontFamily: 'Courier New',
    color: COLORS.red,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  submitBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(61,255,110,0.07)',
  },
  submitText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 13,
    letterSpacing: 2,
  },
  solvedBox: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(61,255,110,0.06)',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  solvedTitle: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 16,
    letterSpacing: 3,
  },
  solvedPlain: {
    fontFamily: 'Courier New',
    color: COLORS.textBright,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  fragment: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
  },
  continueBtn: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    backgroundColor: 'rgba(255,184,0,0.07)',
  },
  continueText: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 12,
    letterSpacing: 2,
  },
});
