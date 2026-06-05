import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../lib/theme';
import { Header, Card, Input, Button, SectionLabel } from '../components/ui';
import Icon from '../components/Icon';
import { getBank, saveBank } from '../lib/api';
import { useAuth } from '../lib/store';

export default function BankDetailsScreen({ user, onBack }) {
  const b0 = user?.fulfillerProfile?.bank || {};
  const [accountHolder, setHolder] = useState(b0.accountHolder || '');
  const [accountNumber, setNumber] = useState(b0.accountNumber || '');
  const [ifsc, setIfsc] = useState(b0.ifsc || '');
  const [bankName, setBankName] = useState(b0.bankName || '');
  const [upiId, setUpi] = useState(b0.upiId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBank()
      .then((r) => {
        const d = r.data?.data;
        if (!d) return;
        setHolder(d.accountHolder || '');
        setNumber(d.accountNumber || '');
        setIfsc(d.ifsc || '');
        setBankName(d.bankName || '');
        setUpi(d.upiId || '');
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveBank({ accountHolder, accountNumber, ifsc, bankName, upiId });
      if (res.data?.data?.user) useAuth.setState({ user: res.data.data.user });
      Alert.alert('Saved', 'Your settlement details have been updated.');
      onBack?.();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.error || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Settlement details" onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.note}>
            <Icon name="shield" size={16} color={colors.primary} />
            <Text style={styles.noteText}>
              We use these details to settle your earnings in batches. Add a bank account, a UPI ID, or both.
            </Text>
          </View>

          <SectionLabel style={styles.label}>Bank account</SectionLabel>
          <Card style={{ gap: spacing.lg }}>
            <Input label="Account holder name" icon="user" placeholder="As per bank records" value={accountHolder} onChangeText={setHolder} />
            <Input label="Account number" icon="credit-card" keyboardType="number-pad" placeholder="e.g. 50100123456789" value={accountNumber} onChangeText={setNumber} />
            <Input label="IFSC code" icon="hash" autoCapitalize="characters" placeholder="SBIN0001234" value={ifsc} onChangeText={setIfsc} maxLength={11} />
            <Input label="Bank name (optional)" icon="home" placeholder="State Bank of India" value={bankName} onChangeText={setBankName} />
          </Card>

          <SectionLabel style={styles.label}>UPI</SectionLabel>
          <Card>
            <Input label="UPI ID (optional)" icon="at-sign" autoCapitalize="none" placeholder="name@bank" value={upiId} onChangeText={setUpi} />
          </Card>

          <Button label="Save details" icon="check" loading={saving} onPress={save} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  noteText: { ...type.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  label: { marginBottom: spacing.sm, marginTop: spacing.lg },
});
