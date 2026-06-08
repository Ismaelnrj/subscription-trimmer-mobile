import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, SafeAreaView, Alert, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { COLORS } from '../theme';
import { MISSIONS, DEV_MODE } from '../data/missions';
import RadarDisplay from '../components/RadarDisplay';
import { distanceMeters, magnetometerToHeading, offsetLatLng } from '../lib/geo';

export default function RadarScreen({ navigation, route }) {
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [drops, setDrops] = useState([]);
  const [secured, setSecured] = useState(new Set(route.params?.secured ?? []));
  const locationSub = useRef(null);
  const magSub = useRef(null);

  // Compute absolute lat/lng for each drop once we have user position
  useEffect(() => {
    if (!userPos) return;
    const computed = MISSIONS.map(m => {
      const coords = DEV_MODE
        ? offsetLatLng(userPos.latitude, userPos.longitude, m.devOffset.northM, m.devOffset.eastM)
        : { lat: m.prodCoords.lat, lng: m.prodCoords.lng };
      return { ...m, lat: coords.lat, lng: coords.lng, secured: secured.has(m.id) };
    });
    setDrops(computed);
  }, [userPos, secured]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required to detect dead drops.');
        return;
      }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        loc => setUserPos(loc.coords),
      );
    })();

    Magnetometer.setUpdateInterval(200);
    magSub.current = Magnetometer.addListener(data => {
      setHeading(magnetometerToHeading(data));
    });

    return () => {
      locationSub.current?.remove();
      magSub.current?.remove();
    };
  }, []);

  const allSecured = secured.size === MISSIONS.length;

  function enterAR(drop) {
    navigation.navigate('AR', {
      dropId: drop.id,
      dropLat: drop.lat,
      dropLng: drop.lng,
      secured: [...secured],
    });
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>RADAR SWEEP</Text>
      <Text style={styles.sub}>
        {userPos ? `${drops.filter(d => !d.secured).length} DROP(S) ACTIVE` : 'ACQUIRING GPS...'}
      </Text>

      <RadarDisplay
        userLat={userPos?.latitude}
        userLng={userPos?.longitude}
        heading={heading}
        drops={drops}
      />

      <Text style={styles.compassLabel}>
        HDG {Math.round(heading).toString().padStart(3, '0')}°
      </Text>

      <ScrollView style={styles.dropList} contentContainerStyle={{ paddingBottom: 16 }}>
        {drops.map(drop => {
          const dist = userPos
            ? distanceMeters(userPos.latitude, userPos.longitude, drop.lat, drop.lng)
            : null;
          const isClose = dist != null && dist < 22;
          const isSecured = secured.has(drop.id);

          return (
            <View key={drop.id} style={[styles.dropRow, isSecured && styles.dropRowSecured]}>
              <Text style={styles.dropEmoji}>{drop.objectEmoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropName}>{drop.codeName}</Text>
                <Text style={styles.dropDist}>
                  {dist != null ? `${Math.round(dist)}m` : '---'}{' '}
                  {isSecured ? '[ SECURED ]' : isClose ? '[ IN RANGE ]' : ''}
                </Text>
              </View>
              {!isSecured && (
                <Pressable
                  style={[styles.arBtn, isClose && styles.arBtnActive]}
                  onPress={() => enterAR(drop)}
                >
                  <Text style={[styles.arBtnText, isClose && styles.arBtnTextActive]}>
                    {isClose ? '[ AR ]' : 'FAR'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {allSecured && (
        <Pressable
          style={styles.completeBtn}
          onPress={() => navigation.replace('Completed')}
        >
          <Text style={styles.completeBtnText}>[ TRANSMIT INTEL ]</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  title: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 14,
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 8,
  },
  sub: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  compassLabel: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 2,
  },
  dropList: { flex: 1, paddingHorizontal: 16 },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  dropRowSecured: { opacity: 0.4 },
  dropEmoji: { fontSize: 22 },
  dropName: {
    fontFamily: 'Courier New',
    color: COLORS.text,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  dropDist: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    marginTop: 2,
  },
  arBtn: {
    borderWidth: 1,
    borderColor: COLORS.dimText,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  arBtnActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(61,255,110,0.1)' },
  arBtnText: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    letterSpacing: 1,
  },
  arBtnTextActive: { color: COLORS.primary },
  completeBtn: {
    margin: 16,
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,184,0,0.08)',
  },
  completeBtnText: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 14,
    letterSpacing: 3,
  },
});
