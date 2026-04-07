import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE } from '../api';
import { colors, spacing, radius, typography } from '../theme';

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'patient' }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success! 🎉', 'Account created. Please sign in.', [
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Registration Failed', data.message || 'Could not create account.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={['#1D3557', '#457B9D', '#A8DADC']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🏥</Text>
            </View>
            <Text style={styles.brandTitle}>PhysioCheck</Text>
            <Text style={styles.brandSub}>Create your patient account</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSub}>Join PhysioCheck as a patient</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={colors.slate400}
                value={name}
                onChangeText={setName}
              />
            </View>

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
                placeholder="Minimum 6 characters"
                placeholderTextColor={colors.slate400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.cream} />
                : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={styles.backBtnText}>← Back to Sign In</Text>
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
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cardTitle: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  cardSub: { ...typography.body, color: colors.slate500, marginBottom: spacing.lg },
  inputGroup: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.slate500, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.slate900,
  },
  btn: {
    backgroundColor: colors.teal600, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: spacing.md },
  backBtnText: { color: colors.teal600, fontWeight: '700', fontSize: 14 },
});
