import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography } from '../theme';

export default function SettingsScreen({ navigation }: any) {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>({ smartwatchEnabled: false, enableRealTimeTracking: true, enableFormAnalysis: true });
  const [googleFit, setGoogleFit] = useState<any>({ connected: false, tokenValid: false });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const getToken = () => AsyncStorage.getItem('token');

  const fetchSettings = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setGoogleFit(data.googleFit);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const toggleSmartwatch = async () => {
    setToggling(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/settings/smartwatch/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !settings.smartwatchEnabled }),
      });
      const data = await res.json();
      if (res.ok) setSettings(data.settings);
    } catch {}
    setToggling(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.teal600} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Manage your preferences</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Google Fit Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Fit Connection</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="watch" size={20} color={colors.teal600} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Google Fit</Text>
                <Text style={styles.settingDesc}>Connect to track real-time exercise data</Text>
              </View>
              <View style={[styles.statusPill,
                { backgroundColor: googleFit.connected && googleFit.tokenValid ? colors.emerald100 : colors.redLight }]}>
                <View style={[styles.statusDot,
                  { backgroundColor: googleFit.connected && googleFit.tokenValid ? colors.emerald700 : colors.red }]} />
                <Text style={[styles.statusText,
                  { color: googleFit.connected && googleFit.tokenValid ? colors.emerald700 : colors.red }]}>
                  {googleFit.connected && googleFit.tokenValid ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Smartwatch Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracking Options</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="fitness" size={20} color={colors.teal600} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Smartwatch Tracking</Text>
                <Text style={styles.settingDesc}>Enable real-time sensor data during exercises</Text>
              </View>
              <Switch
                value={settings.smartwatchEnabled}
                onValueChange={toggleSmartwatch}
                disabled={toggling}
                trackColor={{ false: colors.slate200, true: colors.teal600 }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* Advanced */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Options</Text>
          <View style={styles.card}>
            {[
              { label: 'Real-time Tracking', desc: 'Stream sensor data continuously', key: 'enableRealTimeTracking' },
              { label: 'Form Analysis', desc: 'Analyze exercise form and posture', key: 'enableFormAnalysis' },
            ].map((item, i) => (
              <View key={item.key} style={[styles.settingRow, i > 0 && styles.settingRowBorder]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingDesc}>{item.desc}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: settings[item.key] ? colors.emerald100 : colors.slate100 }]}>
                  <Text style={[styles.statusText, { color: settings[item.key] ? colors.emerald700 : colors.slate500 }]}>
                    {settings[item.key] ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.card}>
            {[
              { label: 'App Name', value: 'PhysioCheck Patient' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Platform', value: 'React Native / Expo' },
            ].map((r, i) => (
              <View key={r.label} style={[styles.settingRow, i > 0 && styles.settingRowBorder]}>
                <Text style={styles.settingLabel}>{r.label}</Text>
                <Text style={styles.settingValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 80 }]}>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.navy },
  headerSub: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  content: { paddingBottom: 80 },
  section: { padding: spacing.md, paddingBottom: 0 },
  sectionTitle: { ...typography.label, color: colors.slate400, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  settingRowBorder: { borderTopWidth: 1, borderTopColor: colors.slate100 },
  settingIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  settingDesc: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  settingValue: { fontSize: 13, color: colors.slate500, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.red + '40',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.red },
});
