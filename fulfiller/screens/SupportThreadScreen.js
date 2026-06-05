import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, spacing, radius, type } from '../lib/theme';
import { Header, Pill } from '../components/ui';
import Icon from '../components/Icon';
import { getTicket, replyTicket, closeTicket } from '../lib/api';

const STATUS = {
  open: { tone: 'warning', label: 'Open' },
  in_progress: { tone: 'primary', label: 'In progress' },
  resolved: { tone: 'success', label: 'Resolved' },
  closed: { tone: 'neutral', label: 'Closed' },
};
const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function SupportThreadScreen({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const load = () =>
    getTicket(ticketId)
      .then((r) => setTicket(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isClosed = ticket?.status === 'closed';
  const s = STATUS[ticket?.status] || STATUS.open;

  const send = async () => {
    const msg = reply.trim();
    if (!msg) return;
    setBusy(true);
    try {
      const r = await replyTicket(ticketId, msg);
      setTicket(r.data?.data);
      setReply('');
    } catch (e) {
      Alert.alert('Could not send', e?.response?.data?.error || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () =>
    Alert.alert('Close request', 'Mark this request as closed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await closeTicket(ticketId);
            setTicket(r.data?.data);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.error || 'Could not close the request.');
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root}>
      <Header title="Request" onBack={onBack} right={ticket ? <Pill label={s.label} tone={s.tone} /> : null} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : !ticket ? (
          <View style={styles.center}><Text style={type.caption}>Couldn’t load this request.</Text></View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Text style={styles.subject}>{ticket.subject}</Text>
              <Text style={styles.meta}>
                #{ticket._id.slice(-6).toUpperCase()}{ticket.topic ? ` · ${ticket.topic}` : ''}
              </Text>

              <View style={{ height: spacing.lg }} />

              {(ticket.messages || []).map((m, i) => {
                const mine = m.from !== 'support'; // the partner's own messages
                return (
                  <View key={i} style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                      <Text style={[styles.bubbleText, mine && { color: colors.onPrimary }]}>{m.body}</Text>
                      <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.75)' }]}>
                        {mine ? 'You' : 'Support'} · {fmtTime(m.at)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {ticket.status === 'resolved' && (
                <Text style={styles.note}>Marked resolved — reply below if you still need help.</Text>
              )}
            </ScrollView>

            {isClosed ? (
              <View style={styles.closedBar}>
                <Text style={styles.closedText}>This request is closed. Start a new one from Help &amp; support.</Text>
              </View>
            ) : (
              <>
                <View style={styles.composer}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type a reply…"
                    placeholderTextColor={colors.textMuted}
                    value={reply}
                    onChangeText={setReply}
                    multiline
                  />
                  <TouchableOpacity onPress={send} disabled={busy || !reply.trim()} style={[styles.sendBtn, (busy || !reply.trim()) && { opacity: 0.5 }]}>
                    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="send" size={18} color="#fff" />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={close} style={styles.closeLink} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={styles.closeLinkText}>Close this request</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.lg },

  subject: { ...type.h2 },
  meta: { ...type.caption, marginTop: 2 },

  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: radius.sm },
  bubbleText: { ...type.body, lineHeight: 20 },
  bubbleTime: { fontSize: 10.5, fontWeight: '600', color: colors.textMuted, marginTop: 4 },

  note: { ...type.caption, textAlign: 'center', marginTop: spacing.md },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  closeLink: { alignSelf: 'center', paddingVertical: spacing.md },
  closeLinkText: { ...type.caption, color: colors.danger, fontWeight: '600' },

  closedBar: { padding: spacing.xl, alignItems: 'center' },
  closedText: { ...type.caption, textAlign: 'center' },
});
