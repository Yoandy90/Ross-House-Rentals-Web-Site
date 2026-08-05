/**
 * Complete Profile Screen - Redirect to Unified Profile
 * This screen now redirects to the unified personal-info screen.
 * Kept for backwards compatibility with existing navigation links.
 */
import { Redirect } from 'expo-router';

export default function CompleteProfile() {
  return <Redirect href="/(tabs)/personal-info" />;
}
