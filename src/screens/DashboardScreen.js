import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ProgressRing from '../components/ProgressRing';
import { Card, PrimaryButton, SectionTitle } from '../components/ui';
import { getCoachTips, getTrends } from '../data/mockAI';
import { useApp } from '../state/AppContext';
import { colors, fonts, spacing, type } from '../theme';

export default function DashboardScreen({ navigation }) {
  const { user, readinessScore, sessions } = useApp();
  const tips = getCoachTips();
  const trends = getTrends();
  const latest = sessions[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={type.caption}>Good to see you</Text>
            <Text style={type.h1}>{user?.name || 'there'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bellBtn} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <View style={styles.badge} />
          </Pressable>
        </View>

        <Card style={styles.readinessCard}>
          <ProgressRing score={readinessScore} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={type.h3}>Interview Readiness</Text>
            <Text style={[type.bodySmall, { marginTop: 4, marginBottom: spacing.sm }]}>
              {sessions.length === 0
                ? 'Complete your first mock interview to start building your score.'
                : `${sessions.length} session${sessions.length > 1 ? 's' : ''} completed. Keep the streak going!`}
            </Text>
            <PrimaryButton
              title="Start practice"
              icon="play"
              onPress={() => navigation.navigate('PracticeTab')}
              style={{ minHeight: 44 }}
            />
          </View>
        </Card>

        <SectionTitle title="Upcoming" />
        <Card>
          <View style={styles.rowCenter}>
            <View style={styles.calBadge}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={type.h3}>Behavioral practice</Text>
              <Text style={type.bodySmall}>Suggested for today · ~15 min</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start suggested session"
              onPress={() => navigation.navigate('PracticeTab')}
              style={styles.goBtn}
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </Card>

        {latest && (
          <>
            <SectionTitle title="Recent feedback" action="See all" onAction={() => navigation.navigate('ProgressTab')} />
            <Card>
              <Text style={type.h3}>{latest.title}</Text>
              <Text style={[type.bodySmall, { marginTop: 4 }]}>
                Communication {latest.summary.communication} · Clarity {latest.summary.clarity}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('SessionSummary', { sessionId: latest.id })}
                style={{ marginTop: spacing.sm }}
              >
                <Text style={styles.linkText}>Review answers →</Text>
              </Pressable>
            </Card>
          </>
        )}

        <SectionTitle title="AI Coach" />
        {tips.map((tip) => (
          <Card key={tip.title} style={{ marginBottom: spacing.sm }}>
            <View style={styles.rowCenter}>
              <View style={styles.coachBadge}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={type.h3}>{tip.title}</Text>
                <Text style={[type.bodySmall, { marginTop: 2 }]}>{tip.body}</Text>
              </View>
            </View>
          </Card>
        ))}

        <SectionTitle title="Industry trends" />
        {trends.map((t) => (
          <Card key={t.title} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.trendTag}>{t.tag.toUpperCase()}</Text>
            <Text style={[type.h3, { marginTop: 4 }]}>{t.title}</Text>
            <Text style={[type.caption, { marginTop: 4 }]}>{t.source}</Text>
          </Card>
        ))}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  readinessCard: { flexDirection: 'row', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  calBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  trendTag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.primary },
});
