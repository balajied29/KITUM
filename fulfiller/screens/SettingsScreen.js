import { ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, spacing } from '../lib/theme';
import { Header, Card, MenuRow, SectionLabel } from '../components/ui';
import { contactSupport } from '../lib/support';

export default function SettingsScreen({ user, onBack, onLogout, onSupport }) {
  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionLabel style={styles.label}>Account</SectionLabel>
        <Card padded={false} style={styles.card}>
          <MenuRow icon="user" label="Name" value={user?.name} />
          <MenuRow icon="mail" label="Email" value={user?.email} />
          <MenuRow icon="award" label="Role" value="Delivery Partner" last />
        </Card>

        <SectionLabel style={styles.label}>Support</SectionLabel>
        <Card padded={false} style={styles.card}>
          <MenuRow icon="help-circle" label="Help & support" onPress={onSupport || contactSupport} />
          <MenuRow icon="shield" label="Privacy policy" onPress={() => Linking.openURL('https://kitum.app/privacy').catch(() => {})} />
          <MenuRow icon="info" label="App version" value={version} last />
        </Card>

        <Card padded={false} style={styles.card}>
          <MenuRow icon="log-out" label="Sign out" danger onPress={onLogout} last />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm },
  label: { marginBottom: spacing.sm, marginTop: spacing.md },
  card: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
});
