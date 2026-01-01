import { ReactNode, useEffect, useState } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType, type Theme } from '@/contexts/AppContext';
import { LoginDialogProvider } from '@/contexts/LoginDialogContext';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
  /** Optional list of preset relays to display in the RelaySelector */
  presetRelays?: { name: string; url: string }[];
}

// Zod schema for AppConfig validation
const AppConfigSchema: z.ZodType<AppConfig, z.ZodTypeDef, unknown> = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  autoScroll: z.boolean().default(false),
  relayUrl: z.string().url(),
});

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
    presetRelays,
  } = props;

  // App configuration state with localStorage persistence
  const [config, setConfig] = useLocalStorage<AppConfig>(
    storageKey,
    defaultConfig,
    {
      serialize: JSON.stringify,
      deserialize: (value: string) => {
        const parsed = JSON.parse(value);
        const validated = AppConfigSchema.parse(parsed);
        // Always use relayUrls from defaultConfig, don't persist in localStorage
        return {
          ...validated,
          relayUrls: defaultConfig.relayUrls,
        };
      }
    }
  );

  // Recording state (not persisted)
  const [isRecording, setIsRecording] = useState(false);

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: AppConfig) => AppConfig) => {
    setConfig(updater);
  };

  const appContextValue: AppContextType = {
    config,
    updateConfig,
    presetRelays,
    isRecording,
    setIsRecording,
  };

  // Apply theme effects to document
  useApplyTheme(config.theme);

  return (
    <AppContext.Provider value={appContextValue}>
      <LoginDialogProvider>
        {children}
      </LoginDialogProvider>
    </AppContext.Provider>
  );
}

/**
 * Hook to apply theme changes to the document root
 * Respects user's theme preference (light, dark, or system)
 */
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const root = window.document.documentElement;

    // Determine the actual theme to apply
    let effectiveTheme: "light" | "dark" = "light";
    
    if (theme === "system") {
      // Check system preference
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveTheme = systemPrefersDark ? "dark" : "light";
    } else {
      effectiveTheme = theme;
    }

    // Apply the theme class
    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);

    // Also listen for system theme changes when using "system" mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (event: MediaQueryListEvent) => {
        root.classList.remove("light", "dark");
        root.classList.add(event.matches ? "dark" : "light");
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);
}