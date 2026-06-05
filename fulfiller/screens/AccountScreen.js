import { SafeAreaView, ScrollView, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../lib/theme';
import { Card, Avatar, MenuRow, SectionLabel, Pill } from '../components/ui';
import { contactSupport } from '../lib/support';
import { useDriverSession } from '../providers/DriverSessionProvider';

export default function AccountScreen({ navigation }) {
  const { user, kycStatus, bankComplete, eligible, handleLogout } = useDriverSession();
  const kycValue =
    kycStatus === 'verified' ? 'Verified'
    : kycStatus === 'pending' ? 'In review'
    : kycStatus === 'rejected' ? 'Action needed'
    : 'Required';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Avatar name={user?.name} size={64} />
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Partner'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{user?.phone || user?.email || ''}</Text>
          </View>
          <Pill label={eligible ? 'Active' : 'Setup'} tone={eligible ? 'success' : 'warning'} />
        </View>

        <SectionLabel style={styles.label}>Account</SectionLabel>
        <Card padded={false} style={styles.card}>
          <MenuRow icon="user" label="Profile & vehicle" onPress={() => navigation.navigate('Profile')} />
          <MenuRow icon="shield" label="Documents & verification" value={kycValue} onPress={() => navigation.navigate('Kyc')} />
          <MenuRow icon="credit-card" label="Settlement details" value={bankComplete ? 'Added' : 'Add'} onPress={() => navigation.navigate('Bank')} last />
        </Card>

        <SectionLabel style={styles.label}>Activity</SectionLabel>
        <Card padded={false} style={styles.card}>
          <MenuRow icon="trending-up" label="Earnings" onPress={() => navigation.navigate('Earnings')} />
          <MenuRow icon="clock" label="Trip history" onPress={() => navigation.navigate('Trips')} last />
        </Card>

        <SectionLabel style={styles.label}>Support</SectionLabel>
        <Card padded={false} style={styles.card}>
          <MenuRow icon="help-circle" label="Help & support" onPress={contactSupport} />
          <MenuRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} last />
        </Card>

        <Card padded={false} style={styles.card}>
          <MenuRow icon="log-out" label="Sign out" danger onPress={handleLogout} last />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  name: { ...type.h1, fontSize: 20 },
  sub: { ...type.caption, marginTop: 2 },
  label: { marginBottom: spacing.sm, marginTop: spacing.md },
  card: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
});
