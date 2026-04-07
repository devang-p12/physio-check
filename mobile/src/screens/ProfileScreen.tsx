import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography } from '../theme';

export default function ProfileScreen({ navigation }: any) {
  const { name, email, logout } = useAuth();

  const initial = (name || 'P').charAt(0).toUpperCase();
  const joinDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const infoRows = [
    { icon: 'person', label: 'Full Name', value: name || 'Patient' },
    { icon: 'mail', label: 'Email', value: email || 'N/A' },
    { icon: 'calendar', label: 'Member Since', value: joinDate },
    { icon: 'shield-checkmark', label: 'Account Type', value: 'Patient' },
  ];

  const quickLinks = [
    { icon: 'list', label: "Today's Plan", screen: 'TodaysPlan' },
    { icon: 'time', label: 'Session History', screen: 'SessionHistory' },
    { icon: 'medical', label: 'Find Doctors', screen: 'Doctors' },
    { icon: 'settings', label: 'Settings', screen: 'Settings' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <LinearGradient colors={['#1D3557', '#457B9D']} style={styles.hero}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.heroName}>{name || 'Patient'}</Text>
        <Text style={styles.heroEmail}>{email}</Text>
        <View style={styles.heroChip}>
          <Text style={styles.heroChipText}>ACTIVE PATIENT</Text>
        </View>
      </LinearGradient>

      {/* Personal Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.card}>
          {infoRows.map((row, i) => (
            <View key={row.label} style={[styles.infoRow, i < infoRows.length - 1 && styles.infoRowBorder]}>
              <View style={styles.infoIcon}>
                <Ionicons name={row.icon as any} size={18} color={colors.teal600} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Medical Metrics (Placeholder) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Physical Metrics</Text>
        <View style={styles.metricsRow}>
          {[
            { label: 'Height', value: '—', unit: 'cm' },
            { label: 'Weight', value: '—', unit: 'kg' },
            { label: 'Blood Type', value: '—', unit: '' },
          ].map((m) => (
            <View key={m.label} style={styles.metricCard}>
              <Text style={styles.metricValue}>{m.value}</Text>
              <Text style={styles.metricUnit}>{m.unit}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <View style={styles.card}>
          {quickLinks.map((link, i) => (
            <TouchableOpacity
              key={link.label}
              style={[styles.linkRow, i < quickLinks.length - 1 && styles.linkRowBorder]}
              onPress={() => navigation.navigate(link.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.linkIcon}>
                <Ionicons name={link.icon as any} size={18} color={colors.teal600} />
              </View>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <View style={[styles.section, { marginBottom: 60 }]}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  hero: { alignItems: 'center', padding: spacing.xl, paddingTop: 48, gap: spacing.sm },
  avatarCircle: {
    width: 88, height: 88, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },
  heroName: { fontSize: 22, fontWeight: '800', color: colors.white },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginTop: spacing.sm,
  },
  heroChipText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 },

  section: { padding: spacing.md, paddingBottom: 0 },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  infoIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.slate900, marginTop: 2 },

  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  metricUnit: { fontSize: 11, color: colors.slate400 },
  metricLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },

  linkRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  linkRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  linkIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.slate800 },

  logoutBtn: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.red + '40',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.red },
});
