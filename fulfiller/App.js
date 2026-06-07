import 'react-native-gesture-handler';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';

import { DriverSessionProvider } from './providers/DriverSessionProvider';
import Root from './navigation/RootNavigator';
import { INTER_FONTS, installInterFont } from './lib/fonts';
import { colors } from './lib/theme';

// Make Inter the app-wide default (weight-aware) before any Text renders.
installInterFont();

/**
 * KitUm Partner, app shell. All driver session state + the realtime/dispatch
 * engine live in DriverSessionProvider; navigation + screens live in RootNavigator.
 */
export default function App() {
  const [fontsLoaded] = useFonts(INTER_FONTS);

  // Brief brand-coloured hold until Inter is ready, avoids a system-font flash.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.primary }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <DriverSessionProvider>
            <Root />
          </DriverSessionProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
