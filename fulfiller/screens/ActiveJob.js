import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type, shadow } from '../lib/theme';
import { Button, Card, SectionLabel, Divider, IconChip, Gradient, GradientButton } from '../components/ui';
import Icon from '../components/Icon';
import { REQUEST_STATUS, NO_SHOW_WAIT_MS } from '../lib/constants';

const NEXT = {
  [REQUEST_STATUS.DRIVER_ASSIGNED]: { to: REQUEST_STATUS.EN_ROUTE, label: 'Start trip', icon: 'navigation' },
  [REQUEST_STATUS.EN_ROUTE]: { to: REQUEST_STATUS.ARRIVED, label: "I've arrived", icon: 'map-pin' },
  [REQUEST_STATUS.ARRIVED]: { to: REQUEST_STATUS.COMPLETED, label: 'Complete delivery', icon: 'check-circle' },
};

const STEPS = [
  { key: REQUEST_STATUS.EN_ROUTE, label: 'On the way' },
  { key: REQUEST_STATUS.ARRIVED, label: 'Arrived' },
  { key: REQUEST_STATUS.COMPLETED, label: 'Delivered' },
];

const TITLES = {
  [REQUEST_STATUS.DRIVER_ASSIGNED]: 'Head to the customer',
  [REQUEST_STATUS.EN_ROUTE]: 'On the way',
  [REQUEST_STATUS.ARRIVED]: "You've arrived",
};

const fmtRemaining = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

function Stepper({ status }) {
  const doneTo = STEPS.findIndex((s) => s.key === status); // -1 when just assigned
  return (
    <View style={styles.stepper}>
      {STEPS.map((s, i) => {
        const done = i <= doneTo;
        return (
          <View key={s.key} style={styles.step}>
            <View style={styles.stepTop}>
              {i > 0 && <View style={[styles.connector, { backgroundColor: i <= doneTo ? colors.primary : colors.border }]} />}
              <View style={[styles.dot, done ? styles.dotDone : styles.dotIdle]}>
                {done ? <Icon name="check" size={12} color="#fff" /> : <View style={styles.dotInner} />}
              </View>
              {i < STEPS.length - 1 && <View style={[styles.connector, { backgroundColor: i < doneTo ? colors.primary : colors.border }]} />}
            </View>
            <Text style={[styles.stepLabel, done && { color: colors.primary, fontWeight: '700' }]}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ActiveJob({ job, status, paid, onAdvance, onAbandon, onReportNoShow }) {
  const drop = job?.drop || job?.dropLocation || {};
  const coords = drop.coordinates || [];
  const next = NEXT[status];
  const customer = job?.customer || job?.customerId || {};
  const custName = customer.name || drop?.name || 'Customer';
  const custPhone = customer.phone || drop?.phone;
  const payout = job?.payout ?? job?.pricing?.partnerPayout ?? job?.amount ?? job?.pricing?.amount;
  const collect = job?.collect ?? job?.pricing?.codDue ?? 0;
  const size = job?.size || job?.capacityLitres;
  const isUpi = (job?.paymentMode) === 'upi';
  const total = job?.amount ?? job?.pricing?.amount ?? collect; // what the customer pays (UPI)
  // A UPI job can't be completed until the customer has paid (collected at the door).
  const blockComplete = isUpi && !paid && (NEXT[status]?.to === REQUEST_STATUS.COMPLETED);

  // No-show gating: wait-countdown from when we arrived + whether we tried calling.
  const arrivedAtRef = useRef(null);
  const [called, setCalled] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status === REQUEST_STATUS.ARRIVED && !arrivedAtRef.current) {
      const entry = (job?.statusLog || []).slice().reverse().find((e) => e.status === REQUEST_STATUS.ARRIVED);
      arrivedAtRef.current = entry?.changedAt ? new Date(entry.changedAt).getTime() : Date.now();
    }
  }, [status, job]);

  useEffect(() => {
    if (status !== REQUEST_STATUS.ARRIVED) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const remaining = arrivedAtRef.current ? Math.max(0, NO_SHOW_WAIT_MS - (now - arrivedAtRef.current)) : NO_SHOW_WAIT_MS;
  const canReport = status === REQUEST_STATUS.ARRIVED && remaining <= 0;

  const callCustomer = () => {
    if (!custPhone) return;
    setCalled(true);
    Linking.openURL(`tel:${custPhone}`).catch(() => {});
  };

  const openMaps = () => {
    if (coords.length < 2) return;
    const [lng, lat] = coords;
    const url = Platform.select({ ios: `maps://app?daddr=${lat},${lng}`, android: `google.navigation:q=${lat},${lng}` });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
  };

  const confirmAbandon = () =>
    Alert.alert('Release this job?', 'The customer will be matched with another partner.', [
      { text: 'Keep job', style: 'cancel' },
      { text: 'Release', style: 'destructive', onPress: onAbandon },
    ]);

  const submitNoShow = (reason) => {
    setReporting(true);
    Promise.resolve(onReportNoShow?.(reason, called)).then((res) => {
      setReporting(false);
      if (res && res.ok === false) Alert.alert('Couldn’t report', res.error || 'Please try again.');
      // On success the parent ends the job and unmounts this screen.
    });
  };

  const reasonSheet = () =>
    Alert.alert('Customer not responding?', 'Tell us why you can’t complete this delivery.', [
      { text: 'No answer / not picking up', onPress: () => submitNoShow('no_answer') },
      { text: 'Phone unreachable / off', onPress: () => submitNoShow('unreachable') },
      { text: 'Not at the location', onPress: () => submitNoShow('not_at_location') },
      { text: 'Refused the delivery', onPress: () => submitNoShow('refused') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const promptNoShow = () => {
    if (!called) {
      Alert.alert('Try calling first', 'Please call the customer before reporting a no-show.', [
        { text: 'Call now', onPress: callCustomer },
        { text: 'Report anyway', style: 'destructive', onPress: reasonSheet },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    reasonSheet();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Gradient hero */}
        <Gradient style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroKicker}>ACTIVE DELIVERY</Text>
            <View style={styles.heroSizePill}>
              <Icon name="droplet" size={12} color="#fff" />
              <Text style={styles.heroSizeText}>{size} L</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{TITLES[status] || 'Active delivery'}</Text>
          <View style={styles.heroEarnRow}>
            <Text style={styles.heroEarnLabel}>You earn</Text>
            <Text style={styles.heroEarnValue}>₹{payout}</Text>
          </View>
        </Gradient>

        {/* Progress */}
        <Card style={styles.card}>
          <Stepper status={status} />
        </Card>

        {/* Customer */}
        <Card style={styles.card} padded={false}>
          <View style={styles.cardInner}>
            <IconChip name="user" tone="primary" />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <SectionLabel>Customer</SectionLabel>
              <Text style={styles.value}>{custName}</Text>
            </View>
            {!!custPhone && (
              <TouchableOpacity style={styles.callBtn} onPress={callCustomer}>
                <Icon name="phone" size={18} color={colors.success} />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Drop-off */}
        <Card style={styles.card}>
          <View style={styles.dropHead}>
            <IconChip name="map-pin" tone="primary" />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <SectionLabel>Drop-off</SectionLabel>
              <Text style={styles.value}>{drop?.address || 'Address'}</Text>
              {!!drop?.landmark && <Text style={styles.muted}>Near {drop.landmark}</Text>}
            </View>
          </View>
          <Button label="Navigate" variant="secondary" size="md" icon="navigation" onPress={openMaps} style={{ marginTop: spacing.lg }} />
        </Card>

        {/* Payment + tanker */}
        <Card style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tanker</Text>
            <Text style={styles.summaryValue}>{size} L</Text>
          </View>
          <Divider style={{ marginVertical: spacing.md }} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{isUpi ? 'Customer pays (UPI)' : 'Collect cash'}</Text>
            <Text style={[styles.summaryValue, { color: isUpi && !paid ? colors.warning : colors.success }]}>
              {isUpi ? `₹${total} · ${paid ? 'Paid' : 'Awaiting'}` : `₹${collect}`}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        {/* Why "Complete" is locked for an unpaid UPI job */}
        {status === REQUEST_STATUS.ARRIVED && isUpi && !paid && (
          <View style={styles.awaitBanner}>
            <Icon name="clock" size={15} color={colors.warning} />
            <Text style={styles.awaitText}>Waiting for the customer to pay ₹{total} by UPI</Text>
          </View>
        )}

        {next && <GradientButton label={next.label} icon={next.icon} disabled={blockComplete} onPress={() => onAdvance(next.to)} />}

        {/* Customer-no-show — only at the drop, after a wait + a call attempt */}
        {status === REQUEST_STATUS.ARRIVED &&
          (canReport ? (
            <Button label="Customer not responding" variant="secondary" icon="user-x" loading={reporting} onPress={promptNoShow} />
          ) : (
            <View style={styles.waitRow}>
              <Icon name="clock" size={13} color={colors.textMuted} />
              <Text style={styles.waitText}>Can report a no-show in {fmtRemaining(remaining)}</Text>
            </View>
          ))}

        {status !== REQUEST_STATUS.COMPLETED && (
          <TouchableOpacity onPress={confirmAbandon} style={styles.release} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.releaseText}>Unable to deliver — release job</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  // Gradient hero
  hero: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg, ...shadow.card },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  heroSizePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  heroSizeText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: spacing.sm },
  heroEarnRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  heroEarnLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  heroEarnValue: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },

  card: { marginBottom: spacing.lg },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl },

  value: { ...type.h2, marginTop: 2 },
  muted: { ...type.caption, marginTop: 2 },

  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },

  dropHead: { flexDirection: 'row', alignItems: 'flex-start' },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { ...type.bodyMuted },
  summaryValue: { ...type.h2 },

  // Stepper
  stepper: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  connector: { flex: 1, height: 2 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.primary },
  dotIdle: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  stepLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: spacing.sm },

  // Floating action bar — extra bottom padding clears the home indicator, and the
  // upward shadow lifts it off the content (no more overlap).
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#0B1524',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  awaitBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  awaitText: { fontSize: 13, fontWeight: '600', color: colors.warning },
  waitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  waitText: { ...type.caption, color: colors.textMuted },
  release: { alignItems: 'center', paddingVertical: spacing.xs },
  releaseText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
