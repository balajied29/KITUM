import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { login as apiLogin, partnerSignup } from '../lib/api';
import { useAuth } from '../lib/store';
import { colors, spacing, radius, type } from '../lib/theme';
import { Button, Input } from '../components/ui';
import Icon from '../components/Icon';

export default function LoginScreen({ initialMode = 'signin', onBack } = {}) {
  const setAuth = useAuth((s) => s.setAuth);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(initialMode); // signin | signup | submitted
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [photo, setPhoto] = useState(null); // { uri, name, type } — camera selfie
  const [agree, setAgree] = useState(false); // 18+ & DPDP consent (signup only)

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

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    vehicleNumber: '',
    capacityLitres: '',
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const switchMode = (m) => {
    setErr('');
    setAgree(false);
    setMode(m);
  };

  const signIn = async () => {
    setErr('');
    setBusy(true);
    try {
      const res = await apiLogin(form.email.trim().toLowerCase(), form.password);
      const { user, accessToken, refreshToken } = res.data.data;
      if (user.role !== 'fulfiller') {
        setErr('This isn’t a delivery partner account.');
        setBusy(false);
        return;
      }
      setAuth(user, accessToken, refreshToken);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Login failed. Check your connection.');
      setBusy(false);
    }
  };

  const apply = async () => {
    setErr('');
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setErr('Name, email and a 6+ character password are required.');
      return;
    }
    if (!photo) {
      setErr('Please add a profile photo using your camera.');
      return;
    }
    if (!agree) {
      setErr('Please confirm you are 18+ and agree to the Terms & Privacy Policy.');
      return;
    }
    setBusy(true);
    try {
      const res = await partnerSignup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        capacityLitres: form.capacityLitres,
        consent: agree,
        photo,
      });
      // Signup returns a session — land straight in the awaiting-approval dashboard.
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not submit your application.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { top: insets.top + spacing.sm }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
      >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Icon name="droplet" size={30} color={colors.onPrimary} />
            </View>
            <Text style={styles.wordmark}>KitUm</Text>
            <Text style={styles.tagline}>Delivery Partner</Text>
          </View>

          {mode === 'submitted' ? (
            <View style={styles.sheet}>
              <View style={styles.successIcon}>
                <Icon name="check" size={30} color={colors.success} />
              </View>
              <Text style={styles.title}>Application received</Text>
              <Text style={styles.subtitle}>
                Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}. Our team will verify your details and activate
                your account. You'll be able to sign in once approved.
              </Text>
              <Button label="Back to sign in" variant="primary" onPress={() => switchMode('signin')} style={{ marginTop: spacing.xl }} />
            </View>
          ) : (
            <View style={styles.sheet}>
              <Text style={styles.title}>{mode === 'signin' ? 'Welcome back' : 'Become a partner'}</Text>
              <Text style={styles.subtitle}>
                {mode === 'signin'
                  ? 'Sign in to start receiving delivery requests.'
                  : 'Tell us about you and your tanker. We’ll verify and get you onboarded.'}
              </Text>

              <View style={styles.form}>
                {mode === 'signup' && (
                  <View style={styles.photoBlock}>
                    <TouchableOpacity onPress={takePhoto} activeOpacity={0.85} style={styles.photoBtn}>
                      {photo ? (
                        <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                      ) : (
                        <Icon name="camera" size={26} color={colors.primary} />
                      )}
                      <View style={styles.photoBadge}>
                        <Icon name="camera" size={12} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.photoLabel}>{photo ? 'Retake photo' : 'Add profile photo'}</Text>
                    <Text style={styles.photoHint}>Required · taken with your camera</Text>
                  </View>
                )}

                {mode === 'signup' && (
                  <>
                    <Input label="Full name" icon="user" placeholder="Rilang Tariang" value={form.name} onChangeText={set('name')} />
                    <Input label="Phone" icon="phone" placeholder="98765 43210" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} />
                  </>
                )}

                <Input
                  label="Email"
                  icon="mail"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={form.email}
                  onChangeText={set('email')}
                />
                <Input label="Password" icon="lock" placeholder="••••••••" secureTextEntry value={form.password} onChangeText={set('password')} />

                {mode === 'signup' && (
                  <>
                    <Input label="Vehicle number" icon="truck" placeholder="ML05 A 1234" autoCapitalize="characters" value={form.vehicleNumber} onChangeText={set('vehicleNumber')} />
                    <Input label="Tanker capacity (litres)" icon="droplet" placeholder="2000" keyboardType="number-pad" value={form.capacityLitres} onChangeText={set('capacityLitres')} />
                  </>
                )}

                {mode === 'signup' && (
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setAgree((v) => !v)} style={styles.consentRow}>
                    <View style={[styles.checkbox, agree && styles.checkboxOn]}>
                      {agree && <Icon name="check" size={13} color="#fff" />}
                    </View>
                    <Text style={styles.consentText}>
                      I confirm I am 18 or older, agree to the Terms & Privacy Policy, and consent to KitUm
                      processing my personal data — including my photo, PAN and driver’s licence — to verify
                      and operate my partner account. I can withdraw consent or delete my account anytime.
                    </Text>
                  </TouchableOpacity>
                )}

                {!!err && (
                  <View style={styles.errBanner}>
                    <Icon name="alert-circle" size={15} color={colors.danger} />
                    <Text style={styles.errText}>{err}</Text>
                  </View>
                )}

                <Button
                  label={mode === 'signin' ? 'Sign in' : 'Submit application'}
                  onPress={mode === 'signin' ? signIn : apply}
                  loading={busy}
                  disabled={mode === 'signup' && !agree}
                  iconRight={mode === 'signin' ? 'arrow-right' : undefined}
                  style={{ marginTop: spacing.sm }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {mode === 'signin' ? 'New partner?' : 'Already a partner?'}
                </Text>
                <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                  <Text style={styles.switchLink}>{mode === 'signin' ? 'Apply to join' : 'Sign in'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  backBtn: { position: 'absolute', left: spacing.lg, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  wordmark: { fontSize: 30, fontWeight: '800', color: colors.onPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl },
  title: { ...type.h1 },

  photoBlock: { alignItems: 'center', marginBottom: spacing.sm },
  photoBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: { width: 96, height: 96, borderRadius: 48 },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  photoLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: spacing.sm },
  photoHint: { ...type.caption, fontSize: 12, marginTop: 1 },
  subtitle: { ...type.caption, marginTop: spacing.xs, lineHeight: 19 },
  form: { marginTop: spacing.xl, gap: spacing.lg },

  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errText: { color: colors.danger, fontSize: 13, fontWeight: '500', flex: 1 },

  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary },

  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  switchText: { ...type.caption },
  switchLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
