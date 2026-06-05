import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../lib/theme';
import { contactSupport } from '../lib/support';
import { useDriverSession } from '../providers/DriverSessionProvider';

import LoginScreen from '../screens/LoginScreen';
import { HomeMain } from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EarningsScreen from '../screens/EarningsScreen';
import AccountScreen from '../screens/AccountScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import KycScreen from '../screens/KycScreen';
import BankDetailsScreen from '../screens/BankDetailsScreen';
import ActiveJob from '../screens/ActiveJob';
import IncomingRequest from '../screens/IncomingRequest';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ---------------- Home tab (the dashboard) ---------------- */
function HomeTab({ navigation }) {
  const s = useDriverSession();
  // Map HomeMain's legacy view keys onto the navigator.
  const navigate = (key) => {
    if (key === 'history') return navigation.navigate('Trips');
    const route = { profile: 'Profile', settings: 'Settings', kyc: 'Kyc', bank: 'Bank' }[key];
    if (route) navigation.navigate('Account', { screen: route });
  };
  return (
    <HomeMain
      user={s.user}
      online={s.online}
      onToggleOnline={s.toggleOnline}
      earnings={s.earnings}
      onLogout={s.handleLogout}
      pending={s.pending}
      eligible={s.eligible}
      kycStatus={s.kycStatus}
      bankComplete={s.bankComplete}
      syncing={s.pendingSync}
      navigate={navigate}
      openSupport={contactSupport}
    />
  );
}

function TripsTab() {
  return <HistoryScreen />; // no onBack → Header renders without a back chevron (it's a tab)
}

/* ---------------- Account stack ---------------- */
function ProfileRoute({ navigation }) {
  const s = useDriverSession();
  return <ProfileScreen user={s.user} onBack={navigation.goBack} />;
}
function SettingsRoute({ navigation }) {
  const s = useDriverSession();
  return <SettingsScreen user={s.user} onBack={navigation.goBack} onLogout={s.handleLogout} onSupport={contactSupport} />;
}
function KycRoute({ navigation }) {
  const s = useDriverSession();
  return <KycScreen user={s.user} onBack={navigation.goBack} />;
}
function BankRoute({ navigation }) {
  const s = useDriverSession();
  return <BankDetailsScreen user={s.user} onBack={navigation.goBack} />;
}

function AccountStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountHome" component={AccountScreen} />
      <Stack.Screen name="Profile" component={ProfileRoute} />
      <Stack.Screen name="Settings" component={SettingsRoute} />
      <Stack.Screen name="Kyc" component={KycRoute} />
      <Stack.Screen name="Bank" component={BankRoute} />
    </Stack.Navigator>
  );
}

/* ---------------- Tabs ---------------- */
const TAB_ICON = { Home: 'home', Earnings: 'trending-up', Trips: 'clock', Account: 'user' };

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Feather name={TAB_ICON[route.name] || 'circle'} size={22} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Trips" component={TripsTab} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
}

/* ---------------- Root (auth gate → tabs + live-delivery takeovers) ---------------- */
export default function Root() {
  const s = useDriverSession();

  if (!s.accessToken) return <LoginScreen />;

  if (s.booting) {
    return (
      <View style={styles.splash}>
        <Image source={require('../assets/logo.png')} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: spacing.lg }} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Tabs />
      </NavigationContainer>

      {/* Live-delivery takeovers — driven by session state, rendered over the tabs. */}
      {s.job && (
        <View style={StyleSheet.absoluteFill}>
          <ActiveJob
            job={s.job}
            status={s.status}
            paid={s.paid}
            onAdvance={s.advance}
            onAbandon={s.abandonJob}
            onReportNoShow={s.reportNoShow}
          />
        </View>
      )}
      {s.offer && <IncomingRequest offer={s.offer} onAccept={s.acceptOffer} onReject={s.rejectOffer} />}

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#263CF2' },
  splashLogo: { width: 240, height: 150 },
});
