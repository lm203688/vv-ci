// Shared feedback modal (JS build) — VehicleVault.
// Mount it anywhere in the tree: <FeedbackModal visible={open} onClose={...} />
// No network calls, no analytics: the report is shown to the user and handed to
// their own mail client or share sheet.

import React, { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import * as fb from './feedback';

function appMeta() {
  let version = '1.0.1';
  let build = '1';
  try {
    // eslint-disable-next-line global-require
    const cfg = require('../app.json');
    version = (cfg && cfg.expo && cfg.expo.version) || version;
    build = String((cfg && cfg.expo && cfg.expo.ios && cfg.expo.ios.buildNumber) || build);
  } catch (e) {}
  let locale = 'en-US';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale || locale;
  } catch (e) {}
  return {
    version,
    build,
    device: Platform.OS === 'ios' ? 'iPhone' : Platform.OS,
    os: `${Platform.OS} ${Platform.Version}`,
    locale,
  };
}

export default function FeedbackModal({ visible, onClose, accent = '#1F5F3F', context = null }) {
  const [category, setCategory] = useState('new_request');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(false);

  const meta = useMemo(appMeta, []);
  const bundle = useMemo(
    () => ({ ...fb.buildBundle({ category, note, context }, meta), id: fb.nextId([]) }),
    [category, note, context, meta]
  );

  const send = async () => {
    const url = fb.toMailto(bundle);
    const ok = await Linking.canOpenURL(`mailto:${fb.FEEDBACK_EMAIL}`).catch(() => false);
    if (ok) {
      Linking.openURL(url).catch(() =>
        Alert.alert('No mail app', 'Use “Copy / share report” instead, then send it from any device.')
      );
    } else {
      Alert.alert('No mail app found', 'Use “Copy / share report” to send the report another way.');
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: fb.toText(bundle), title: `${bundle.id} VehicleVault feedback` });
    } catch (e) {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.h1}>Send feedback</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sub}>
              {bundle.id} · goes straight to the developer. Nothing is uploaded from this app.
            </Text>

            <Text style={styles.label}>What kind</Text>
            <View style={styles.chips}>
              {fb.CATEGORIES.map((k) => {
                const on = category === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setCategory(k)}
                    style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
                  >
                    <Text style={[styles.chipText, on && { color: '#FFF' }]}>{fb.CATEGORY_LABELS[k]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>What happened</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1200}
              placeholder="What you did, what you expected, what you saw."
              placeholderTextColor="#8A8F98"
              style={styles.input}
            />
            <Text style={styles.sub}>
              Do not type personal details. Values you entered are not attached automatically.
            </Text>

            <Pressable onPress={() => setPreview((p) => !p)} style={{ marginTop: 14 }}>
              <Text style={[styles.link, { color: accent }]}>{preview ? 'Hide report' : 'Preview report'}</Text>
            </Pressable>
            {preview ? (
              <View style={styles.box}>
                <Text style={styles.mono}>{fb.toText(bundle)}</Text>
              </View>
            ) : null}

            <Pressable onPress={send} style={[styles.btn, { backgroundColor: accent, marginTop: 18 }]}>
              <Text style={styles.btnText}>Send with mail</Text>
            </Pressable>
            <Pressable onPress={share} style={[styles.btn, styles.ghost, { marginTop: 10 }]}>
              <Text style={[styles.btnText, { color: accent }]}>Copy / share report</Text>
            </Pressable>
            <Text style={styles.foot}>
              The report contains the app version, device, OS, your category and your note — nothing else.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '92%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 22, fontWeight: '700', color: '#111418' },
  close: { paddingVertical: 6, paddingHorizontal: 4 },
  closeText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 6, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#111418', marginTop: 16, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 13, color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    minHeight: 110,
    fontSize: 15,
    color: '#111418',
    textAlignVertical: 'top',
  },
  link: { fontSize: 15, fontWeight: '600' },
  box: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#FAFAFA' },
  mono: { fontSize: 12, color: '#374151', lineHeight: 18 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ghost: { borderWidth: 1, borderColor: '#D5D9DE' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  foot: { fontSize: 12, color: '#8A8F98', marginTop: 14, lineHeight: 17 },
});
