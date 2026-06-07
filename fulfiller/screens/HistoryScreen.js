import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../lib/theme';
import { Header, Card, Pill, IconChip, Skeleton } from '../components/ui';
import Icon from '../components/Icon';
import { getHistory } from '../lib/api';
import { REQUEST_STATUS } from '../lib/constants';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function TripRow({ job }) {
  const completed = job.status === REQUEST_STATUS.COMPLETED;
  const size = job.capacityLitres || job.productId?.unit || '';
  return (
    <View style={styles.row}>
      <IconChip name={completed ? 'check' : 'x'} tone={completed ? 'success' : 'neutral'} size={40} />
      <View style={{ flex: 1, marginLeft: spacing.lg }}>
        <Text style={styles.rowTitle}>{job.productId?.name || `${size}L tanker`}</Text>
        <Text style={styles.rowDate}>{fmtDate(job.completedAt || job.createdAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.amount}>₹{job.pricing?.amount ?? '—'}</Text>
        <Pill label={completed ? 'Completed' : 'Cancelled'} tone={completed ? 'success' : 'neutral'} />
      </View>
    </View>
  );
}

/** A skeleton row shaped like <TripRow> (icon chip · title/date · amount/pill). */
function SkeletonTripRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} radius={radius.md} />
      <View style={{ flex: 1, marginLeft: spacing.lg }}>
        <Skeleton width="55%" height={15} />
        <Skeleton width="35%" height={12} style={{ marginTop: 6 }} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Skeleton width={48} height={15} />
        <Skeleton width={72} height={22} radius={radius.pill} />
      </View>
    </View>
  );
}

/** Loading placeholder mirroring the loaded screen: total card + a list of trips. */
function HistorySkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Card style={styles.totalCard}>
        <View>
          <Skeleton width={96} height={11} />
          <Skeleton width={140} height={30} style={{ marginTop: spacing.sm }} />
        </View>
        <Skeleton width={46} height={46} radius={radius.md} />
      </Card>

      <Card padded={false} style={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.divider} />}
            <SkeletonTripRow />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

export default function HistoryScreen({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then((r) => setData(r.data.data))
      .catch(() => setData({ jobs: [], earnings: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const jobs = data?.jobs || [];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Trip history" onBack={onBack} />
      {loading ? (
        <HistorySkeleton />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>TOTAL EARNED</Text>
              <Text style={styles.totalValue}>₹{Number(data?.earnings || 0).toLocaleString('en-IN')}</Text>
            </View>
            <IconChip name="trending-up" tone="success" size={46} />
          </Card>

          {jobs.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="inbox" size={26} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySub}>Your completed deliveries will appear here.</Text>
            </View>
          ) : (
            <Card padded={false} style={styles.list}>
              {jobs.map((j, i) => (
                <View key={j._id || i}>
                  {i > 0 && <View style={styles.divider} />}
                  <TripRow job={j} />
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm },

  totalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  totalLabel: { ...type.label },
  totalValue: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginTop: spacing.xs },

  list: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg },
  divider: { height: 1, backgroundColor: colors.border },
  rowTitle: { ...type.h2, fontSize: 15 },
  rowDate: { ...type.caption, marginTop: 2 },
  amount: { ...type.h2, fontSize: 15 },

  empty: { alignItems: 'center', paddingTop: spacing.huge, gap: spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { ...type.h2 },
  emptySub: { ...type.caption, textAlign: 'center' },
});
