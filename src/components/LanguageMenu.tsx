import { useState } from 'react';
import { Check, Translate as Languages } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { changeLanguage } from '@/lib/i18n';
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  normalizeLocale,
  setStoredLocale,
} from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

interface LanguageMenuProps {
  className?: string;
  variant?: 'dropdown' | 'sidebar';
}

export function LanguageMenu({
  className,
  variant = 'dropdown',
}: LanguageMenuProps) {
  const { i18n, t } = useTranslation();
  const activeLocale = normalizeLocale(i18n.resolvedLanguage) ?? DEFAULT_LOCALE;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeOption = LOCALE_OPTIONS.find((option) => option.code === activeLocale) ?? LOCALE_OPTIONS[0];

  const handleSelect = (locale: (typeof LOCALE_OPTIONS)[number]['code']) => {
    setStoredLocale(locale);
    void changeLanguage(locale);
  };

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <div className="px-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((current) => !current)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Languages className="h-4 w-4" />
            <span className="flex-1">{`${t('common.language')}: ${activeOption.nativeName}`}</span>
          </button>
        </div>
        {isSidebarOpen && (
          <div className="mt-2 flex flex-wrap gap-2 px-3">
            {LOCALE_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  handleSelect(option.code);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  activeLocale === option.code
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
                )}
              >
                {option.nativeName}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
        {t('common.language')}
      </div>
      {LOCALE_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.code}
          onClick={() => handleSelect(option.code)}
          className={cn(
            'cursor-pointer hover:bg-muted focus:bg-muted',
            activeLocale === option.code && 'bg-muted/70',
          )}
        >
          <span className="mr-2 flex-1">{option.nativeName}</span>
          {activeLocale === option.code && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export default LanguageMenu;
