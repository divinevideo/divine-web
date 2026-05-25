// ABOUTME: Probe hook to check if the external verification service is reachable
// ABOUTME: Returns false if baseUrl is empty, feature flag off, or health check fails

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG, getFeatureFlag } from '@/config/api';

export function useVerificationServiceAvailable(): boolean {
  const baseUrl = API_CONFIG.verificationService.baseUrl;
  const enabled = !!baseUrl && getFeatureFlag('useVerificationService');

  const { data } = useQuery({
    queryKey: ['verification-service-health'],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'HEAD',
        signal,
      });
      return response.ok;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return enabled && (data ?? false);
}
