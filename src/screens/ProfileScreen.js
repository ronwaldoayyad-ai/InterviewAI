import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, SecondaryButton } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts, spacing, type } from '../theme';

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[type.bodySmall, { flex: 1, marginLeft: spacing.sm }]}>{label}</Text>
      <Text style={[type.label, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut, deleteAllData } = useApp();
  const goals = user?.careerGoals;

  const confirmDelete = () => {
    // GDPR/CCPA: users can permanently delete recordings + data (TDD §5)
    if (Platform.OS === 'web') {
      deleteAllData();
      return;
    }
    Alert.alert(
      'Delete my data',
      'This permanently removes all your recordings, transcripts, and feedback. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: deleteAllData },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={[type.h1, { marginTop: spacing.sm }]}>{user?.name}</Text>
          <Text style={type.bodySmall}>{user?.email}</Text>
        </View>

        <Card>
          <Row icon="shield-checkmark-outline" label="Signed in via" value={user?.authProvider || 'email'} />
          <Row icon="briefcase-outline" label="Target roles" value={goals?.roles?.join(', ') || 'Not set'} />
          <Row icon="business-outline" label="Industries" value={goals?.industries?.join(', ') || 'Not set'} />
          <Row icon="ribbon-outline" label="Experience" value={goals?.experience || 'Not set'} />
        </Card>

        <Text style={[type.h2, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Privacy</Text>
        <Card>
          <Text style={type.bodySmall}>
            Your recordings and transcripts are stored encrypted and are only used to generate your
            feedback. You can permanently delete everything at any time.
          </Text>
          <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete my recordings & data</Text>
          </Pressable>
        </Card>

        <SecondaryButton title="Sign out" icon="log-out-outline" onPress={signOut} style={{ marginTop: spacing.lg }} />
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
          InterviewAI v1.0.0 · Made with the Cognitive Clarity design system
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 34, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
});
