import { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type, shadow } from '../lib/theme';
import { Card, Avatar, IconChip, StatTile, SectionLabel, Button, Gradient } from '../components/ui';
import Icon from '../components/Icon';
import Marquee from '../components/Marquee';
import { getHistory } from '../lib/api';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';
import HistoryScreen from './HistoryScreen';
import KycScreen from './KycScreen';
import BankDetailsScreen from './BankDetailsScreen';
import SupportScreen from './SupportScreen';

// The progress ring uses react-native-svg (Expo-standard, native). Lazy-required
// with a clean linear-bar fallback so Home still renders before it's installed +
// the dev client is rebuilt.
let Svg = null;
let SvgCircle = null;
try {
  const s = require('react-native-svg');
  Svg = s.Svg || s.default;
  SvgCircle = s.Circle;
} catch {}
const AnimatedCircle = SvgCircle ? Animated.createAnimatedComponent(SvgCircle) : null;

const DAILY_GOAL = 1000; // ₹ — sensible default daily earnings target

// Legacy in-file switcher (kept for safety; the app now drives navigation through
// RootNavigator, which renders HomeMain directly).
export default function HomeScreen(props) {
  const [view, setView] = useState('home');
  const [supportSeed, setSupportSeed] = useState(null);
  const openSupport = (seed = null) => { setSupportSeed(seed); setView('support'); };
  if (view === 'profile') return <ProfileScreen user={props.user} onBack={() => setView('home')} onRequestChange={openSupport} />;
  if (view === 'settings') return <SettingsScreen user={props.user} onBack={() => setView('home')} onLogout={props.onLogout} onSupport={() => openSupport()} />;
  if (view === 'history') return <HistoryScreen onBack={() => setView('home')} />;
  if (view === 'kyc') return <KycScreen user={props.user} onBack={() => setView('home')} />;
  if (view === 'bank') return <BankDetailsScreen user={props.user} onBack={() => setView('home')} />;
  if (view === 'support') return <SupportScreen user={props.user} seedTemplate={supportSeed} onBack={() => { setSupportSeed(null); setView('home'); }} />;
  return <HomeMain {...props} navigate={setView} openSupport={openSupport} />;
}

function DetailRow({ label, value, last }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailDivider]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// State-aware KYC prompt shown until documents are verified.
const KYC_CARD = {
  not_submitted: { tone: 'warning', icon: 'file-text', title: 'Verify your account', sub: 'Upload your PAN and driver’s licence to start receiving deliveries.', cta: 'Upload documents' },
  pending: { tone: 'warning', icon: 'clock', title: 'Documents under review', sub: 'We’re verifying your PAN and licence — this won’t take long.', cta: 'View / update documents' },
  rejected: { tone: 'danger', icon: 'alert-triangle', title: 'Verification failed', sub: 'Your documents couldn’t be verified. Please re-upload clear photos.', cta: 'Re-upload documents' },
};

function KycCard({ status, onPress }) {
  const c = KYC_CARD[status] || KYC_CARD.not_submitted;
  return (
    <Card style={styles.statusCard}>
      <View style={styles.statusRow}>
        <IconChip name={c.icon} tone={c.tone} size={46} />
        <View style={{ flex: 1, marginLeft: spacing.lg }}>
          <Text style={styles.statusTitle}>{c.title}</Text>
          <Text style={styles.statusSub}>{c.sub}</Text>
        </View>
      </View>
      <Button label={c.cta} icon="upload" onPress={onPress} style={{ marginTop: spacing.lg }} />
    </Card>
  );
}

/** Pulsing green dot — the "live / listening" indicator. */
function LiveDot() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1100, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={styles.liveDotWrap}>
      <Animated.View
        style={[styles.liveDotRing, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }], opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }) }]}
      />
      <View style={styles.liveDotCore} />
    </View>
  );
}

/** Concentric radar pulse for the "waiting for a request" idle state. */
function RadarPulse() {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v, delay) => Animated.loop(Animated.timing(v, { toValue: 1, duration: 2200, delay, useNativeDriver: true, easing: Easing.out(Easing.ease) }));
    const a = mk(r1, 0);
    const b = mk(r2, 1100);
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [r1, r2]);
  const ring = (v) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  });
  return (
    <View style={styles.radar}>
      <Animated.View style={[styles.radarRing, ring(r1)]} />
      <Animated.View style={[styles.radarRing, ring(r2)]} />
      <View style={styles.radarCore}><Icon name="radio" size={22} color={colors.primary} /></View>
    </View>
  );
}

/** Circular daily-earnings progress (SVG ring; graceful linear-bar fallback). */
function GoalRing({ size = 176, stroke = 16, progress = 0, today = 0, goal = DAILY_GOAL, trips = 0 }) {
  const p = Math.max(0, Math.min(1, progress));
  const ringColor = p >= 1 ? colors.success : colors.primary;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  // Sweep the arc from empty to its value on open (and re-fill when today's total
  // changes). strokeDashoffset is a prop, so this runs on the JS driver.
  const offset = useRef(new Animated.Value(circ)).current;
  useEffect(() => {
    const anim = Animated.timing(offset, {
      toValue: circ * (1 - p),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [p, circ, offset]);

  const center = (
    <View style={styles.ringCenter}>
      <Text style={styles.ringToday}>₹{Number(today).toLocaleString('en-IN')}</Text>
      <Text style={styles.ringGoal}>of ₹{Number(goal).toLocaleString('en-IN')}</Text>
      <Text style={styles.ringTrips}>{trips} {trips === 1 ? 'trip' : 'trips'} today</Text>
    </View>
  );

  if (Svg && SvgCircle && AnimatedCircle) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={styles.ringSvg}>
          <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={colors.primarySoft} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        {center}
      </View>
    );
  }

  // Fallback until react-native-svg is installed + rebuilt — number + linear bar.
  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      {center}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${p * 100}%`, backgroundColor: ringColor }]} />
      </View>
    </View>
  );
}

export function HomeMain({ user, online, onToggleOnline, earnings = 0, navigate, pending, eligible, kycStatus, bankComplete, syncing }) {
  const profile = user?.fulfillerProfile || {};
  const vehicle = profile.vehicleNumber || 'Vehicle pending';
  const capacity = profile.capacityLitres ? `${profile.capacityLitres}L tanker` : 'Tanker';
  const rating = Number(profile.rating ?? 5).toFixed(1);
  const firstName = user?.name?.split(' ')[0] || 'Partner';

  const [stats, setStats] = useState({ trips: null, today: 0, todayTrips: 0 });
  useEffect(() => {
    getHistory()
      .then((r) => {
        const jobs = (r.data.data?.jobs || []).filter((j) => j.status === 'completed');
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const todays = jobs.filter((j) => j.completedAt && new Date(j.completedAt) >= start);
        const today = todays.reduce((sum, j) => sum + (j.pricing?.partnerPayout ?? j.pricing?.fare ?? j.pricing?.amount ?? 0), 0);
        setStats({ trips: jobs.length, today, todayTrips: todays.length });
      })
      .catch(() => setStats({ trips: 0, today: 0, todayTrips: 0 }));
  }, []);
  const trips = stats.trips; // lifetime completed count (stat tile)
  const goalProgress = DAILY_GOAL > 0 ? stats.today / DAILY_GOAL : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Gradient hero — identity + online status, the heart of the screen */}
        <Gradient style={styles.hero}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.heroIdentity} activeOpacity={0.8} onPress={() => navigate('profile')}>
              <View style={styles.avatarRing}><Avatar name={user?.name} size={40} /></View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={styles.heroHello} numberOfLines={1}>Hi, {firstName}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>{vehicle} · {capacity}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate('settings')} style={styles.heroIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="settings" size={19} color="#fff" />
            </TouchableOpacity>
          </View>

          {eligible ? (
            <View style={styles.onlinePanel}>
              <View style={[styles.powerChip, online && styles.powerChipOn]}>
                <Icon name="power" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.onlineTitle}>{online ? "You're online" : "You're offline"}</Text>
                {online ? (
                  <View style={styles.liveRow}>
                    <LiveDot />
                    <Text style={styles.liveText}>Listening for requests nearby</Text>
                  </View>
                ) : (
                  <Text style={styles.onlineSub}>Go online to start earning</Text>
                )}
              </View>
              <Switch
                value={online}
                onValueChange={onToggleOnline}
                trackColor={{ false: 'rgba(255,255,255,0.30)', true: '#34D399' }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(255,255,255,0.30)"
              />
            </View>
          ) : (
            <View style={styles.onlinePanel}>
              <View style={styles.powerChip}><Icon name="lock" size={18} color="#fff" /></View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.onlineTitle}>Finish setup to go online</Text>
                <Text style={styles.onlineSub}>{pending ? 'Your application is under review.' : 'Verify your documents to get started.'}</Text>
              </View>
            </View>
          )}
        </Gradient>

        {/* Today's earnings — daily goal ring (the glanceable centrepiece) */}
        {eligible && (
          <Card style={styles.goalCard}>
            <View style={styles.goalHead}>
              <Text style={styles.goalTitle}>TODAY’S EARNINGS</Text>
              {goalProgress >= 1 && (
                <View style={styles.goalBadge}>
                  <Icon name="check" size={12} color={colors.success} />
                  <Text style={styles.goalBadgeText}>Goal reached</Text>
                </View>
              )}
            </View>
            <GoalRing progress={goalProgress} today={stats.today} goal={DAILY_GOAL} trips={stats.todayTrips} />
          </Card>
        )}

        {/* Lifetime stats */}
        {eligible && (
          <View style={styles.stats}>
            <StatTile icon="trending-up" tone="success" label="All-time" value={`₹${Number(earnings).toLocaleString('en-IN')}`} />
            <StatTile icon="check-circle" tone="primary" label="Trips" value={trips == null ? '—' : String(trips)} />
            <StatTile icon="star" tone="warning" label="Rating" value={rating} />
          </View>
        )}

        {/* Bank/settlement nudge */}
        {!bankComplete && (
          <Marquee text="Add your bank details so we can settle your earnings — tap to add account or UPI" onPress={() => navigate('bank')} />
        )}

        {/* A completed delivery still syncing (offline journal) */}
        {syncing && (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.syncText}>Syncing your last delivery…</Text>
          </View>
        )}

        {/* Awaiting approval */}
        {pending && (
          <Card style={[styles.statusCard, { marginTop: spacing.lg }]}>
            <View style={styles.statusRow}>
              <IconChip name="clock" tone="warning" size={46} />
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <Text style={styles.statusTitle}>Application under review</Text>
                <Text style={styles.statusSub}>We’re verifying your details. You can submit documents now to speed things up.</Text>
              </View>
            </View>
          </Card>
        )}

        {/* KYC gate — until documents are verified */}
        {!eligible && (
          <View style={{ marginTop: spacing.lg }}>
            <KycCard status={kycStatus} onPress={() => navigate('kyc')} />
          </View>
        )}

        {/* Idle / waiting state (eligible only) */}
        {eligible && (
          online ? (
            <Card style={styles.waitCard}>
              <RadarPulse />
              <Text style={styles.waitTitle}>Waiting for your next request</Text>
              <Text style={styles.waitSub}>Keep the app open — we’ll alert you the instant an order comes in.</Text>
            </Card>
          ) : (
            <Card style={styles.offCard}>
              <View style={styles.moonChip}><Icon name="moon" size={20} color={colors.textMuted} /></View>
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <Text style={styles.stateTitle}>You’re off the clock</Text>
                <Text style={styles.stateSub}>Flip the switch above when you’re ready to earn.</Text>
              </View>
            </Card>
          )
        )}

        {/* Application details (reassurance while pending) */}
        {pending && (
          <Card style={[styles.stateCardPlain, { marginTop: spacing.lg }]}>
            <SectionLabel style={{ marginBottom: spacing.md }}>Your application</SectionLabel>
            <DetailRow label="Vehicle" value={profile.vehicleNumber || '—'} />
            <DetailRow label="Tanker capacity" value={profile.capacityLitres ? `${profile.capacityLitres} L` : '—'} />
            <DetailRow label="Phone" value={user?.phone || '—'} />
            <DetailRow label="Email" value={user?.email || '—'} last />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl },

  // Hero
  hero: { borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.lg, ...shadow.card },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.md },
  avatarRing: { borderRadius: radius.pill, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', padding: 2 },
  heroHello: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '500', marginTop: 1 },
  heroIconBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },

  onlinePanel: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.lg, padding: spacing.md },
  powerChip: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  powerChipOn: { backgroundColor: '#22A559' },
  onlineTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  onlineSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  liveText: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '600', marginLeft: spacing.sm },

  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80' },
  liveDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },

  // Daily goal ring
  goalCard: { alignItems: 'center', marginBottom: spacing.lg },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.lg },
  goalTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSoft, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  goalBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringCenter: { alignItems: 'center' },
  ringToday: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  ringGoal: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
  ringTrips: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: spacing.xs },
  barTrack: { width: '78%', height: 12, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden', marginTop: spacing.lg },
  barFill: { height: 12, borderRadius: radius.pill },

  // Stats
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },

  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  syncText: { ...type.caption, color: colors.primary },

  // Status / KYC cards
  statusCard: { marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusTitle: { ...type.h2 },
  statusSub: { ...type.caption, marginTop: 2, maxWidth: 210 },

  // Waiting (online) — radar
  waitCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.lg },
  radar: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  radarRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft },
  radarCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { ...type.h2, fontSize: 16 },
  waitSub: { ...type.caption, textAlign: 'center', marginTop: 4, maxWidth: 260 },

  // Off the clock
  offCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  moonChip: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  stateTitle: { ...type.h2, fontSize: 15 },
  stateSub: { ...type.caption, marginTop: 2 },

  stateCardPlain: {},
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { ...type.caption },
  detailValue: { ...type.body, fontSize: 14, maxWidth: '60%' },
});
