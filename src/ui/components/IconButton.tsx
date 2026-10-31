import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  /** Accessible name; also the tooltip text. */
  label: string;
  /** Shortcut shown in the tooltip, e.g. "Ctrl+Z". */
  shortcut?: string;
  /** For aria-keyshortcuts, e.g. "Control+Z". */
  keys?: string;
  onClick(): void;
  disabled?: boolean;
  variant?: 'default' | 'ghost' | 'primary' | 'play';
  tipBelow?: boolean;
  testId?: string;
}

const VARIANT = { default: 'btn btn-icon', ghost: 'btn btn-icon btn-ghost', primary: 'btn btn-icon btn-primary', play: 'btn btn-primary btn-play' };

/** Round glass icon button with a tooltip that shows its shortcut. */
export function IconButton({ icon, label, shortcut, keys, onClick, disabled, variant = 'default', tipBelow, testId }: Props) {
  return (
    <button
      type="button"
      className={`${VARIANT[variant]}${tipBelow ? ' tip-below' : ''}`}
      aria-label={label}
      aria-keyshortcuts={keys}
      data-tip={shortcut ? `${label}  ·  ${shortcut}` : label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
