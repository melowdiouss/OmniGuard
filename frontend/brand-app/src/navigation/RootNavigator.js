import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BrandLoginScreen } from '../screens/BrandLoginScreen';
import { ProductCodeScanScreen } from '../screens/ProductCodeScanScreen';
import { ProductImageCaptureScreen } from '../screens/ProductImageCaptureScreen';
import { PacketCodeScanScreen } from '../screens/PacketCodeScanScreen';
import { ReviewConfirmScreen } from '../screens/ReviewConfirmScreen';
import { SubmissionResultScreen } from '../screens/SubmissionResultScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="BrandLogin" screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="BrandLogin" component={BrandLoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductCodeScan" component={ProductCodeScanScreen} options={{ title: 'Product Code' }} />
      <Stack.Screen name="ProductImageCapture" component={ProductImageCaptureScreen} options={{ title: 'Product Image' }} />
      <Stack.Screen name="PacketCodeScan" component={PacketCodeScanScreen} options={{ title: 'Packet Code' }} />
      <Stack.Screen name="ReviewConfirm" component={ReviewConfirmScreen} options={{ title: 'Review' }} />
      <Stack.Screen name="SubmissionResult" component={SubmissionResultScreen} options={{ title: 'Result' }} />
    </Stack.Navigator>
  );
}
