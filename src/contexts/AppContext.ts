import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export interface AppConfig {
  /** Current theme */
  theme: Theme;
  /** If `true`, the view will scroll to the active video in the video feed when idling */
  autoScroll: boolean;
  /** Selected relay URL (legacy - use relayUrls for multi-relay support) */
  relayUrl: string;
  /** Array of relay URLs to query (overrides relayUrl if provided) */
  relayUrls?: string[];
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: AppConfig) => AppConfig) => void;
  /** Optional list of preset relays to display in the RelaySelector */
  presetRelays?: { name: string; url: string }[];
  /** Whether the camera recorder is currently active */
  isRecording: boolean;
  /** Set recording state */
  setIsRecording: (isRecording: boolean) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
