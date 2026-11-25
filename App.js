// VehicleVault v0.2 — 原生栈导航 + 8pt 网格 + 语义色
// 依据：市场扫描\iOS原生体感设计规范-v1.md 第三节（导航）与第九节（VehicleVault 落点）
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { NavigationContainer, useNavigation, useRoute, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FS from 'expo-file-system/legacy';
import { useTheme } from './src/theme';
import { computeDue, vehicleStatus, formatRemaining } from './src/due';
import { listVehicles, createVehicle, listItems, listLogs, addLog, getDb, getSetting, setSetting } from './src/db';
import { exportCsv, exportPdf, exportCsvToFile, exportPdfToFile } from './src/export';
import { rescheduleAll, countScheduled, hasPermission } from './src/notify';
import { extract, PROVIDERS } from './src/ai';
import { getAiConfig, saveAiConfig, clearAiConfig } from './src/secrets';
import { aiAvailability, askAi } from './src/appleAi';
import { syncWidget } from './src/widget';
import { isDemo, runDemo } from './src/demo';
import FeedbackModal from './src/FeedbackModal';
import { useDuo } from './src/duo';
import AiAssist from './src/aiAssist';

const Stack = createNativeStackNavigator();

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function useUi() { return useTheme(); }

const TYPE_LABEL = { service: 'Service', fuel: 'Fuel', repair: 'Repair', other: 'Other' };

function Row({ children, style }) {
  const { c, s } = useUi();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: s.md, paddingVertical: s.sm + 4, marginBottom: s.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }, style]}>
      {children}
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled }) {
  const { c, s, t } = useUi();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? c.line : c.primary,
        borderRadius: 12,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: s.sm,
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
    >
      <Text style={{ color: disabled ? c.muted : '#FFFFFF', fontSize: t.body, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

function LinkButton({ title, onPress }) {
  const { c, t } = useUi();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
      <Text style={{ color: c.accent, fontSize: t.sub, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, error }) {
  const { c, s, t } = useUi();
  return (
    <View style={{ marginBottom: s.md }}>
      <Text style={{ fontSize: t.caption, color: c.muted, marginBottom: s.xs }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: c.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error ? c.overdue : c.line,
          borderRadius: 12,
          paddingHorizontal: s.md,
          paddingVertical: 12,
          minHeight: 44,
          fontSize: t.body,
          color: c.text,
        }}
        value={String(value ?? '')}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        keyboardType={keyboard || 'default'}
        autoCapitalize="none"
      />
      {error ? <Text style={{ color: c.overdue, fontSize: t.caption, marginTop: s.xs }}>{error}</Text> : null}
    </View>
  );
}

// ---------- 车库 ----------
function GarageScreen() {
  const nav = useNavigation();
  const { c, s, t, statusLabel, statusColor } = useUi();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const vs = await listVehicles();
      const out = [];
      for (const v of vs) {
        const items = await listItems(v.id);
        const due = items.map((i) => computeDue(
          { lastMiles: i.last_miles, lastDate: i.last_date, intervalMiles: i.interval_miles, intervalMonths: i.interval_months },
          { odometer: v.odometer, today: todayStr() }
        ));
        const nextIdx = due.findIndex((d) => d.status !== 'ok');
        const next = nextIdx >= 0 ? due[nextIdx] : null;
        out.push({ v, worst: vehicleStatus(due), next, nextName: nextIdx >= 0 ? items[nextIdx].name : '' });
      }
      if (!cancelled) { setRows(out); setLoading(false); }
      // 桌面小组件：最近一辆车最紧急的一项
      if (out.length) {
        const top = out[0];
        syncWidget({ car: top.v.nickname, label: top.nextName || '', days: top.next ? top.next.daysLeft : 0 });
      }
    };
    load();
    const unsub = nav.addListener('focus', load);
    return () => { cancelled = true; unsub(); };
  }, [nav]);

  return (
    <ScrollView contentContainerStyle={{ padding: s.md, paddingBottom: insets.bottom + s.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }} contentInsetAdjustmentBehavior="automatic">
      {loading && rows.length === 0 && <Text style={{ color: c.muted, fontSize: t.sub }}>Loading…</Text>}
      {!loading && rows.length === 0 && (
        <View style={{ paddingVertical: s.lg }}>
          <Text style={{ fontSize: t.body, color: c.text, marginBottom: s.sm }}>No vehicles yet</Text>
          <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22 }}>
            Add your first car and its next-due countdown shows up here. Everything stays on this phone.
          </Text>
          <PrimaryButton title="Add vehicle" onPress={() => nav.navigate('NewVehicle')} />
        </View>
      )}
      {rows.map(({ v, worst, next }) => (
        <Pressable key={v.id} onPress={() => nav.navigate('Detail', { id: v.id })} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
          <Row style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: t.heading, fontWeight: '600', color: c.text }}>{v.nickname}</Text>
              <Text style={{ fontSize: t.caption, fontWeight: '700', color: statusColor[worst] }}>{statusLabel[worst]}</Text>
            </View>
            <Text style={{ fontSize: t.caption, color: c.muted, marginTop: s.xs }}>
              {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Model not set'} · {v.odometer} mi
            </Text>
            {next ? (
              <Text style={{ fontSize: t.sub, color: c.accent, marginTop: s.sm }}>
                Next: {next.reason === 'never_serviced' ? 'never serviced' : formatRemaining(next.milesLeft, next.daysLeft)}
              </Text>
            ) : (
              <Text style={{ fontSize: t.sub, color: c.muted, marginTop: s.sm }}>All good</Text>
            )}
          </Row>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------- 车辆详情 ----------
function DetailScreen() {
  const nav = useNavigation();
  const { params } = useRoute();
  const { c, s, t, statusLabel, statusColor } = useUi();
  const [v, setV] = useState(null);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const d = await getDb();
      const row = await d.getFirstAsync('SELECT * FROM vehicles WHERE id = ?', [params.id]);
      const its = await listItems(params.id);
      const lgs = await listLogs(params.id);
      if (!cancelled) { setV(row); setItems(its); setLogs(lgs); }
    };
    load();
    const unsub = nav.addListener('focus', load);
    return () => { cancelled = true; unsub(); };
  }, [nav, params.id]);

  const computed = useMemo(() => items.map((i) => ({
    item: i,
    due: computeDue(
      { lastMiles: i.last_miles, lastDate: i.last_date, intervalMiles: i.interval_miles, intervalMonths: i.interval_months },
      { odometer: v?.odometer ?? 0, today: todayStr() }
    ),
  })), [items, v]);

  if (!v) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><Text style={{ color: c.muted }}>Loading…</Text></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: s.md, paddingBottom: s.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }} contentInsetAdjustmentBehavior="automatic">
      <Text style={{ fontSize: t.title, fontWeight: '700', color: c.text }}>{v.nickname}</Text>
      <Text style={{ fontSize: t.caption, color: c.muted, marginTop: s.xs, marginBottom: s.md }}>
        {v.odometer} mi · updated {v.odometer_updated_at || '—'}
      </Text>

      <PrimaryButton title="Add record" onPress={() => nav.navigate('Record', { id: v.id })} />

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.sm }}>Service items</Text>
      {computed.map(({ item, due }) => (
        <Row key={item.id}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: t.body, fontWeight: '600', color: c.text }}>{item.name}</Text>
            <Text style={{ fontSize: t.caption, color: c.muted, marginTop: 2 }}>
              {item.interval_miles} mi / {item.interval_months} mo
              {item.last_date ? ` · last ${item.last_date} @ ${item.last_miles} mi` : ' · not serviced yet'}
            </Text>
          </View>
          <Text style={{ fontSize: t.caption, fontWeight: '700', color: statusColor[due.status] }}>{statusLabel[due.status]}</Text>
        </Row>
      ))}

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.sm }}>Logs</Text>
      {logs.length === 0 && <Text style={{ fontSize: t.sub, color: c.muted }}>No records yet. Tap Add record to start.</Text>}
      {logs.map((l) => (
        <Row key={l.id}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: t.body, fontWeight: '600', color: c.text }}>{TYPE_LABEL[l.type] || l.type}{l.vendor ? ' · ' + l.vendor : ''}</Text>
            <Text style={{ fontSize: t.caption, color: c.muted, marginTop: 2 }}>
              {l.date} · {l.odometer} mi{l.cost != null ? ` · $${l.cost}` : ''}
            </Text>
          </View>
        </Row>
      ))}
    </ScrollView>
  );
}

// ---------- 记录 ----------
function RecordScreen() {
  const nav = useNavigation();
  const { params } = useRoute();
  const { c, s, t } = useUi();
  const pre = (params && params.prefill) || {};
  const [type, setType] = useState(pre.type || 'service');
  const [date, setDate] = useState(todayStr());
  const [odometer, setOdometer] = useState(pre.odometer || '');
  const [cost, setCost] = useState(pre.cost || '');
  const [vendor, setVendor] = useState(pre.vendor || '');
  const [itemId, setItemId] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState({});
  const [photos, setPhotos] = useState([]);
  const [aiNote, setAiNote] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef(null);

  useEffect(() => { listItems(params.id).then(setItems); }, [params.id]);

  // 仅演示构建：自动填表并在 6 秒后走同一条保存路径，便于录屏取证
  const demoDone = useRef(false);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_DEMO !== '1' || demoDone.current) return;
    demoDone.current = true;
    setOdometer('48350');
    setCost('128.40');
    setVendor('Jiffy Lube');
    const tm = setTimeout(async () => {
      try {
        const its = await listItems(params.id);
        await addLog(params.id, {
          type: 'service', date: todayStr(), odometer: 48350, cost: 128.4,
          vendor: 'Jiffy Lube', itemId: its[0] ? its[0].id : null, notes: null, photoUris: [],
        });
      } catch (e) {
        // 演示环境忽略
      }
      nav.goBack();
    }, 25000);
    return () => clearTimeout(tm);
  }, [params.id]);

  const save = async () => {
    const e = {};
    if (!odometer.trim()) e.odometer = 'Enter the current odometer';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Use the date format 2026-11-19';
    setErr(e);
    if (Object.keys(e).length) return;
    await addLog(params.id, {
      type, date, odometer: Number(odometer), cost: cost ? Number(cost) : null,
      vendor, itemId, notes: null, photoUris: photos,
    });
    nav.goBack();
  };

  // 拍一张 → 存进本 App 目录 → 有 key 就让模型抽字段填进表单（结果始终可编辑）
  const shoot = async () => {
    try {
      const shot = await camRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (!shot || !shot.uri) return;
      const dest = FS.documentDirectory + `vv_${Date.now()}.jpg`;
      await FS.copyAsync({ from: shot.uri, to: dest });
      setPhotos((p) => [...p, dest]);
      setCamOpen(false);
      await runAi(dest);
    } catch (e) {
      Alert.alert('Photo failed', String(e && e.message ? e.message : e));
    }
  };

  const runAi = async (uri) => {
    const { provider, key } = await getAiConfig();
    if (!key) { setAiNote('No API key: photo saved, fill the fields by hand'); return; }
    setAiNote('Reading…');
    try {
      const base64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
      const kind = type === 'service' || type === 'repair' ? 'receipt' : 'odometer';
      const r = await extract({ kind, base64, mime: 'image/jpeg', provider, key });
      if (!r.ok) { setAiNote('Could not read this photo; fill the fields by hand'); return; }
      const filled = [];
      if (r.result.odometer != null) { setOdometer(String(r.result.odometer)); filled.push('odometer'); }
      if (r.result.date) { setDate(r.result.date); filled.push('date'); }
      if (r.result.cost != null) { setCost(String(r.result.cost)); filled.push('cost'); }
      if (r.result.vendor) { setVendor(r.result.vendor); filled.push('vendor'); }
      setAiNote(filled.length ? `AI filled: ${filled.join(', ')} — review before saving` : 'No readable fields in this photo');
    } catch (e) {
      setAiNote('Reading failed; fill the fields by hand');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: s.md, paddingBottom: s.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginBottom: s.sm }}>Type</Text>
        <View style={{ flexDirection: 'row', marginBottom: s.md }}>
          {[['service', 'Service'], ['fuel', 'Fuel'], ['repair', 'Repair'], ['other', 'Other']].map(([k, label], idx, arr) => (
            <Pressable key={k} onPress={() => setType(k)}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: type === k ? c.primary : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderTopLeftRadius: idx === 0 ? 10 : 0, borderBottomLeftRadius: idx === 0 ? 10 : 0, borderTopRightRadius: idx === arr.length - 1 ? 10 : 0, borderBottomRightRadius: idx === arr.length - 1 ? 10 : 0 }}>
              <Text style={{ fontSize: t.sub, fontWeight: type === k ? '700' : '400', color: type === k ? '#FFFFFF' : c.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'service' && items.length > 0 && (
          <>
            <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginBottom: s.sm }}>Service item (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s.md }}>
              {items.map((i) => (
                <Pressable key={i.id} onPress={() => setItemId(itemId === i.id ? null : i.id)}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: s.md, marginRight: s.sm, marginBottom: s.sm, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: itemId === i.id ? c.primary : c.line, backgroundColor: itemId === i.id ? c.primary : c.surface }}>
                  <Text style={{ fontSize: t.caption, color: itemId === i.id ? '#FFFFFF' : c.text }}>
                    {itemId === i.id ? '✓ ' : ''}{i.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Field label="Date" value={date} onChange={(v) => { setDate(v); setErr((p) => ({ ...p, date: null })); }} placeholder="2026-11-19" error={err.date} />
        <Field label="Odometer (mi)" value={odometer} onChange={(v) => { setOdometer(v); setErr((p) => ({ ...p, odometer: null })); }} keyboard="numeric" placeholder="12340" error={err.odometer} />
        <Field label="Cost (USD, optional)" value={cost} onChange={setCost} keyboard="decimal-pad" placeholder="89.50" />
        <Field label="Shop / location" value={vendor} onChange={setVendor} placeholder="Jiffy Lube" />

        <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginBottom: s.sm }}>Photos / receipts</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s.sm }}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: s.sm, backgroundColor: c.surface }} />
          ))}
          <Pressable
            onPress={async () => {
              if (!perm || !perm.granted) {
                const r = await requestPerm();
                if (!r || !r.granted) { Alert.alert('No camera access', 'Allow camera in iOS Settings, or type the fields by hand.'); return; }
              }
              setCamOpen(true);
            }}
            style={{ width: 56, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, backgroundColor: c.surface }}>
            <Text style={{ fontSize: t.caption, color: c.accent }}>Photo</Text>
          </Pressable>
        </View>
        {aiNote ? <Text style={{ fontSize: t.caption, color: c.muted, marginBottom: s.sm }}>{aiNote}</Text> : null}

        <PrimaryButton title="Save" onPress={save} />
        <Pressable onPress={() => nav.goBack()} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: s.sm }}>
          <Text style={{ color: c.muted, fontSize: t.sub }}>Cancel</Text>
        </Pressable>
      </ScrollView>
      {camOpen ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
          <CameraView ref={camRef} style={{ flex: 1 }} facing="back" />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' }}>
            <Pressable onPress={shoot} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: '#D1D5DB' }} accessibilityLabel="Take photo" />
            <Pressable onPress={() => setCamOpen(false)} style={{ marginTop: s.md, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: t.sub }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ---------- 新建车辆 ----------
function NewVehicleScreen() {
  const nav = useNavigation();
  const { c, s, t } = useUi();
  const [nickname, setNickname] = useState('My car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [odometer, setOdometer] = useState('');
  const [err, setErr] = useState({});

  const submit = async () => {
    const e = {};
    if (!nickname.trim()) e.nickname = 'Give the car a name';
    if (!odometer.trim()) e.odometer = 'Enter the current odometer';
    setErr(e);
    if (Object.keys(e).length) return;
    await createVehicle({ nickname, make, model, year: year ? Number(year) : null, odometer: Number(odometer), date: todayStr() });
    nav.goBack();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: s.md, paddingBottom: s.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Field label="Nickname" value={nickname} onChange={(v) => { setNickname(v); setErr((p) => ({ ...p, nickname: null })); }} error={err.nickname} />
        <Field label="Make" value={make} onChange={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChange={setModel} placeholder="Camry" />
        <Field label="Year" value={year} onChange={setYear} keyboard="numeric" placeholder="2019" />
        <Field label="Current odometer (mi)" value={odometer} onChange={(v) => { setOdometer(v); setErr((p) => ({ ...p, odometer: null })); }} keyboard="numeric" placeholder="48000" error={err.odometer} />
        <PrimaryButton title="Create" onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- 设置 ----------
function SettingsScreen() {
  const { c, s, t } = useUi();
  const [units, setUnits] = useState('mi');
  const [busy, setBusy] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [scheduled, setScheduled] = useState(0);
  const [vehicle, setVehicle] = useState(null);
  const [probe, setProbe] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiKey, setAiKey] = useState('');
  const [aiSaved, setAiSaved] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiStatus, setAiStatus] = useState({ available: false, reason: 'checking' });
  const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

  useEffect(() => {
    (async () => {
      const u = await getSetting('units', 'mi');
      setUnits(u);
      setScheduled(await countScheduled());
      const ai = await getAiConfig();
      setAiProvider(ai.provider);
      setAiKey(ai.key);
      const vs = await listVehicles();
      setVehicle(vs[0] || null);
      setAiStatus(aiAvailability());
    })();
  }, []);

  // On-device note: the model words what the logbook already knows. Nothing is
  // uploaded and no key is involved, unlike the photo-extraction path above.
  const askOnDevice = async () => {
    if (!vehicle) { Alert.alert('No vehicles yet', 'Add a car first.'); return; }
    if (!aiStatus.available) { Alert.alert('Apple Intelligence unavailable', 'On this phone: ' + aiStatus.reason + '.'); return; }
    setAiBusy(true);
    setAiAnswer(null);
    try {
      const items = await listItems(vehicle.id);
      const facts = items.slice(0, 8)
        .map((i) => i.name + ' every ' + i.interval_miles + ' ' + units + ' or ' + i.interval_months + ' months')
        .join('; ');
      const text = await askAi(
        'Vehicle ' + vehicle.name + ' shows ' + vehicle.odometer + ' ' + units + '. Scheduled items: ' + (facts || 'none yet') + '. In three short sentences, tell the owner what to do next this month.',
        'You are the maintenance assistant inside a vehicle logbook app. Use only these figures, never invent a date, a price or a fault, keep it under 60 words, and add no legal or safety claims.'
      );
      setAiAnswer(text || 'The on-device model returned no answer just now.');
    } catch (e) {
      setAiAnswer('Could not read the logbook: ' + String(e && e.message ? e.message : e));
    } finally {
      setAiBusy(false);
    }
  };

  const saveKey = async () => {
    setBusy(true);
    try {
      await saveAiConfig(aiProvider, aiKey);
      setAiSaved(true);
      Alert.alert('Saved', 'The key lives only in this phone’s Keychain.');
    } catch (e) {
      Alert.alert('Save failed', String(e && e.message ? e.message : e));
    } finally { setBusy(false); }
  };

  const clearKey = async () => {
    setBusy(true);
    try {
      await clearAiConfig();
      setAiKey('');
      setAiSaved(false);
      Alert.alert('Cleared', 'Photos still save; fields go back to manual.');
    } catch (e) {
      Alert.alert('Clear failed', String(e && e.message ? e.message : e));
    } finally { setBusy(false); }
  };

  // 仅演示构建：跑一遍导出内核 + 通知查询，把结果显示在页面上（不弹系统分享面板，避免挡住录屏）
  useEffect(() => {
    if (!DEMO || !vehicle || process.env.EXPO_PUBLIC_SHOTS === '1') return;
    (async () => {
      const lines = [];
      try {
        const items = await listItems(vehicle.id);
        const logs = await listLogs(vehicle.id);
        const computed = items.map((i) => ({
          item: i,
          due: computeDue(
            { lastMiles: i.last_miles, lastDate: i.last_date, intervalMiles: i.interval_miles, intervalMonths: i.interval_months },
            { odometer: vehicle.odometer, today: todayStr() }
          ),
        }));
        const csv = await exportCsvToFile(vehicle, logs);
        lines.push(`CSV ${logs.length} rows ${csv.size} B`);
        const pdf = await exportPdfToFile(vehicle, items, logs, computed);
        lines.push(`PDF ${computed.length} items ${pdf.size} B`);
        const granted = await hasPermission();
        if (granted) {
          const n = await rescheduleAll(vehicle, items, todayStr());
          lines.push(`${n} reminders scheduled`);
        } else {
          lines.push('notifications not allowed (prompt shows on Rebuild)');
        }
        lines.push(`${await countScheduled()} scheduled`);
        const ai = await extract({ kind: 'odometer', base64: 'AAAA' });
        lines.push(`AI no-key fallback ${ai.ok ? 'unexpected' : ai.reason}`);
      } catch (e) {
        lines.push('ERR ' + String(e && e.message ? e.message : e));
      }
      setProbe(lines.join('  |  '));
    })();
  }, [DEMO, vehicle]);

  const changeUnits = async (u) => {
    setUnits(u);
    await setSetting('units', u);
  };

  const doExport = async (kind) => {
    if (!vehicle) { Alert.alert('No vehicles yet', 'Add a car in the garage first, then export.'); return; }
    setBusy(true);
    try {
      const items = await listItems(vehicle.id);
      const logs = await listLogs(vehicle.id);
      const computed = items.map((i) => ({
        item: i,
        due: computeDue(
          { lastMiles: i.last_miles, lastDate: i.last_date, intervalMiles: i.interval_miles, intervalMonths: i.interval_months },
          { odometer: vehicle.odometer, today: todayStr() }
        ),
      }));
      if (kind === 'csv') await exportCsv(vehicle, logs);
      else await exportPdf(vehicle, items, logs, computed);
    } catch (e) {
      Alert.alert('Export failed', String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const rebuildReminders = async () => {
    if (!vehicle) { Alert.alert('No vehicles yet', 'Add a car first.'); return; }
    setBusy(true);
    try {
      const items = await listItems(vehicle.id);
      const n = await rescheduleAll(vehicle, items, todayStr());
      setScheduled(await countScheduled());
      Alert.alert(n > 0 ? 'Reminders rebuilt' : 'Nothing to schedule', n > 0 ? `${n} local notifications scheduled.` : 'Check notification permission, or every item is already overdue.');
    } catch (e) {
      Alert.alert('Scheduling failed', String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: s.md, paddingBottom: s.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }} contentInsetAdjustmentBehavior="automatic">
      {probe ? (
        <Text style={{ fontSize: t.caption, color: c.accent, marginBottom: s.md }}>{probe}</Text>
      ) : null}
      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginBottom: s.sm }}>Units</Text>
      <View style={{ flexDirection: 'row', marginBottom: s.lg }}>
        {[['mi', 'Miles'], ['km', 'Kilometers']].map(([k, label], idx) => (
          <Pressable key={k} onPress={() => changeUnits(k)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: units === k ? c.primary : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderTopLeftRadius: idx === 0 ? 10 : 0, borderBottomLeftRadius: idx === 0 ? 10 : 0, borderTopRightRadius: idx === 1 ? 10 : 0, borderBottomRightRadius: idx === 1 ? 10 : 0 }}>
            <Text style={{ fontSize: t.sub, color: units === k ? '#FFFFFF' : c.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginBottom: s.xs }}>Due reminders</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22, marginBottom: s.sm }}>
        One reminder 30 / 14 / 0 days before each due date, scheduled on-device. {scheduled} queued now.
      </Text>
      <PrimaryButton title={busy ? 'Working…' : 'Rebuild reminders'} onPress={rebuildReminders} disabled={busy} />

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.xs }}>AI fill (optional)</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22, marginBottom: s.sm }}>
        With your own key, a dashboard or receipt photo prefills the form and stays editable. Without one, everything works by hand. The key stays in this phone’s Keychain; requests go straight to the provider.
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: s.sm }}>
        {PROVIDERS.map((p, idx) => (
          <Pressable key={p.id} onPress={() => setAiProvider(p.id)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: aiProvider === p.id ? c.primary : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderTopLeftRadius: idx === 0 ? 10 : 0, borderBottomLeftRadius: idx === 0 ? 10 : 0, borderTopRightRadius: idx === PROVIDERS.length - 1 ? 10 : 0, borderBottomRightRadius: idx === PROVIDERS.length - 1 ? 10 : 0 }}>
            <Text style={{ fontSize: t.caption, color: aiProvider === p.id ? '#FFFFFF' : c.text }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={aiKey}
        onChangeText={(v) => { setAiKey(v); setAiSaved(false); }}
        placeholder="Paste an API key (leave empty for manual mode)"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={{ minHeight: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: s.md, color: c.text, fontSize: t.sub, marginBottom: s.sm }}
      />
      <PrimaryButton title={busy ? 'Working…' : 'Save key'} onPress={saveKey} disabled={busy} />
      {aiKey ? <PrimaryButton title="Clear key" onPress={clearKey} disabled={busy} /> : null}
      {aiSaved ? <Text style={{ fontSize: t.caption, color: c.accent, marginBottom: s.sm }}>Saved</Text> : null}

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.xs }}>On-device AI</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22, marginBottom: s.sm }}>
        {aiStatus.available
          ? 'Apple Intelligence is ready here. It writes the next-service note on this phone — no key, no network, nothing uploaded.'
          : 'Apple Intelligence is not available on this phone (' + aiStatus.reason + '). Everything else still works by hand.'}
      </Text>
      <PrimaryButton
        title={aiBusy ? 'Asking…' : 'Explain my next service'}
        onPress={askOnDevice}
        disabled={aiBusy || !aiStatus.available}
      />
      {aiAnswer ? <Text style={{ fontSize: t.sub, color: c.text, lineHeight: 22, marginTop: s.sm }}>{aiAnswer}</Text> : null}

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.xs }}>Export</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22, marginBottom: s.sm }}>
        Export this car’s service items and every record. The file is built on this phone and handed to the system share sheet.
      </Text>
      <PrimaryButton title="Export CSV" onPress={() => doExport('csv')} disabled={busy} />
      <PrimaryButton title="Export PDF" onPress={() => doExport('pdf')} disabled={busy} />

      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.xs }}>Data</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22 }}>Every record stays on this phone. No account, no cloud.</Text>
      <Text style={{ fontSize: t.caption, fontWeight: '700', color: c.muted, marginTop: s.lg, marginBottom: s.xs }}>Feedback</Text>
      <Text style={{ fontSize: t.sub, color: c.muted, lineHeight: 22, marginBottom: s.sm }}>Wrong reminder, a record that went missing, or a feature you want? Send a report — it opens your own mail app, nothing is uploaded by the app.</Text>
      <PrimaryButton title="Send feedback" onPress={() => setFbOpen(true)} />
      <FeedbackModal visible={fbOpen} onClose={() => setFbOpen(false)} context="settings" accent={c.primary} />
    </ScrollView>
  );
}

export default function App() {
  const duo = useDuo();
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', paddingRight: duo.gutter }}>
      <AppScreens />
      <AiAssist app="VehicleVault" hint="Vehicle service history and maintenance intervals, what to record for resale value." gutter={duo.gutter} />
    </View>
  );
}

function AppScreens() {
  const { c, t } = useUi();
  const navRef = useNavigationContainerRef();

  // 仅演示构建：种示例车 + 固定时间轴 + 步骤标记（不影响生产）
  useEffect(() => {
    if (!isDemo) return undefined;
    return runDemo(navRef);
  }, [navRef]);

  // 快捷指令 / Siri 用 URL scheme 直达（D4 的降级路线）：vehiclevault://log?odometer=12340&type=fuel
  useEffect(() => {
    const handle = async (url) => {
      if (!url || !url.startsWith('vehiclevault://')) return;
      const rest = url.slice('vehiclevault://'.length);
      const [host, query] = rest.split('?');
      const q = {};
      (query || '').split('&').filter(Boolean).forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k) q[k] = decodeURIComponent(v || '');
      });
      if (host === 'log') {
        const vs = await listVehicles();
        if (!vs.length) { Alert.alert('No vehicles yet', 'Add a car in the app first, then use the shortcut.'); return; }
        navRef.navigate('Record', {
          id: vs[0].id,
          prefill: { odometer: q.odometer, cost: q.cost, vendor: q.vendor, type: q.type },
        });
      } else {
        navRef.navigate('Garage');
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => { handle(e.url); });
    return () => sub.remove();
  }, [navRef]);

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { color: c.text, fontSize: t.sub, fontWeight: '600' },
          headerTintColor: c.accent,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="Garage" component={GarageScreen} options={{ title: 'Garage', headerRight: () => <AddButton />, headerLeft: () => <SettingsButton /> }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Vehicle' }} />
        <Stack.Screen name="Record" component={RecordScreen} options={{ title: 'Record', presentation: 'modal' }} />
        <Stack.Screen name="NewVehicle" component={NewVehicleScreen} options={{ title: 'Add vehicle', presentation: 'modal' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AddButton() {
  const nav = useNavigation();
  const { c, t } = useUi();
  return (
    <Pressable onPress={() => nav.navigate('NewVehicle')} hitSlop={12} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Add vehicle">
      <Text style={{ color: c.accent, fontSize: t.body, fontWeight: '600' }}>Add</Text>
    </Pressable>
  );
}

function SettingsButton() {
  const nav = useNavigation();
  const { c, t } = useUi();
  return (
    <Pressable onPress={() => nav.navigate('Settings')} hitSlop={12} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Settings">
      <Text style={{ color: c.accent, fontSize: t.body, fontWeight: '600' }}>Settings</Text>
    </Pressable>
  );
}
