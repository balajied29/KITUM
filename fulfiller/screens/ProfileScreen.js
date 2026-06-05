import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../lib/theme';
import { Header, Card, Button, Avatar, SectionLabel, Divider } from '../components/ui';
import Icon from '../components/Icon';

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen({ user, onBack, onRequestChange }) {
  const profile = user?.fulfillerProfile || {};
  const vehicle = profile.vehicleNumber || '—';
  const capacity = profile.capacityLitres ? `${profile.capacityLitres} L` : '—';

  // Vehicle/tanker are locked after registration — open a pre-filled support
  // request so an admin can review and apply the change.
  const requestChange = () => {
    onRequestChange?.({
      category: 'account',
      label: 'Vehicle / tanker change',
      subject: 'Request: update vehicle / tanker details',
      body:
        `Current details:\n• Vehicle: ${profile.vehicleNumber || '—'}\n• Tanker capacity: ${profile.capacityLitres ? profile.capacityLitres + ' L' : '—'}` +
        `\n\nPlease update to:\n• Vehicle: \n• Tanker capacity: `,
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Avatar name={user?.name} size={76} />
          <Text style={styles.name}>{user?.name || 'Partner'}</Text>
          <View style={styles.ratingRow}>
            <Icon name="star" size={14} color={colors.star} />
            <Text style={styles.rating}>
              {Number(profile.rating ?? 5).toFixed(1)} · {profile.ratingCount || 0} ratings
            </Text>
          </View>
        </View>

        <SectionLabel style={styles.label}>Contact</SectionLabel>
        <Card style={{ marginBottom: spacing.xl }}>
          <InfoRow icon="mail" label="Email" value={user?.email} />
          <Divider style={{ marginVertical: spacing.md }} />
          <InfoRow icon="phone" label="Phone" value={user?.phone} />
        </Card>

        <SectionLabel style={styles.label}>Vehicle & tanker</SectionLabel>
        <Card>
          <InfoRow icon="truck" label="Vehicle number" value={vehicle} />
          <Divider style={{ marginVertical: spacing.md }} />
          <InfoRow icon="droplet" label="Tanker capacity" value={capacity} />

          <View style={styles.lockNote}>
            <Icon name="lock" size={13} color={colors.textMuted} />
            <Text style={styles.lockText}>
              Locked after registration. Request a change and our team will review and update it.
            </Text>
          </View>
          <Button label="Request a change" variant="secondary" icon="edit-3" onPress={requestChange} style={{ marginTop: spacing.md }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  name: { ...type.h1, marginTop: spacing.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  rating: { ...type.caption },
  label: { marginBottom: spacing.sm },

  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { ...type.bodyMuted, marginLeft: spacing.md, flex: 1 },
  infoValue: { ...type.body, maxWidth: '55%' },

  lockNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.lg },
  lockText: { ...type.caption, flex: 1, lineHeight: 18 },
});
