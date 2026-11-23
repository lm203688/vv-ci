import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Local native module (modules/apple-fm). Kept behind a try/catch so the JS bundle
// still loads in environments where the pod is missing (old builds, web preview).
let native = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  native = require('expo').requireNativeModule('AppleFM');
} catch (e) {
  native = null;
}

export function aiAvailability() {
  try {
    if (native) return native.availability();
  } catch (e) {
    // ignore
  }
  return { available: false, reason: 'no-module', backend: 'none' };
}

export async function askAi(prompt, instructions) {
  if (!native) return null;
  try {
    const res = await native.respond(prompt, instructions);
    return res && res.ok && res.text ? res.text : null;
  } catch (e) {
    return null;
  }
}

const REASON_COPY = {
  'apple-intelligence-off':
    'Apple Intelligence is switched off. Turn it on in Settings > Apple Intelligence & Siri.',
  'device-not-eligible': 'This device does not support Apple Intelligence.',
  'model-not-ready': 'Apple Intelligence is still downloading its model. Try again later.',
  'os-too-old': 'Requires iOS 26 or later.',
};

function reasonText(reason) {
  return REASON_COPY[reason] || 'AI assistance is not available on this device.';
}

// A single floating entry that any screen stack can host. Rendering it at the root
// keeps the per-app wiring to one line and gives every tool the same behaviour.
export default function AiAssist(props) {
  const app = props && props.app ? props.app : 'this app';
  const hint = props && props.hint ? props.hint : '';
  const gutter = props && props.gutter ? props.gutter : 0;
  // Apps with a pinned footer bar (job sheet, takeoff total) need to lift the button
  // above it; everything else floats over the scroll content.
  const bottom = props && props.bottom ? props.bottom : 28;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState(() => aiAvailability());

  useEffect(() => {
    // Availability can change while the app is in the foreground (user flips the toggle).
    setState(aiAvailability());
  }, []);

  const instructions = useMemo(() => {
    const base =
      'You are an in-app assistant inside ' +
      app +
      ', an offline iOS tool for trade professionals. Answer in plain American English, ' +
      'at most four short sentences, no markdown, no bullet lists. Give practical numbers and ' +
      'units when the question is a calculation. If the question needs data you do not have, ' +
      'say what to enter instead of guessing.';
    return hint ? base + ' ' + hint : base;
  }, [app, hint]);

  const ask = useCallback(async () => {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError('');
    setAnswer('');
    const text = await askAi(prompt, instructions);
    if (text) {
      setAnswer(text);
    } else {
      setError('No answer came back. Check that Apple Intelligence is on and the model is ready.');
    }
    setBusy(false);
  }, [q, busy, instructions]);

  return (
    <>
      <Pressable
        accessibilityLabel="Ask AI"
        onPress={() => {
          setOpen(true);
          setState(aiAvailability());
        }}
        style={[styles.fab, { bottom }, !state.available && styles.fabDim]}
      >
        <Text style={styles.fabText}>AI</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { marginRight: gutter }]}>
            <View style={styles.head}>
              <Text style={styles.title}>Ask AI</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.close}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.sub}>
              {state.available && state.backend === 'pcc'
                ? 'On-device model is off, so answers come from Apple Private Cloud Compute. No account, no training on your data.'
                : state.available
                ? 'Runs on device with Apple Intelligence. Nothing leaves your phone.'
                : reasonText(state.reason)}
            </Text>

            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ask a question about your numbers…"
              placeholderTextColor="#8A9491"
              multiline
              editable={state.available}
              style={styles.input}
            />

            <Pressable
              onPress={ask}
              disabled={!state.available || busy || !q.trim()}
              style={[
                styles.primary,
                (!state.available || busy || !q.trim()) && styles.primaryDim,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryText}>Ask</Text>
              )}
            </Pressable>

            {(!!answer || !!error) && (
              <ScrollView style={styles.resultBox}>
                <Text style={answer ? styles.answer : styles.err}>{answer || error}</Text>
                {!!answer && (
                  <Text style={styles.disclaimer}>AI can be wrong. Verify before you act on it.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 12,
    height: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabDim: { backgroundColor: '#6B7280' },
  fabText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '82%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '700', color: '#111827' },
  close: { fontSize: 15, fontWeight: '600', color: '#0F766E' },
  sub: { fontSize: 13, color: '#5B6663', marginTop: 6, lineHeight: 18 },
  input: {
    marginTop: 14,
    minHeight: 84,
    borderWidth: 1,
    borderColor: '#DFE5E2',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    textAlignVertical: 'top',
  },
  primary: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDim: { backgroundColor: '#9DB8B4' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultBox: { marginTop: 14, maxHeight: 320 },
  answer: { fontSize: 15, lineHeight: 22, color: '#111827' },
  err: { fontSize: 14, lineHeight: 20, color: '#B42318' },
  disclaimer: { marginTop: 10, fontSize: 12, color: '#7A8481' },
});
