import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { partnerSignup } from '../lib/api';
import { useAuth } from '../lib/store';
import { colors, spacing, radius } from '../lib/theme';

/**
 * KitUm Partner onboarding (Claude Design: "KitUm Onboarding.html").
 * A 3-step flow in the cobalt brand world: selfie → about you → tanker, ending on an
 * account-created success screen that points to document verification as the next
 * in-app step. Documents (KYC) are done after onboarding, per the design notes.
 */

const STEPS = [
  { t: 'Add your photo', s: 'Customers see this when you arrive, so a clear, friendly selfie builds trust.' },
  { t: 'About you', s: 'Just the basics. Your details stay private.' },
  { t: 'Your tanker', s: 'Your vehicle and how much water it carries.' },
];
const CAPS = [500, 1000, 2000, 5000, 10000];

/* The cobalt header's water-ripple motif (concentric rings from a corner disc). */
function Motif() {
  return (
    <View style={styles.motif} pointerEvents="none">
      <View style={[styles.ripple, styles.r3]} />
      <View style={[styles.ripple, styles.r2]} />
      <View style={[styles.ripple, styles.r1]} />
      <View style={styles.disc} />
    </View>
  );
}

/* A labelled input box matching the design's 56px field. */
function Field({ label, icon, value, onChangeText, placeholder, right, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.lbl}>{label}</Text>
      <View style={[styles.box, focus && styles.boxFocus]}>
        <Feather name={icon} size={19} color={colors.textMuted} style={{ marginRight: spacing.md }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#AEB6C6"
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          {...props}
        />
        {right}
      </View>
    </View>
  );
}

function Trust({ icon, children }) {
  return (
    <View style={styles.trust}>
      <View style={styles.trustIc}><Feather name={icon} size={16} color={colors.primary} /></View>
      <Text style={styles.trustTx}>{children}</Text>
    </View>
  );
}

export default function OnboardingScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const setAuth = useAuth((s) => s.setAuth);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [session, setSession] = useState(null); // held until the success CTA enters the app
  const [photo, setPhoto] = useState(null); // { uri, name, type } camera selfie
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false); // 18+ & DPDP consent (gates account creation)
  const [f, setF] = useState({ name: '', phone: '', email: '', pw: '', veh: '', cap: '2000' });
  const upd = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  // Camera ONLY (no gallery) so the profile photo is a genuine live selfie.
  const takePhoto = async () => {
    setErr('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErr('Camera access is required for your profile photo. Enable it in Settings.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const ext = (a.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
    const type = a.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');
    setPhoto({ uri: a.uri, name: `selfie.${ext}`, type });
  };

  const back = () => {
    setErr('');
    if (step > 0) setStep(step - 1);
    else onBack?.();
  };

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      const res = await partnerSignup({
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.pw,
        phone: f.phone.trim(),
        vehicleNumber: f.veh.trim(),
        capacityLitres: f.cap,
        consent: agree,
        photo,
      });
      // Hold the session and show the success screen; the CTA there enters the app.
      setSession(res.data.data);
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not create your account. Please try again.');
    }
    setBusy(false);
  };

  const next = () => {
    setErr('');
    if (step === 0) {
      if (!photo) return setErr('Please add a profile photo using your camera.');
      return setStep(1);
    }
    if (step === 1) {
      if (!f.name.trim() || !f.email.trim() || f.pw.length < 6) {
        return setErr('Add your name, email and a 6+ character password.');
      }
      return setStep(2);
    }
    if (!f.veh.trim() || !f.cap) return setErr('Add your vehicle number and tanker capacity.');
    if (!agree) return setErr('Please confirm you are 18+ and agree to the Terms & Privacy Policy.');
    return submit();
  };

  const enterApp = () => {
    if (session) setAuth(session.user, session.accessToken, session.refreshToken);
  };

  if (done) {
    return <SuccessView name={f.name} insets={insets} onBack={() => setDone(false)} onContinue={enterApp} />;
  }

  const ctaLabel = step < 2 ? 'Continue' : 'Create my account';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Motif />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Cobalt header */}
        <View style={styles.header}>
          <View style={styles.htop}>
            <TouchableOpacity style={styles.iconbtn} onPress={back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="chevron-left" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.stepcount}>Step {step + 1} of 3</Text>
          </View>
          <Text style={styles.htitle}>{STEPS[step].t}</Text>
          <Text style={styles.hsub}>{STEPS[step].s}</Text>
          <View style={styles.pbar}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.seg, i <= step && styles.segOn]} />
            ))}
          </View>
        </View>

        {/* White form sheet */}
        <View style={styles.sheet}>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={24}
          >
            {step === 0 && (
              <>
                <View style={styles.selfieWrap}>
                  {/* Wrapper so the badge sits OUTSIDE the overflow:hidden circle */}
                  <View style={styles.selfieOuter}>
                    <TouchableOpacity activeOpacity={0.85} onPress={takePhoto} style={[styles.selfie, photo && styles.selfieDone]}>
                      {photo ? (
                        <Image source={{ uri: photo.uri }} style={styles.selfieImg} />
                      ) : (
                        <Feather name="camera" size={42} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    {/* Badge rendered outside the circle so overflow:hidden can't clip it */}
                    <View style={styles.selfieBadge}><Feather name="camera" size={18} color="#fff" /></View>
                  </View>
                  <Text style={[styles.selfieCap, { color: photo ? colors.success : colors.primary }]}>
                    {photo ? 'Photo captured' : 'Tap to take selfie'}
                  </Text>
                  <Text style={styles.selfieHint}>{photo ? 'Tap again to retake' : 'Required, taken with your camera'}</Text>
                </View>
                <Trust icon="user">
                  <Text style={styles.trustB}>Shown to your customers. </Text>
                  They see your photo when you arrive, so they know the right partner is delivering their water.
                </Trust>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Full name" icon="user" value={f.name} onChangeText={upd('name')} placeholder="Rilang Tariang" />
                <Field label="Phone number" icon="phone" value={f.phone} onChangeText={upd('phone')} placeholder="98765 43210" keyboardType="phone-pad" />
                <Field label="Email" icon="mail" value={f.email} onChangeText={upd('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
                <Field
                  label="Password"
                  icon="lock"
                  value={f.pw}
                  onChangeText={upd('pw')}
                  placeholder="Create a password"
                  secureTextEntry={!showPw}
                  right={
                    <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name={showPw ? 'eye-off' : 'eye'} size={19} color={colors.textMuted} />
                    </TouchableOpacity>
                  }
                />
                <Trust icon="lock">
                  <Text style={styles.trustB}>Your details stay private. </Text>
                  We only use them to set up your partner account, never shared with customers.
                </Trust>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Vehicle number" icon="truck" value={f.veh} onChangeText={upd('veh')} placeholder="ML05 A 1234" autoCapitalize="characters" />
                <View style={styles.field}>
                  <Text style={styles.lbl}>Tanker capacity (litres)</Text>
                  <View style={styles.box}>
                    <Feather name="droplet" size={19} color={colors.textMuted} style={{ marginRight: spacing.md }} />
                    <TextInput
                      style={styles.input}
                      value={f.cap}
                      onChangeText={(v) => upd('cap')(v.replace(/\D/g, ''))}
                      placeholder="2000"
                      placeholderTextColor="#AEB6C6"
                      keyboardType="number-pad"
                    />
                    <Text style={styles.suffix}>L</Text>
                  </View>
                  <View style={styles.chips}>
                    {CAPS.map((c) => {
                      const on = String(c) === f.cap;
                      return (
                        <TouchableOpacity key={c} onPress={() => upd('cap')(String(c))} style={[styles.chip, on && styles.chipOn]}>
                          <Text style={[styles.chipTx, on && styles.chipTxOn]}>
                            {c.toLocaleString('en-IN')}<Text style={[styles.chipU, on && styles.chipUOn]}> L</Text>
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <Trust icon="truck">
                  We match you with jobs that fit your tanker, so <Text style={styles.trustB}>no wasted trips</Text> for the wrong load size.
                </Trust>
                <TouchableOpacity activeOpacity={0.75} onPress={() => setAgree((v) => !v)} style={styles.consent}>
                  <View style={[styles.cbox, agree && styles.cboxOn]}>
                    {agree && <Feather name="check" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.ctext}>
                    I confirm I am 18 or older, agree to the Terms &amp; Privacy Policy, and consent to KitUm
                    processing my personal data (my photo, PAN and driver’s licence) to verify and
                    operate my partner account. I can withdraw consent or delete my account anytime.
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {!!err && <Text style={styles.err}>{err}</Text>}
          </KeyboardAwareScrollView>

          {/* Footer CTA */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={next} disabled={busy || (step === 2 && !agree)} style={[styles.cta, (busy || (step === 2 && !agree)) && styles.ctaOff]}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.ctaTx}>{ctaLabel}</Text>
                  <Feather name="arrow-right" size={19} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SuccessView({ name, insets, onBack, onContinue }) {
  const first = (name || '').trim().split(' ')[0];
  const items = ['Profile photo added', 'Personal details', 'Tanker & capacity'];
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Motif />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingBottom: spacing.sm }]}>
          <View style={styles.htop}>
            <TouchableOpacity style={styles.iconbtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="chevron-left" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.stepcount}>Account created</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={styles.success} showsVerticalScrollIndicator={false}>
            <View style={styles.succRing}>
              <View style={styles.succCore}><Feather name="check" size={34} color="#fff" /></View>
            </View>
            <Text style={styles.succT}>Welcome aboard{first ? `, ${first}` : ''}!</Text>
            <Text style={styles.succS}>Your partner profile is ready.</Text>

            <View style={styles.statusChip}>
              <Feather name="check" size={14} color={colors.success} />
              <Text style={styles.statusChipTx}>Profile created</Text>
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={onContinue} style={styles.nextcard}>
              <View style={styles.nIc}><Feather name="credit-card" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nT}>One step left, verify documents</Text>
                <Text style={styles.nS}>Add your PAN & driving licence to start accepting trips.</Text>
              </View>
              <Feather name="arrow-right" size={18} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.checklist}>
              {items.map((it, i) => (
                <View key={i} style={[styles.citem, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.ck}><Feather name="check" size={15} color="#fff" /></View>
                  <Text style={styles.cl}>{it}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.note}>
              You can verify documents now or anytime from your account. We review within <Text style={styles.noteB}>24 hours</Text> of upload.
            </Text>
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { borderTopWidth: 0, paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={onContinue} style={styles.cta}>
              <Text style={styles.ctaTx}>Verify documents now</Text>
              <Feather name="arrow-right" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },

  // ripple motif
  motif: { position: 'absolute', top: 0, right: 0, left: 0, height: 230, overflow: 'hidden' },
  disc: { position: 'absolute', top: -120, right: -96, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.primaryDark },
  ripple: { position: 'absolute', borderRadius: 999, borderWidth: 1.5 },
  r1: { top: -132, right: -108, width: 264, height: 264, borderColor: 'rgba(255,255,255,0.20)' },
  r2: { top: -168, right: -144, width: 336, height: 336, borderColor: 'rgba(255,255,255,0.12)' },
  r3: { top: -208, right: -184, width: 416, height: 416, borderColor: 'rgba(255,255,255,0.06)' },

  // header
  header: { paddingHorizontal: 26, paddingTop: 14, paddingBottom: 18 },
  htop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  iconbtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  stepcount: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  htitle: { fontSize: 27, fontWeight: '800', letterSpacing: -0.8, color: '#fff', marginBottom: 6, lineHeight: 30 },
  hsub: { fontSize: 14, fontWeight: '500', color: colors.primarySoft, opacity: 0.85, marginBottom: 18, lineHeight: 20, maxWidth: 300 },
  pbar: { flexDirection: 'row', gap: 6 },
  seg: { height: 5, borderRadius: 3, flex: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  segOn: { backgroundColor: '#fff' },

  // sheet
  sheet: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  form: { padding: 24, paddingBottom: 12 },

  // fields
  field: { marginBottom: 18 },
  lbl: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8, marginLeft: 2 },
  box: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 16, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 15 },
  boxFocus: { borderColor: colors.primary },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: -0.2, padding: 0 },
  suffix: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },

  // selfie
  selfieWrap: { alignItems: 'center', paddingVertical: 8 },
  // Wrapper gives the badge a positioned parent that is NOT overflow:hidden.
  selfieOuter: { width: 148, height: 148, position: 'relative' },
  selfie: { width: 148, height: 148, borderRadius: 74, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: '#B9C6E8', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  selfieDone: { borderStyle: 'solid', borderColor: colors.success, backgroundColor: '#EAFBF1' },
  selfieImg: { width: 148, height: 148, borderRadius: 74 },
  // Badge sits outside the circle (no clipping), anchored to the wrapper's bottom-right.
  selfieBadge: { position: 'absolute', bottom: 4, right: 4, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  selfieCap: { marginTop: 16, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  selfieHint: { marginTop: 4, fontSize: 13, fontWeight: '500', color: colors.textMuted },

  // trust banner
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: colors.bg, borderRadius: 14, padding: 14, marginTop: 22 },
  trustIc: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  trustTx: { flex: 1, fontSize: 12.5, fontWeight: '500', color: '#475569', lineHeight: 18 },
  trustB: { color: colors.text, fontWeight: '700' },

  // consent + age gate (final step)
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 18 },
  cbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#C8D2E8', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  ctext: { flex: 1, fontSize: 12, lineHeight: 17, color: '#475569' },

  // chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTx: { fontSize: 14, fontWeight: '700', color: colors.text },
  chipTxOn: { color: '#fff' },
  chipU: { fontWeight: '500', color: colors.textMuted, fontSize: 12 },
  chipUOn: { color: 'rgba(255,255,255,0.7)' },

  err: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },

  // footer
  footer: { paddingHorizontal: 24, paddingTop: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F4FA' },
  cta: { height: 58, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ctaOff: { backgroundColor: '#C8D2E8' },
  ctaTx: { color: '#fff', fontWeight: '800', fontSize: 16.5, letterSpacing: -0.2 },

  // success
  success: { alignItems: 'center', padding: 30, paddingTop: 32 },
  succRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  succCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  succT: { fontSize: 24, fontWeight: '800', letterSpacing: -0.7, color: colors.text, marginBottom: 7, textAlign: 'center' },
  succS: { fontSize: 14, fontWeight: '500', color: '#64748B', lineHeight: 21, marginBottom: 16, textAlign: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAFBF1', borderWidth: 1, borderColor: '#BBE9CD', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15, marginBottom: 18 },
  statusChipTx: { color: colors.success, fontWeight: '800', fontSize: 13 },
  nextcard: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: '#D4E0FB', borderRadius: 16, padding: 14, marginBottom: 16 },
  nIc: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nT: { fontSize: 14.5, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  nS: { fontSize: 12.5, fontWeight: '500', color: '#5B6B86', marginTop: 2, lineHeight: 17 },
  checklist: { width: '100%', backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 16, marginBottom: 16 },
  citem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E8ECF5' },
  ck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  cl: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text },
  note: { fontSize: 12.5, color: colors.textMuted, fontWeight: '500', lineHeight: 19, maxWidth: 300, textAlign: 'center' },
  noteB: { color: '#475569', fontWeight: '700' },
});
