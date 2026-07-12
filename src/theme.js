// "Cognitive Clarity" design tokens (PRD §5, TDD §6)
export const colors = {
  primary: '#3f51b5',
  primaryDark: '#303f9f',
  primaryLight: '#e8eaf6',
  primarySoft: '#c5cae9',
  accent: '#00bfa5',
  accentSoft: '#e0f2f1',
  warning: '#ffa000',
  warningSoft: '#fff8e1',
  danger: '#e53935',
  dangerSoft: '#ffebee',
  success: '#43a047',
  successSoft: '#e8f5e9',
  background: '#f7f8fc',
  surface: '#ffffff',
  border: '#e3e6f0',
  text: '#1a2038',
  textSecondary: '#5a6178',
  textMuted: '#8a91a8',
  recording: '#e53935',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, color: colors.text },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.text },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
};

export const shadow = {
  card: {
    shadowColor: '#1a2038',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#3f51b5',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};
