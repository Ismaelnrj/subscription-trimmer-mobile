import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import BriefingScreen from './src/screens/BriefingScreen';
import RadarScreen from './src/screens/RadarScreen';
import ARScreen from './src/screens/ARScreen';
import DecipherScreen from './src/screens/DecipherScreen';
import CompletedScreen from './src/screens/CompletedScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#080d08" />
      <Stack.Navigator
        initialRouteName="Briefing"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Briefing" component={BriefingScreen} />
        <Stack.Screen name="Radar" component={RadarScreen} />
        <Stack.Screen name="AR" component={ARScreen} />
        <Stack.Screen name="Decipher" component={DecipherScreen} />
        <Stack.Screen name="Completed" component={CompletedScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
