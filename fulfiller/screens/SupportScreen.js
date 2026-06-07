import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../lib/theme';
import { Header, Card, Input, Button, SectionLabel, MenuRow, Pill, Skeleton } from '../components/ui';
import Icon from '../components/Icon';
import { getMyTickets, createTicket } from '../lib/api';
import { SUPPORT_PHONE, SUPPORT_EMAIL } from '../lib/support';
import { SUPPORT_TEMPLATES } from '../constants/supportTemplates';
import SupportThreadScreen from './SupportThreadScreen';

const STATUS = {
  open: { tone: 'warning', label: 'Open' },
  in_progress: { tone: 'primary', label: 'In progress' },
  resolved: { tone: 'success', label: 'Resolved' },
  closed: { tone: 'neutral', label: 'Closed' },
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function SupportScreen({ user, onBack, seedTemplate }) {
  // Opened with a seed (e.g. a vehicle-change request) → jump straight to compose.
  const [mode, setMode] = useState(seedTemplate ? 'new' : 'list'); // list | new | thread
  const [template, setTemplate] = useState(seedTemplate || null);
  const [ticketId, setTicketId] = useState(null);

  const [tickets, setTickets] = useState(null); // null = loading
  const load = () =>
    getMyTickets()
      .then((r) => setTickets(r.data?.data || []))
      .catch(() => setTickets([]));
  useEffect(() => { load(); }, []);

  if (mode === 'thread' && ticketId) {
    return <SupportThreadScreen ticketId={ticketId} onBack={() => { setMode('list'); load(); }} />;
  }
  if (mode === 'new') {
    return (
      <NewRequest
        user={user}
        template={template}
        onBack={() => setMode('list')}
        onCreated={(t) => { setTicketId(t._id); setMode('thread'); }}
      />
    );
  }

  const openThread = (id) => { setTicketId(id); setMode('thread'); };
  const startNew = (tpl) => { setTemplate(tpl); setMode('new'); };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="Help & support" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Quick contact */}
        <Card padded={false} style={styles.menuCard}>
          <MenuRow icon="phone" label="Call us" value={SUPPORT_PHONE} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`).catch(() => {})} />
          <MenuRow icon="mail" label="Email us" value={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} last />
        </Card>

        {/* Existing requests */}
        <SectionLabel style={styles.label}>Your requests</SectionLabel>
        {tickets == null ? (
          <Card padded={false} style={styles.menuCard}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={[styles.ticketRow, i < 3 && styles.divider]}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Skeleton width="65%" height={15} />
                  <Skeleton width="40%" height={11} style={{ marginTop: spacing.xs }} />
                </View>
                <Skeleton width={72} height={24} radius={radius.pill} />
              </View>
            ))}
          </Card>
        ) : tickets.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No requests yet. Pick a topic below and our team will help you out.</Text>
          </Card>
        ) : (
          <Card padded={false} style={styles.menuCard}>
            {tickets.map((t, i) => {
              const s = STATUS[t.status] || STATUS.open;
              return (
                <TouchableOpacity
                  key={t._id}
                  activeOpacity={0.7}
                  onPress={() => openThread(t._id)}
                  style={[styles.ticketRow, i < tickets.length - 1 && styles.divider]}
                >
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject || 'Support request'}</Text>
                    <Text style={styles.ticketMeta}>#{t._id.slice(-6).toUpperCase()} · {fmtDate(t.updatedAt)}</Text>
                  </View>
                  <Pill label={s.label} tone={s.tone} />
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Start a new request from a topic */}
        <SectionLabel style={styles.label}>Start a request</SectionLabel>
        {SUPPORT_TEMPLATES.map((g) => (
          <View key={g.group} style={{ marginBottom: spacing.md }}>
            <Text style={styles.groupLabel}>{g.group}</Text>
            <Card padded={false} style={styles.menuCard}>
              {g.items.map((it, i) => (
                <MenuRow key={it.id} icon="message-square" label={it.label} onPress={() => startNew(it)} last={i === g.items.length - 1} />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NewRequest({ user, template, onBack, onCreated }) {
  const [subject, setSubject] = useState(template?.subject || '');
  const [message, setMessage] = useState(template?.body || '');
  const [contactPhone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Add details', 'Please add a subject and describe your issue.');
      return;
    }
    setBusy(true);
    try {
      const res = await createTicket({
        category: template?.category || 'other',
        topic: template?.label || undefined,
        subject: subject.trim(),
        message: message.trim(),
        contactPhone: contactPhone.trim() || undefined,
      });
      const t = res.data?.data;
      if (t?._id) onCreated(t);
      else onBack();
    } catch (e) {
      Alert.alert('Could not submit', e?.response?.data?.error || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Header title="New request" onBack={onBack} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
      >
          {!!template?.label && (
            <View style={styles.topicTag}>
              <Icon name="tag" size={13} color={colors.primary} />
              <Text style={styles.topicTagText}>{template.label}</Text>
            </View>
          )}
          <Card style={{ gap: spacing.lg }}>
            <Input label="Subject" icon="edit-3" placeholder="Brief summary" value={subject} onChangeText={setSubject} />
            <View>
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Tell us what happened…"
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Input label="Contact phone (optional)" icon="phone" keyboardType="phone-pad" placeholder="+91 …" value={contactPhone} onChangeText={setPhone} />
          </Card>
          <Button label="Submit request" icon="send" loading={busy} onPress={submit} style={{ marginTop: spacing.xl }} />
          <Text style={styles.helpNote}>Our team usually replies within a few hours. You’ll see replies here in the app.</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },

  label: { marginBottom: spacing.sm, marginTop: spacing.lg },
  menuCard: { paddingHorizontal: spacing.lg },
  groupLabel: { ...type.caption, fontWeight: '700', marginBottom: spacing.xs, marginLeft: spacing.xs },

  empty: { ...type.caption, lineHeight: 19 },

  ticketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  ticketSubject: { ...type.body, fontWeight: '700' },
  ticketMeta: { ...type.caption, marginTop: 1 },

  topicTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, marginBottom: spacing.md },
  topicTagText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  fieldLabel: { ...type.label, marginBottom: spacing.sm },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 130,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  helpNote: { ...type.caption, textAlign: 'center', marginTop: spacing.lg, color: colors.textMuted },
});
