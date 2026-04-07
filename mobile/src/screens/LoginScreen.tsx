import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../api';
import { colors, spacing, radius, typography } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (data.user?.role !== 'patient' && data.user?.role !== 'Patient') {
          Alert.alert('Access Denied', 'This app is for patients only. Please use the web dashboard.');
          return;
        }
        await login(data.token, data.user?.name || email.split('@')[0], email, data.user?.role || 'patient');
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Could not connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={['#1D3557', '#457B9D', '#A8DADC']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Logo / Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🏥</Text>
            </View>
            <Text style={styles.brandTitle}>PhysioCheck</Text>
            <Text style={styles.brandSub}>Your recovery companion</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to your patient account</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="patient@example.com"
                placeholderTextColor={colors.slate400}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.slate400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.cream} />
                : <Text style={styles.loginBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={styles.registerLink}>
                Don't have an account?{' '}
                <Text style={styles.registerLinkBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  logoEmoji: { fontSize: 36 },
  brandTitle: { ...typography.h1, color: colors.white, textAlign: 'center' },
  brandSub: { ...typography.body, color: 'rgba(255,255,255,0.75)', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cardTitle: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  cardSub: { ...typography.body, color: colors.slate500, marginBottom: spacing.lg },
  inputGroup: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.slate500, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 15, color: colors.slate900,
  },
  loginBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: colors.cream, fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.slate200 },
  dividerText: { ...typography.caption, color: colors.slate400 },
  registerLink: { textAlign: 'center', color: colors.slate500, fontSize: 14 },
  registerLinkBold: { color: colors.teal600, fontWeight: '700' },
});
