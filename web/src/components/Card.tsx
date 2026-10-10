import React from 'react';
import '../styles/components.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  selected?: boolean;
  clickable?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ active, selected, clickable, children, className = '', ...props }, ref) => {
    const classes = [
      'card',
      active && 'card-active',
      selected && 'card-selected',
      clickable && 'card-clickable',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Study/Record card with thumbnail and metadata
 */
export interface StudyCardProps extends CardProps {
  thumbnail?: string;
  code?: string;
  title?: string;
  subtitle?: string;
  status?: 'ready' | 'pending' | 'running' | 'error';
}

export const StudyCard = React.forwardRef<HTMLDivElement, StudyCardProps>(
  ({ thumbnail, code, title, subtitle, status, className = '', ...props }, ref) => {
    const statusColors: Record<string, string> = {
      ready: 'badge-ok',
      pending: 'badge-warn',
      running: 'badge-info',
      error: 'badge-crit',
    };

    return (
      <Card
        ref={ref}
        className={`${className}`}
        style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
        clickable
        {...props}
      >
        {thumbnail && (
          <img
            src={thumbnail}
            alt={code || 'Study'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {code && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
              }}
            >
              {code}
            </div>
          )}
          {title && (
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {status && (
          <div className={`badge ${statusColors[status] || 'badge-info'}`}>
            {status === 'ready' && '✓'}
            {status === 'error' && '✕'}
            {status === 'running' && '⟳'}
          </div>
        )}
      </Card>
    );
  }
);

StudyCard.displayName = 'StudyCard';

/**
 * Stat card for dashboards and overviews
 */
export interface StatCardProps extends CardProps {
  icon?: React.ReactNode;
  label?: string;
  value?: string | number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ icon, label, value, action, className = '', ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={`card-stat ${className}`}
        {...props}
      >
        {icon && (
          <div className="card-stat-icon">
            {icon}
          </div>
        )}

        {label && (
          <div className="card-stat-label">
            {label}
          </div>
        )}

        {value && (
          <div className="card-stat-value">
            {value}
          </div>
        )}

        {action && (
          <a
            href="#"
            className="card-stat-action"
            onClick={(e) => {
              e.preventDefault();
              action.onClick();
            }}
          >
            {action.label} →
          </a>
        )}
      </Card>
    );
  }
);

StatCard.displayName = 'StatCard';

export default Card;
