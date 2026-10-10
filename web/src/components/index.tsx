// Reusable components library

export { Button, IconButton } from './Button';
export type { ButtonProps } from './Button';

export { Input, EmailInput, PasswordInput, TextArea } from './Input';
export type { InputProps } from './Input';

export { Card, StudyCard, StatCard } from './Card';
export type { CardProps, StudyCardProps, StatCardProps } from './Card';

export { Badge, Chip, StatusDot, StatusBadge } from './Badge';
export type { BadgeProps, ChipProps, StatusDotProps, StatusBadgeProps, BadgeTone } from './Badge';

export { Modal, ConfirmModal } from './Modal';
export type { ModalProps, ConfirmModalProps } from './Modal';

export { ProgressBar, Meter, StepIndicator } from './ProgressBar';
export type { ProgressBarProps, MeterProps, StepIndicatorProps, ProgressTone } from './ProgressBar';

// Layout helpers
export const Flex = ({
  direction = 'row',
  gap = '16px',
  children,
  ...props
}: {
  direction?: 'row' | 'column';
  gap?: string;
  children?: React.ReactNode;
  [key: string]: any;
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: direction,
      gap,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Grid = ({
  cols = 'repeat(auto-fit, minmax(240px, 1fr))',
  gap = '16px',
  children,
  ...props
}: {
  cols?: string;
  gap?: string;
  children?: React.ReactNode;
  [key: string]: any;
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: cols,
      gap,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Spacer = ({ size = 'lg' }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizes: Record<string, string> = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  };
  return <div style={{ height: sizes[size], width: sizes[size] }} />;
};
