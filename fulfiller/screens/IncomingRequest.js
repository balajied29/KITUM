import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, radius, type } from '../lib/theme';
import { Button, GradientButton, Gradient } from '../components/ui';
import Icon from '../components/Icon';

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function IncomingRequest({ offer, onAccept, onReject }) {
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(null);
  const pop = useRef(new Animated.Value(0)).current; // payout entrance
  const pulse = useRef(new Animated.Value(1)).current; // countdown urgency

  // Satisfying entrance for the earning number.
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }, [pop]);

  useEffect(() => {
    if (!offer?.expiresAt) return;
    const tick = () => {
      const secs = Math.max(0, (offer.expiresAt - Date.now()) / 1000);
      if (totalRef.current == null) totalRef.current = Math.max(secs, 1);
      setRemaining(secs);
      if (secs <= 0) onReject?.();
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.expiresAt]);

  // Pulse the seconds in the final stretch.
  const low = remaining <= 5;
  useEffect(() => {
    if (!low) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [low, pulse]);

  if (!offer) return null;

  const km = typeof offer.distanceKm === 'number' ? `${offer.distanceKm.toFixed(1)} km` : '—';
  const eta = offer.etaMin ? `~${offer.etaMin} min` : '—';
  const pct = totalRef.current ? Math.min(1, Math.max(0, remaining / totalRef.current)) : 0;
  const urgent = pct <= 0.33;

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <Gradient style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          {/* Header + countdown (over the brand gradient) */}
          <View style={styles.head}>
            <View style={styles.kicker}>
              <Icon name="bell" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.kickerText}>NEW DELIVERY REQUEST</Text>
            </View>
            <Animated.Text style={[styles.count, { transform: [{ scale: pulse }], color: urgent ? '#FECACA' : colors.onPrimary }]}>
              {Math.ceil(remaining)}s
            </Animated.Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: urgent ? '#F87171' : '#fff' }]} />
            </View>
            <Text style={styles.expires}>Respond before this expires</Text>
          </View>

          {/* Detail sheet */}
          <View style={styles.sheet}>
            <Animated.View
              style={[styles.payout, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}
            >
              <Text style={styles.payoutLabel}>You earn</Text>
              <Text style={styles.payoutValue}>₹{offer.payout ?? offer.amount ?? '—'}</Text>
            </Animated.View>

            <View style={styles.rows}>
              <DetailRow icon="droplet" label="Tanker" value={`${offer.size} L`} />
              <DetailRow icon="navigation" label="Distance" value={km} />
              <DetailRow icon="clock" label="Est. time" value={eta} />
            </View>

            <View style={styles.drop}>
              <Icon name="map-pin" size={18} color={colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.dropLabel}>DROP-OFF</Text>
                <Text style={styles.dropAddr}>{offer.drop?.address || 'Address shared on accept'}</Text>
                {!!offer.drop?.landmark && <Text style={styles.dropLandmark}>Near {offer.drop.landmark}</Text>}
              </View>
            </View>

            <View style={{ flex: 1 }} />

            {/* Actions pinned to the bottom of the white sheet */}
            <View style={styles.actions}>
              <Button label="Decline" variant="secondary" onPress={onReject} style={{ flex: 1 }} />
              <View style={{ flex: 1.4 }}>
                <GradientButton label="Accept" icon="check" onPress={onAccept} />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Gradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, // gradient fills the backdrop
  head: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl, paddingBottom: spacing.xl, alignItems: 'center' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kickerText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  count: { fontSize: 64, fontWeight: '800', marginTop: spacing.sm, letterSpacing: -2 },
  track: { width: '70%', height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: 6, borderRadius: radius.pill },
  expires: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: spacing.md, fontWeight: '500' },

  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: spacing.sm,
    padding: spacing.xxl,
  },
  payout: { alignItems: 'center', paddingBottom: spacing.xl, paddingTop: spacing.sm },
  payoutLabel: { ...type.label },
  payoutValue: { fontSize: 48, fontWeight: '800', color: colors.success, letterSpacing: -1, marginTop: spacing.xs },

  rows: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  rowLabel: { ...type.bodyMuted, flex: 1 },
  rowValue: { ...type.h2 },

  drop: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xl },
  dropLabel: { ...type.label },
  dropAddr: { ...type.body, marginTop: 4, lineHeight: 21 },
  dropLandmark: { ...type.caption, marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.lg },
});
