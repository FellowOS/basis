import { DropdownMenuItem } from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { LOCALES, localeLabel } from '@/i18n/locale.js';

export function LocaleMenuItems({ onSelect }: { onSelect?: () => void }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <>
      {LOCALES.map((value) => (
        <DropdownMenuItem
          key={value}
          onClick={() => {
            setLocale(value);
            onSelect?.();
          }}
        >
          {localeLabel(value, t.core.shell.sidebar)}
          {locale === value ? <PublicIcon name="check-01" size={16} className="ml-auto" /> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}
