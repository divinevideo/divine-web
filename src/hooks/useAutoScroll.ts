import { useAppContext } from "@/hooks/useAppContext";

/**
 * Hook to get and set the auto-scroll feature
 * @returns Auto-scroll context with autoScroll and setAutoScroll
 */
export function useAutoScroll(): {
  autoScroll: boolean;
  setAutoScroll: (enabled: boolean) => void;
} {
  const { config, updateConfig } = useAppContext();

  return {
    autoScroll: config.autoScroll,
    setAutoScroll: (enabled: boolean) => {
      updateConfig((currentConfig) => ({
        ...currentConfig,
        autoScroll: enabled,
      }));
    }
  };
}

