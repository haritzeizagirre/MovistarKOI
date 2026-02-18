import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';

// ─── Loading ───────────────────────────────────────────────────────

interface LoadingIndicatorProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message,
  fullScreen = true,
}) => (
  <View style={[styles.center, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={Colors.primary} />
    {message && <Text style={styles.loadingText}>{message}</Text>}
  </View>
);

// ─── Error ─────────────────────────────────────────────────────────

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ message, onRetry }) => (
  <View style={[styles.center, styles.fullScreen]}>
    <Text style={styles.errorIcon}>⚠️</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    {onRetry && (
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Reintentar</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Empty state ───────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  subtitle,
}) => (
  <View style={[styles.center, styles.fullScreen]}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  errorMessage: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
