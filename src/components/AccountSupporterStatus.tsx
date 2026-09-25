import { SupporterChip } from '@/components/SupporterChip';
import { useSupporter } from '@/hooks/useSupporter';

export function AccountSupporterStatus() {
  const { isActive } = useSupporter();
  return isActive ? <SupporterChip /> : null;
}
