import { Check, Languages } from 'lucide-react';
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

  const handleSelect = (locale: (typeof LOCALE_OPTIONS)[number]['code']) => {
    setStoredLocale(locale);
    void changeLanguage(locale);
  };

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <div className="px-3 text-[13px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            <span>{t('common.language')}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 px-3">
          {LOCALE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => handleSelect(option.code)}
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
      </div>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
