import React from 'react';
import '../styles/components.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'icon';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    fullWidth = false,
    children,
    className = '',
    disabled,
    ...props
  }, ref) => {
    const classes = [
      'btn',
      `btn-${variant}`,
      size !== 'md' && `btn-${size}`,
      fullWidth && 'btn-full',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {icon && <span className="btn-icon-inner">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon-only button for toolbars and compact layouts
 */
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ icon, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-icon ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
