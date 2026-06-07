import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type, shadow } from '../lib/theme';
import { Gradient, Card, Skeleton } from '../components/ui';
import Icon from '../components/Icon';
import { getHistory } from '../lib/api';
import { REQUEST_STATUS } from '../lib/constants';
import { useDriverSession } from '../providers/DriverSessionProvider';

export default function EarningsScreen() {
  const { earnings } = useDriverSession();
  const [trips, setTrips] = useState(null);
  const loading = trips == null;

  useEffect(() => {
    getHistory()
      .then((r) => setTrips((r.data.data?.jobs || []).filter((j) => j.status === REQUEST_STATUS.COMPLETED).length))
      .catch(() => setTrips(0));
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Earnings</Text>

        <Gradient style={styles.hero}>
          <Text style={styles.heroLabel}>Total earned</Text>
          {loading ? (
            <>
              <Skeleton width={180} height={40} radius={radius.sm} style={[styles.heroSkeleton, { marginTop: spacing.xs }]} />
              <Skeleton width={150} height={14} radius={radius.sm} style={[styles.heroSkeleton, { marginTop: spacing.md }]} />
            </>
          ) : (
            <>
              <Text style={styles.heroValue}>₹{Number(earnings).toLocaleString('en-IN')}</Text>
              <View style={styles.heroMetaRow}>
                <Icon name="check-circle" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroMeta}>{trips} deliveries completed</Text>
              </View>
            </>
          )}
        </Gradient>

        <Card style={styles.note}>
          <View style={styles.noteRow}>
            <Icon name="calendar" size={18} color={colors.primary} />
            <Text style={styles.noteText}>Daily & weekly breakdowns, per-trip earnings and payout history are coming next.</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  h1: { ...type.h1, marginBottom: spacing.lg },
  hero: { borderRadius: radius.xl, padding: spacing.xxl, ...shadow.card },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, marginTop: spacing.xs },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  heroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  heroSkeleton: { backgroundColor: 'rgba(255,255,255,0.28)' },
  note: { marginTop: spacing.lg },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  noteText: { ...type.caption, flex: 1 },
});
