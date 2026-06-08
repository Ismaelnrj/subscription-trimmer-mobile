import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Pressable, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { COLORS } from '../theme';
import { MISSIONS, DEV_MODE } from '../data/missions';
import ARDropObject from '../components/ARDropObject';
import { bearing, distanceMeters, magnetometerToHeading, angleDelta, offsetLatLng } from '../lib/geo';

const { width: W, height: H } = Dimensions.get('window');
const H_FOV = 60; // approximate camera horizontal field of view in degrees

export default function ARScreen({ navigation, route }) {
  const { dropId, dropLat, dropLng, secured: securedArr } = route.params;
  const drop = MISSIONS.find(m => m.id === dropId);

  const [permission, requestPermission] = useCameraPermissions();
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [dropCoords, setDropCoords] = useState({ lat: dropLat, lng: dropLng });

  const locationSub = useRef(null);
  const magSub = useRef(null);

  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        loc => {
          setUserPos(loc.coords);
          // In DEV_MODE recalculate drop position relative to current user pos
          if (DEV_MODE) {
            const c = offsetLatLng(
              loc.coords.latitude, loc.coords.longitude,
              drop.devOffset.northM, drop.devOffset.eastM,
            );
            setDropCoords(c);
          }
        },
      );

      Magnetometer.setUpdateInterval(100);
      magSub.current = Magnetometer.addListener(data => {
        setHeading(magnetometerToHeading(data));
      });
    })();

    return () => {
      locationSub.current?.remove();
      magSub.current?.remove();
    };
  }, []);

  if (!permission?.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera access needed for AR mode.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>[ GRANT CAMERA ]</Text>
        </Pressable>
      </View>
    );
  }

  const dist = userPos
    ? distanceMeters(userPos.latitude, userPos.longitude, dropCoords.lat, dropCoords.lng)
    : 999;

  const dropBearing = userPos
    ? bearing(userPos.latitude, userPos.longitude, dropCoords.lat, dropCoords.lng)
    : 0;

  // Horizontal angle between device facing direction and drop bearing
  const delta = angleDelta(heading, dropBearing); // -180 to +180
  const inView = Math.abs(delta) < H_FOV / 2 + 15; // wider than actual FOV for usability

  // Map delta to screen x: centre = W/2, ±(H_FOV/2) maps to ±(W/2)
  const screenX = W / 2 + (delta / (H_FOV / 2)) * (W / 2);
  // y: keep in middle vertical zone, slightly above centre
  const screenY = H * 0.4;

  function handleIntercept() {
    navigation.navigate('Decipher', { dropId, secured: securedArr });
  }

  return (
    <View style={styles.root}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* HUD overlay */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTop}>
          AR MODE  //  HDG {Math.round(heading).toString().padStart(3, '0')}°
        </Text>

        {/* Compass bar */}
        <View style={styles.compassBar}>
          {[-60,-45,-30,-15,0,15,30,45,60].map(off => {
            const deg = ((heading + off) + 360) % 360;
            return (
              <Text key={off} style={[styles.compassTick, off === 0 && styles.compassCentre]}>
                {compassLabel(deg)}
              </Text>
            );
          })}
        </View>

        {/* Drop bearing indicator at bottom */}
        <View style={styles.bearingBar}>
          <Text style={styles.bearingText}>
            {drop.codeName}  //  {Math.round(dist)}m  //  BRG {Math.round(dropBearing).toString().padStart(3, '0')}°
          </Text>
          <View style={styles.bearingArrowWrap}>
            <Text style={[styles.bearingArrow, { transform: [{ rotate: `${delta}deg` }] }]}>↑</Text>
          </View>
          {!inView && (
            <Text style={styles.lookTowards}>
              {delta > 0 ? 'TURN RIGHT →' : '← TURN LEFT'}
            </Text>
          )}
        </View>
      </View>

      {/* AR Object — only render when drop is roughly in camera view */}
      {inView && (
        <ARDropObject
          x={screenX}
          y={screenY}
          drop={drop}
          distance={dist}
          onIntercept={handleIntercept}
        />
      )}

      {/* Back button */}
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>[ ← RADAR ]</Text>
      </Pressable>
    </View>
  );
}

const COMPASS_LABELS = ['N','NE','E','SE','S','SW','W','NW'];
function compassLabel(deg) {
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_LABELS[(idx + 8) % 8];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permContainer: {
    flex: 1, backgroundColor: COLORS.bg,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  permText: {
    fontFamily: 'Courier New', color: COLORS.text, textAlign: 'center', marginBottom: 20,
  },
  permBtn: {
    borderWidth: 1, borderColor: COLORS.primary, padding: 12,
  },
  permBtnText: {
    fontFamily: 'Courier New', color: COLORS.primary, letterSpacing: 2,
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  hudTop: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    paddingTop: 50,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  compassBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  compassTick: {
    fontFamily: 'Courier New',
    color: COLORS.dimText,
    fontSize: 10,
    width: 22,
    textAlign: 'center',
  },
  compassCentre: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  bearingBar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 12,
    alignItems: 'center',
    paddingBottom: 30,
    gap: 6,
  },
  bearingText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 2,
  },
  bearingArrowWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bearingArrow: {
    color: COLORS.amber,
    fontSize: 26,
  },
  lookTowards: {
    fontFamily: 'Courier New',
    color: COLORS.amber,
    fontSize: 12,
    letterSpacing: 2,
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: COLORS.primaryDim,
  },
  backText: {
    fontFamily: 'Courier New',
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 1,
  },
});
