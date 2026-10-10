import React from 'react';
import '../styles/components.css';

export type ProgressTone = 'primary' | 'ok' | 'warn' | 'crit';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
  tone?: ProgressTone;
  showLabel?: boolean;
  indeterminate?: boolean;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({
    value = 0,
    tone = 'primary',
    showLabel = false,
    indeterminate = false,
    className = '',
    ...props
  }, ref) => {
    const fillClass = [
      'progress-bar-fill',
      tone !== 'primary' && `fill-${tone}`,
    ]
      .filter(Boolean)
      .join(' ');

    const normalizedValue = Math.min(Math.max(value, 0), 100);

    return (
      <div
        ref={ref}
        className={`progress-bar ${indeterminate ? 'progress-indeterminate' : ''} ${className}`}
        role="progressbar"
        aria-valuenow={normalizedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        {!indeterminate && (
          <div
            className={fillClass}
            style={{
              width: `${normalizedValue}%`,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        )}
        {showLabel && (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              pointerEvents: 'none',
            }}
          >
            {normalizedValue}%
          </span>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

/**
 * Meter component with label
 */
export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
  tone?: ProgressTone;
  label?: string;
  showValue?: boolean;
}

export const Meter = React.forwardRef<HTMLDivElement, MeterProps>(
  ({
    value = 0,
    tone = 'primary',
    label,
    showValue = true,
    className = '',
    ...props
  }, ref) => {
    const normalizedValue = Math.min(Math.max(value, 0), 100);

    return (
      <div
        ref={ref}
        className={`meter ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          fontSize: 'var(--fs-small)',
        }}
        {...props}
      >
        {label && (
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {label}
          </span>
        )}

        <div className="meter-bar" style={{ flex: 1 }}>
          <div
            style={{
              height: '100%',
              width: `${normalizedValue}%`,
              backgroundColor: getToneColor(tone),
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>

        {showValue && (
          <span
            className="meter-value"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {normalizedValue}%
          </span>
        )}
      </div>
    );
  }
);

Meter.displayName = 'Meter';

/**
 * Step indicator for processes
 */
export interface StepIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  steps?: string[];
  current?: number; // 0-based index
  completed?: number; // 0-based index
}

export const StepIndicator = React.forwardRef<HTMLDivElement, StepIndicatorProps>(
  ({
    steps = [],
    current = 0,
    completed = -1,
    className = '',
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`step-indicator ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
        }}
        {...props}
      >
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: index <= completed
                    ? 'var(--success-green)'
                    : 'var(--color-border)',
                  transition: 'background-color 0.3s ease-in-out',
                }}
              />
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  backgroundColor: index <= completed
                    ? 'var(--success-green)'
                    : index === current
                    ? 'var(--primary-blue)'
                    : 'var(--color-surface)',
                  color: index <= completed || index === current ? 'white' : 'var(--color-text-secondary)',
                  border: index <= completed || index === current ? 'none' : '2px solid var(--color-border)',
                }}
              >
                {index <= completed ? '✓' : index + 1}
              </div>
              <span
                style={{
                  fontSize: 'var(--fs-tiny)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {step}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  }
);

StepIndicator.displayName = 'StepIndicator';

/**
 * Get color based on tone
 */
function getToneColor(tone: ProgressTone): string {
  switch (tone) {
    case 'ok':
      return 'var(--success-green)';
    case 'warn':
      return 'var(--warning-amber)';
    case 'crit':
      return 'var(--critical-red)';
    default:
      return 'var(--primary-blue)';
  }
}

export default ProgressBar;
