import React from 'react';
import '../styles/components.css';

export type BadgeTone = 'ok' | 'warn' | 'crit' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = 'info', icon, children, className = '', ...props }, ref) => {
    const classes = [
      'badge',
      `badge-${tone}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={classes} {...props}>
        {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: BadgeTone;
  active?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onRemove?: () => void;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ tone = 'info', active, icon, children, onRemove, className = '', ...props }, ref) => {
    const classes = [
      'chip',
      `chip-${tone}`,
      active && 'chip-active',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} {...props}>
        {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px 0 8px',
              color: 'inherit',
              fontSize: '16px',
            }}
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </button>
    );
  }
);

Chip.displayName = 'Chip';

/**
 * Status dot indicator
 */
export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ tone = 'info', className = '', ...props }, ref) => {
    const toneColors: Record<BadgeTone, string> = {
      ok: 'var(--success-green)',
      warn: 'var(--warning-amber)',
      crit: 'var(--critical-red)',
      info: 'var(--status-info)',
    };

    return (
      <span
        ref={ref}
        className={`status-dot ${className}`}
        style={{
          backgroundColor: toneColors[tone],
        }}
        {...props}
      />
    );
  }
);

StatusDot.displayName = 'StatusDot';

/**
 * Status badge with icon and text
 */
export interface StatusBadgeProps extends BadgeProps {
  showIcon?: boolean;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ tone = 'info', showIcon = true, children, ...props }, ref) => {
    const icons: Record<BadgeTone, string> = {
      ok: '✓',
      warn: '⚠',
      crit: '✕',
      info: 'ℹ',
    };

    return (
      <Badge
        ref={ref}
        tone={tone}
        icon={showIcon ? icons[tone] : undefined}
        {...props}
      >
        {children}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
