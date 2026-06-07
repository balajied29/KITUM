import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../lib/theme';
import { Gradient, Skeleton } from '../components/ui';
import Icon from '../components/Icon';
import { getHistory } from '../lib/api';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';
import HistoryScreen from './HistoryScreen';
import KycScreen from './KycScreen';
import BankDetailsScreen from './BankDetailsScreen';
import SupportScreen from './SupportScreen';

// react-native-svg (Expo-standard, native). Lazy-required with graceful fallbacks
// so Home still renders if it's ever absent (ring → linear bar, blooms → skipped).
let Svg = null, SvgCircle = null, SvgDefs = null, SvgStop = null, SvgLG = null, SvgRG = null, SvgRect = null;
try {
  const s = require('react-native-svg');
  Svg = s.Svg || s.default;
  SvgCircle = s.Circle; SvgDefs = s.Defs; SvgStop = s.Stop;
  SvgLG = s.LinearGradient; SvgRG = s.RadialGradient; SvgRect = s.Rect;
} catch {}
const AnimatedCircle = SvgCircle ? Animated.createAnimatedComponent(SvgCircle) : null;

const DAILY_GOAL = 1000; // ₹ daily earnings target

// Premium-glass light palette (KitUm Home design). Core cobalt comes from the theme.
const SKY = '#86B0FF';
const GLASS = 'rgba(255,255,255,0.66)';
const GLASS_BORDER = 'rgba(255,255,255,0.9)';
const LINE = 'rgba(20,45,105,0.10)';
const TX2 = 'rgba(17,32,66,0.60)';
const TX3 = 'rgba(17,32,66,0.42)';
const RING_TRACK = 'rgba(20,45,105,0.10)';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
};
const initials = (name) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'P';

// State-aware verification copy (shown until documents are verified).
const KYC_COPY = {
  not_submitted: { icon: 'file-text', title: 'Verify your account', sub: 'Add your PAN and driving licence to go online and start receiving requests.', cta: 'Verify documents' },
  pending: { icon: 'clock', title: 'Documents under review', sub: 'We are checking your PAN and licence. This will not take long.', cta: 'View documents' },
  rejected: { icon: 'alert-triangle', title: 'Verification failed', sub: 'Your documents could not be verified. Please re-upload clear photos.', cta: 'Re-upload documents' },
};

/* ---------------- shared glass surface ---------------- */
function Glass({ style, children }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

/* ---------------- soft ambient blooms behind the glass ---------------- */
function Blooms() {
  if (!Svg || !SvgRG || !SvgDefs || !SvgStop || !SvgRect) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgDefs>
        <SvgRG id="bloomA" cx="86%" cy="-4%" rx="62%" ry="42%">
          <SvgStop offset="0" stopColor={colors.primary} stopOpacity="0.20" />
          <SvgStop offset="1" stopColor={colors.primary} stopOpacity="0" />
        </SvgRG>
        <SvgRG id="bloomB" cx="6%" cy="6%" rx="55%" ry="40%">
          <SvgStop offset="0" stopColor={SKY} stopOpacity="0.18" />
          <SvgStop offset="1" stopColor={SKY} stopOpacity="0" />
        </SvgRG>
      </SvgDefs>
      <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#bloomA)" />
      <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#bloomB)" />
    </Svg>
  );
}

/* ---------------- breathing sonar (online "listening" state) ---------------- */
function Sonar() {
  const breathe = useRef(new Animated.Value(0)).current;
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    b.start();
    const loops = rings.map((v, i) =>
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 3400, delay: i * 1133, easing: Easing.out(Easing.ease), useNativeDriver: true }))
    );
    loops.forEach((l) => l.start());
    return () => { b.stop(); loops.forEach((l) => l.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <View style={styles.sonarWrap}>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.sring, {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3.1] }) }],
          }]}
        />
      ))}
      <Animated.View style={{ transform: [{ scale: coreScale }] }}>
        <Gradient colors={[colors.primary, colors.primaryDark]} style={styles.sonarCore}>
          <Icon name="droplet" size={28} color="#fff" />
        </Gradient>
      </Animated.View>
    </View>
  );
}

/* ---------------- custom availability switch ---------------- */
function Toggle({ on, onToggle }) {
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [on, x]);
  const left = x.interpolate({ inputRange: [0, 1], outputRange: [3, 33] });
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onToggle(!on)} style={[styles.switch, on && styles.switchOn]}>
      <Animated.View style={[styles.knob, { left }]}>
        <Icon name="power" size={13} color={on ? '#19C07C' : '#7C8BA8'} />
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ---------------- daily-earnings goal ring ---------------- */
function GoalRing({ earned = 0, goal = DAILY_GOAL }) {
  const p = Math.max(0, Math.min(1, goal > 0 ? earned / goal : 0));
  const R = 54, C = 2 * Math.PI * R;
  const offset = useRef(new Animated.Value(C)).current;
  useEffect(() => {
    const a = Animated.timing(offset, { toValue: C * (1 - p), duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [p, C, offset]);

  const center = (
    <View style={styles.ringCenter}>
      <Text style={styles.ringAmt}>₹{Number(earned).toLocaleString('en-IN')}</Text>
      <Text style={styles.ringOf}>of ₹{Number(goal).toLocaleString('en-IN')}</Text>
    </View>
  );

  if (Svg && AnimatedCircle && SvgDefs && SvgLG && SvgStop) {
    return (
      <View style={styles.ringWrap}>
        <Svg width={120} height={120} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
          <SvgDefs>
            <SvgLG id="goalgrad" x1="0" y1="0" x2="1" y2="1">
              <SvgStop offset="0" stopColor="#9CBEFF" />
              <SvgStop offset="1" stopColor={colors.primary} />
            </SvgLG>
          </SvgDefs>
          <SvgCircle cx="60" cy="60" r={R} stroke={RING_TRACK} strokeWidth="11" fill="none" />
          <AnimatedCircle cx="60" cy="60" r={R} stroke="url(#goalgrad)" strokeWidth="11" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
        </Svg>
        {center}
      </View>
    );
  }
  // Fallback: number + linear bar.
  return (
    <View style={styles.ringWrap}>
      {center}
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${p * 100}%` }]} /></View>
    </View>
  );
}

/* ---------------- availability hero ---------------- */
function Hero({ eligible, online, onToggleOnline, pending, kycStatus, navigate }) {
  if (!eligible) {
    const c = pending
      ? { icon: 'clock', title: 'Application under review', sub: 'We are verifying your details. You can add documents now to speed things up.', cta: 'Verify documents' }
      : (KYC_COPY[kycStatus] || KYC_COPY.not_submitted);
    return (
      <Glass style={styles.hero}>
        <View style={styles.heroVisual}>
          <View style={[styles.orbOff, styles.orbAmber]}><Icon name={c.icon} size={40} color={colors.warning} /></View>
        </View>
        <Text style={styles.heroT}>{c.title}</Text>
        <Text style={styles.heroS}>{c.sub}</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigate('kyc')} style={{ marginTop: spacing.md }}>
          <Gradient colors={[colors.primary, colors.primaryDark]} style={styles.verifyBtn}>
            <Text style={styles.verifyTx}>{c.cta}</Text>
            <Icon name="arrow-right" size={18} color="#fff" />
          </Gradient>
        </TouchableOpacity>
      </Glass>
    );
  }
  return (
    <Glass style={styles.hero}>
      <View style={styles.heroVisual}>
        {online ? <Sonar /> : <View style={styles.orbOff}><Icon name="power" size={40} color={TX3} /></View>}
      </View>
      <Text style={styles.heroT}>{online ? "You're online" : "You're offline"}</Text>
      <Text style={[styles.heroS, online && { color: colors.primary }]}>
        {online ? 'Listening for requests nearby…' : 'Go online to start receiving water requests near you.'}
      </Text>
      <View style={styles.heroCtl}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctlLbl}>{online ? 'Available for requests' : "You're off the clock"}</Text>
          <Text style={styles.ctlSub}>{online ? 'Tap to take a break' : 'Tap to go online'}</Text>
        </View>
        <Toggle on={online} onToggle={onToggleOnline} />
      </View>
    </Glass>
  );
}

/* ---------------- legacy in-file switcher (RootNavigator renders HomeMain directly) ---------------- */
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

export function HomeMain({ user, online, onToggleOnline, earnings = 0, navigate, pending, eligible, kycStatus, bankComplete, syncing }) {
  const profile = user?.fulfillerProfile || {};
  const rating = Number(profile.rating ?? 5).toFixed(1);

  // Founding Partner waiver, server-authoritative; active iff the date is in the future.
  const waiverUntil = profile.commissionWaiverUntil ? new Date(profile.commissionWaiverUntil) : null;
  const waiverActive = waiverUntil && waiverUntil.getTime() > Date.now();
  const waiverDaysLeft = waiverActive ? Math.max(0, Math.ceil((waiverUntil.getTime() - Date.now()) / 86400000)) : 0;

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
  const statsLoading = stats.trips === null;
  const pct = Math.round(Math.min(stats.today / DAILY_GOAL, 1) * 100);
  const left = Math.max(DAILY_GOAL - stats.today, 0);

  return (
    <View style={styles.root}>
      <Gradient colors={['#EDF1FA', '#F4F6FB', '#ECEFF6']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill}>
        <Blooms />
      </Gradient>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Partner'}</Text>
            {!!profile.vehicleNumber && (
              <Text style={styles.topSub} numberOfLines={1}>
                {profile.vehicleNumber}{profile.capacityLitres ? ` · ${profile.capacityLitres}L tanker` : ''}
              </Text>
            )}
          </View>
          <View style={styles.topr}>
            <TouchableOpacity style={styles.iconbtn} onPress={() => navigate('settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="settings" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigate('profile')} style={styles.avatar}>
              <Text style={styles.avatarTx}>{initials(user?.name)}</Text>
              <View style={[styles.avatarDot, (eligible && online) && styles.avatarDotOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* KYC blocker, surfaced up top */}
          {!eligible && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigate('kyc')} style={styles.kyc}>
              <View style={styles.kycIc}><Icon name="clock" size={18} color={colors.warning} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kycT}>{pending ? 'Verification in progress' : 'Verification needed to earn'}</Text>
                <Text style={styles.kycS}>{pending ? 'Add your documents to speed things up.' : 'Upload your documents to unlock requests and payouts.'}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.warning} />
            </TouchableOpacity>
          )}

          {/* Founding Partner, commission-waiver badge */}
          {waiverActive && (
            <Glass style={styles.founding}>
              <View style={styles.foundingIc}><Icon name="award" size={18} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.foundingT} numberOfLines={1}>Founding Partner · 0% commission</Text>
                <Text style={styles.foundingS} numberOfLines={1}>
                  {waiverDaysLeft} {waiverDaysLeft === 1 ? 'day' : 'days'} left
                  {profile.commissionWaiverNo ? ` · Partner #${profile.commissionWaiverNo}` : ''}
                </Text>
              </View>
            </Glass>
          )}

          {/* Availability hero */}
          <Hero eligible={eligible} online={online} onToggleOnline={onToggleOnline} pending={pending} kycStatus={kycStatus} navigate={navigate} />

          {/* Today's goal */}
          {eligible && (
            <Glass style={styles.card}>
              <View style={styles.cardH}>
                <Text style={styles.cardT}>Today's goal</Text>
                <View style={styles.cardCap}><View style={styles.liveDot} /><Text style={styles.cardCapTx}>Resets at midnight</Text></View>
              </View>
              {statsLoading ? (
                <View style={styles.goalRow}>
                  <Skeleton width={120} height={120} radius={60} />
                  <View style={{ flex: 1, marginLeft: 18 }}>
                    <Skeleton width={84} height={30} radius={radius.sm} />
                    <Skeleton width={150} height={13} style={{ marginTop: spacing.sm }} />
                  </View>
                </View>
              ) : (
                <View style={styles.goalRow}>
                  <GoalRing earned={stats.today} goal={DAILY_GOAL} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalPct}>{pct}%</Text>
                    {left > 0 ? (
                      <Text style={styles.goalLeft}><Text style={styles.goalLeftB}>₹{left.toLocaleString('en-IN')}</Text> to reach your ₹1,000 goal today.</Text>
                    ) : (
                      <Text style={styles.goalLeft}><Text style={styles.goalDoneB}>Goal smashed!</Text> Every trip from here is a bonus.</Text>
                    )}
                  </View>
                </View>
              )}
            </Glass>
          )}

          {/* Lifetime stats */}
          {eligible && (
            statsLoading ? (
              <Glass style={styles.stats}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.stat}>
                    <Skeleton width={56} height={18} radius={radius.sm} />
                    <Skeleton width={42} height={10} style={{ marginTop: spacing.sm }} />
                  </View>
                ))}
              </Glass>
            ) : (
              <Glass style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statV}>₹{Number(earnings).toLocaleString('en-IN')}</Text>
                  <Text style={styles.statL}>ALL-TIME</Text>
                </View>
                <View style={styles.sep} />
                <View style={styles.stat}>
                  <Text style={styles.statV}>{stats.trips == null ? 'Not set' : String(stats.trips)}</Text>
                  <Text style={styles.statL}>TRIPS</Text>
                </View>
                <View style={styles.sep} />
                <View style={styles.stat}>
                  <View style={styles.statVRow}><Text style={styles.statV}>{rating}</Text><Icon name="star" size={13} color={colors.star} /></View>
                  <Text style={styles.statL}>RATING</Text>
                </View>
              </Glass>
            )
          )}

          {/* Bank / settlement nudge */}
          {!bankComplete && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigate('bank')} style={styles.nudge}>
              <View style={styles.nudgeIc}><Icon name="credit-card" size={17} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nudgeT}>Add your bank details</Text>
                <Text style={styles.nudgeS}>So we can settle your earnings to your account or UPI.</Text>
              </View>
              <Icon name="chevron-right" size={18} color={TX3} />
            </TouchableOpacity>
          )}

          {/* A completed delivery still syncing (offline journal) */}
          {syncing && (
            <View style={styles.syncRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.syncTx}>Syncing your last delivery…</Text>
            </View>
          )}

          {/* Application details (reassurance while pending) */}
          {pending && (
            <Glass style={styles.detailCard}>
              <Text style={styles.detailHead}>YOUR APPLICATION</Text>
              {[['Vehicle', profile.vehicleNumber || 'Not set'], ['Tanker capacity', profile.capacityLitres ? `${profile.capacityLitres} L` : 'Not set'], ['Phone', user?.phone || 'Not set'], ['Email', user?.email || 'Not set']].map(([k, v], i, arr) => (
                <View key={k} style={[styles.detailRow, i < arr.length - 1 && styles.detailDivider]}>
                  <Text style={styles.detailLabel}>{k}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </Glass>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FB' },

  glass: {
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 22,
    shadowColor: '#23438A', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 30, elevation: 4,
  },

  // top bar
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: spacing.sm, paddingBottom: spacing.md },
  greet: { fontSize: 12.5, fontWeight: '600', color: TX2 },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.6, marginTop: 2 },
  topSub: { fontSize: 12, fontWeight: '500', color: TX2, marginTop: 2 },
  topr: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconbtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: GLASS_BORDER },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: GLASS_BORDER },
  avatarTx: { fontSize: 15, fontWeight: '800', color: colors.primary },
  avatarDot: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#F1F4FB', backgroundColor: TX3 },
  avatarDotOn: { backgroundColor: colors.success },

  scroll: { paddingHorizontal: 22, paddingTop: 2, paddingBottom: spacing.xxl },

  // kyc banner
  kyc: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, marginBottom: 16, borderRadius: 18, backgroundColor: 'rgba(245,177,61,0.14)', borderWidth: 1, borderColor: 'rgba(245,177,61,0.42)' },
  kycIc: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,177,61,0.20)' },
  kycT: { fontSize: 13.5, fontWeight: '800', color: '#9A6512', letterSpacing: -0.2 },
  kycS: { fontSize: 12, fontWeight: '500', color: 'rgba(154,101,18,0.85)', marginTop: 1, lineHeight: 16 },

  // founding badge
  founding: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginBottom: 16 },
  foundingIc: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.star },
  foundingT: { fontSize: 13.5, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  foundingS: { fontSize: 12, fontWeight: '600', color: TX2, marginTop: 1 },

  // hero
  hero: { borderRadius: 26, padding: 22, paddingTop: 26, marginBottom: 16, alignItems: 'stretch' },
  heroVisual: { height: 128, alignItems: 'center', justifyContent: 'center' },
  orbOff: { width: 98, height: 98, borderRadius: 49, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,45,105,0.045)', borderWidth: 1, borderColor: LINE },
  orbAmber: { backgroundColor: 'rgba(245,177,61,0.12)', borderColor: 'rgba(245,177,61,0.30)' },
  heroT: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', color: colors.text, marginTop: 6 },
  heroS: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 5, lineHeight: 18, color: TX2 },
  heroCtl: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center' },
  ctlLbl: { fontSize: 13.5, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
  ctlSub: { fontSize: 11, fontWeight: '500', color: TX2, marginTop: 2 },
  verifyBtn: { height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  verifyTx: { color: '#fff', fontWeight: '800', fontSize: 15.5 },

  // sonar
  sonarWrap: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  sring: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderColor: 'rgba(59,111,246,0.45)' },
  sonarCore: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },

  // switch
  switch: { width: 64, height: 36, borderRadius: 20, backgroundColor: 'rgba(20,45,105,0.13)', borderWidth: 1, borderColor: LINE, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.success, borderColor: 'transparent' },
  knob: { position: 'absolute', top: 3, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },

  // goal card
  card: { padding: 18, marginBottom: 16 },
  cardH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardT: { fontSize: 14.5, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  cardCap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardCapTx: { fontSize: 11, fontWeight: '600', color: TX3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 6 },
  ringWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { alignItems: 'center' },
  ringAmt: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.8, lineHeight: 26 },
  ringOf: { fontSize: 10.5, fontWeight: '600', color: TX3, marginTop: 3 },
  barTrack: { width: '78%', height: 11, borderRadius: radius.pill, backgroundColor: RING_TRACK, overflow: 'hidden', marginTop: spacing.lg },
  barFill: { height: 11, borderRadius: radius.pill, backgroundColor: colors.primary },
  goalPct: { fontSize: 32, fontWeight: '800', letterSpacing: -1.2, color: colors.primary },
  goalLeft: { fontSize: 12.5, fontWeight: '500', color: TX2, marginTop: 3, lineHeight: 18 },
  goalLeftB: { color: colors.text, fontWeight: '800' },
  goalDoneB: { color: colors.success, fontWeight: '800' },

  // stats
  stats: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 8 },
  statV: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statVRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statL: { fontSize: 10.5, fontWeight: '600', color: TX3, marginTop: 7, letterSpacing: 0.2 },
  sep: { width: 1, backgroundColor: LINE, marginVertical: 10 },

  // bank nudge
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: GLASS_BORDER },
  nudgeIc: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  nudgeT: { fontSize: 13.5, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  nudgeS: { fontSize: 12, fontWeight: '500', color: TX2, marginTop: 1, lineHeight: 16 },

  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 16, paddingHorizontal: spacing.xs },
  syncTx: { ...type.caption, color: colors.primary },

  // application details (pending)
  detailCard: { padding: 18, marginBottom: 16 },
  detailHead: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: TX3, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: LINE },
  detailLabel: { fontSize: 13, fontWeight: '500', color: TX2 },
  detailValue: { fontSize: 14, fontWeight: '700', color: colors.text, maxWidth: '60%' },
});
