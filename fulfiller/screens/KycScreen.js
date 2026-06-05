import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, type } from '../lib/theme';
import { Header, Card, Input, Button, SectionLabel } from '../components/ui';
import Icon from '../components/Icon';
import { getKyc, uploadKyc } from '../lib/api';
import { useAuth } from '../lib/store';

const STATUS = {
  not_submitted: { tone: 'neutral', icon: 'file-text', title: 'Documents required', sub: 'Submit your PAN and driver’s licence to get verified and start working.' },
  pending: { tone: 'warning', icon: 'clock', title: 'Under review', sub: 'We’re verifying your documents. You’ll be cleared to go online once approved.' },
  verified: { tone: 'success', icon: 'check-circle', title: 'Documents verified', sub: 'You’re cleared to go online and receive deliveries.' },
  rejected: { tone: 'danger', icon: 'alert-triangle', title: 'Verification failed', sub: 'Please re-upload clear, valid documents.' },
};
const TONE = {
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

function DocSlot({ label, hint, image, uploaded, onPick }) {
  const has = !!image || uploaded;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPick} style={[styles.slot, has && styles.slotFilled]}>
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Icon name={uploaded ? 'check' : 'camera'} size={22} color={uploaded ? colors.success : colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: spacing.lg }}>
        <Text style={styles.slotLabel}>{label}</Text>
        <Text style={[styles.slotHint, image && { color: colors.primary }]}>
          {image ? 'New photo ready' : uploaded ? 'Uploaded' : hint}
        </Text>
      </View>
      <Icon name={has ? 'edit-2' : 'plus'} size={18} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function KycScreen({ user, onBack }) {
  const k0 = user?.fulfillerProfile?.kyc || {};
  const [status, setStatus] = useState(k0.status || 'not_submitted');
  const [has, setHas] = useState({ pan: !!k0.panKey, dlFront: !!k0.dlFrontKey, dlBack: !!k0.dlBackKey });
  const [rejection, setRejection] = useState(k0.rejectionReason || '');

  const [panImage, setPanImage] = useState(null);
  const [dlFrontImage, setDlFront] = useState(null);
  const [dlBackImage, setDlBack] = useState(null);
  const [panNumber, setPanNumber] = useState(k0.panNumber || '');
  const [dlNumber, setDlNumber] = useState(k0.dlNumber || '');
  const [busy, setBusy] = useState(false);

  // Refresh from server so freshly-verified/rejected state is accurate.
  useEffect(() => {
    getKyc()
      .then((r) => {
        const d = r.data?.data;
        if (!d) return;
        setStatus(d.status);
        setHas({ pan: d.hasPan, dlFront: d.hasDlFront, dlBack: d.hasDlBack });
        setRejection(d.rejectionReason || '');
        if (d.panNumber) setPanNumber(d.panNumber);
        if (d.dlNumber) setDlNumber(d.dlNumber);
      })
      .catch(() => {});
  }, []);

  const pickFrom = async (mode, setter, label) => {
    try {
      const perm =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', `Allow ${mode === 'camera' ? 'camera' : 'photo'} access to add your ${label.toLowerCase()}.`);
        return;
      }
      // allowsEditing brings up the built-in crop tool so partners can frame
      // just the document (trim background, straighten edges) before uploading.
      const opts = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true };
      const res = mode === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setter({
        uri: a.uri,
        name: a.fileName || `${label.replace(/\s+/g, '-').toLowerCase()}.jpg`,
        type: a.mimeType || 'image/jpeg',
      });
    } catch {
      Alert.alert('Could not add image', 'Please try again.');
    }
  };

  const choose = (setter, label) =>
    Alert.alert(label, 'Add a clear, well-lit photo.', [
      { text: 'Take photo', onPress: () => pickFrom('camera', setter, label) },
      { text: 'Choose from gallery', onPress: () => pickFrom('library', setter, label) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const readyCount = [has.pan || panImage, has.dlFront || dlFrontImage, has.dlBack || dlBackImage].filter(Boolean).length;
  const dirty = !!(panImage || dlFrontImage || dlBackImage) || panNumber !== (k0.panNumber || '') || dlNumber !== (k0.dlNumber || '');

  const submit = async () => {
    setBusy(true);
    try {
      const res = await uploadKyc({
        panImage,
        dlFrontImage,
        dlBackImage,
        panNumber: panNumber.trim(),
        dlNumber: dlNumber.trim(),
      });
      const data = res.data?.data;
      if (data?.user) useAuth.setState({ user: data.user });
      if (data?.kyc) {
        setStatus(data.kyc.status);
        setHas({ pan: data.kyc.hasPan, dlFront: data.kyc.hasDlFront, dlBack: data.kyc.hasDlBack });
        setRejection(data.kyc.rejectionReason || '');
      }
      setPanImage(null);
      setDlFront(null);
      setDlBack(null);
      const complete = data?.kyc?.status === 'pending' || data?.kyc?.status === 'verified';
      Alert.alert(
        complete ? 'Submitted for review' : 'Saved',
        complete
          ? 'Thanks! We’ll verify your documents shortly.'
          : 'Add the remaining document to submit for verification.'
      );
    } catch (e) {
      Alert.alert('Upload failed', e?.response?.data?.error || 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const s = STATUS[status] || STATUS.not_submitted;
  const t = TONE[s.tone];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Verification" onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Status banner */}
          <Card style={[styles.banner, { backgroundColor: t.bg, borderColor: 'transparent' }]}>
            <Icon name={s.icon} size={24} color={t.fg} />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <Text style={[styles.bannerTitle, { color: t.fg }]}>{s.title}</Text>
              <Text style={styles.bannerSub}>{s.sub}</Text>
              {status === 'rejected' && !!rejection && <Text style={styles.bannerReason}>Reason: {rejection}</Text>}
            </View>
          </Card>

          <SectionLabel style={styles.label}>PAN card</SectionLabel>
          <Card style={{ gap: spacing.lg }}>
            <DocSlot label="PAN card photo" hint="Tap to add" image={panImage} uploaded={has.pan} onPick={() => choose(setPanImage, 'PAN card')} />
            <Input label="PAN number" icon="credit-card" autoCapitalize="characters" placeholder="ABCDE1234F" value={panNumber} onChangeText={setPanNumber} maxLength={10} />
          </Card>

          <SectionLabel style={styles.label}>Driver’s licence</SectionLabel>
          <Card style={{ gap: spacing.lg }}>
            <DocSlot label="Licence — front" hint="Tap to add" image={dlFrontImage} uploaded={has.dlFront} onPick={() => choose(setDlFront, 'Licence front')} />
            <DocSlot label="Licence — back" hint="Tap to add" image={dlBackImage} uploaded={has.dlBack} onPick={() => choose(setDlBack, 'Licence back')} />
            <Input label="Licence number" icon="hash" autoCapitalize="characters" placeholder="ML01 2020 1234567" value={dlNumber} onChangeText={setDlNumber} />
          </Card>

          <View style={styles.progress}>
            <Icon name={readyCount === 3 ? 'check-circle' : 'info'} size={14} color={readyCount === 3 ? colors.success : colors.textMuted} />
            <Text style={styles.progressText}>{readyCount} of 3 documents added</Text>
          </View>

          <Button
            label={status === 'verified' ? 'Update documents' : readyCount === 3 ? 'Submit for verification' : 'Save documents'}
            icon="upload"
            loading={busy}
            disabled={!dirty}
            onPress={submit}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.privacy}>Your documents are stored securely and used only to verify your account.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },

  banner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  bannerSub: { ...type.caption, marginTop: 2, lineHeight: 18 },
  bannerReason: { ...type.caption, color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },

  label: { marginBottom: spacing.sm, marginTop: spacing.lg },

  slot: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md },
  slotFilled: { borderStyle: 'solid', borderColor: colors.primaryBorder },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  slotLabel: { ...type.body, fontWeight: '700' },
  slotHint: { ...type.caption, marginTop: 1 },

  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  progressText: { ...type.caption, fontWeight: '600' },

  privacy: { ...type.caption, textAlign: 'center', marginTop: spacing.lg, color: colors.textMuted },
});
