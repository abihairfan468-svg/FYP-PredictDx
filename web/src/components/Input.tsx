import React, { useState } from 'react';
import '../styles/components.css';
import { Icon } from '../lib/ui';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  success?: boolean;
  help?: string;
  required?: boolean;
  showToggle?: boolean; // For password fields
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    icon,
    error,
    success,
    help,
    required,
    showToggle,
    type = 'text',
    className = '',
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const formGroupClass = 'form-group';
    const inputClass = [
      'input-field',
      error && 'input-error',
      success && 'input-success',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={formGroupClass}>
        {label && (
          <label className={required ? 'form-label form-required' : 'form-label'}>
            {label}
          </label>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon && (
            <span
              className="input-icon"
              style={{
                position: 'absolute',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            type={inputType}
            className={inputClass}
            style={{
              ...(icon ? { paddingLeft: '40px' } : {}),
              ...(isPassword && showToggle ? { paddingRight: '44px' } : {}),
            }}
            aria-invalid={!!error}
            {...props}
          />

          {isPassword && showToggle && (
            <button
              type="button"
              className="input-toggle"
              onClick={(e) => {
                e.preventDefault();
                setShowPassword(!showPassword);
              }}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <Icon n={showPassword ? 'eyeoff' : 'eye'} s={17} />
            </button>
          )}

          {success && !error && (
            <span
              style={{
                position: 'absolute',
                right: '12px',
                color: 'var(--success-green)',
                fontSize: '16px',
              }}
            >
              ✓
            </span>
          )}
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {success && !error && (
          <div className="form-success" role="status">
            Looks good!
          </div>
        )}

        {help && !error && (
          <div className="form-help">
            {help}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Email input with built-in validation
 */
export const EmailInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="email" {...props} />
);

EmailInput.displayName = 'EmailInput';

/**
 * Password input with show/hide toggle
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="password" showToggle {...props} />
);

PasswordInput.displayName = 'PasswordInput';

/**
 * Text area for longer content
 */
export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & Omit<InputProps, 'type'>
>(({ label, error, success, help, required, className = '', ...props }, ref) => {
  const formGroupClass = 'form-group';
  const textareaClass = [
    'input-field',
    error && 'input-error',
    success && 'input-success',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={required ? 'form-label form-required' : 'form-label'}>
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        className={textareaClass}
        style={{ minHeight: '100px', resize: 'vertical' }}
        aria-invalid={!!error}
        {...props}
      />

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {success && !error && (
        <div className="form-success" role="status">
          Looks good!
        </div>
      )}

      {help && !error && (
        <div className="form-help">
          {help}
        </div>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default Input;
