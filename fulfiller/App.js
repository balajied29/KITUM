import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DriverSessionProvider } from './providers/DriverSessionProvider';
import Root from './navigation/RootNavigator';

/**
 * KitUm Partner — app shell. All driver session state + the realtime/dispatch
 * engine live in DriverSessionProvider; navigation + screens live in RootNavigator.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DriverSessionProvider>
          <Root />
        </DriverSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
