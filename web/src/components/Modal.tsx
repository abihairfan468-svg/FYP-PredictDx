import React, { useEffect } from 'react';
import '../styles/components.css';

export interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open = false,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeButton = true,
}) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const maxWidth: Record<string, string> = {
    sm: '400px',
    md: '500px',
    lg: '720px',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: maxWidth[size] }}
      >
        {(title || closeButton) && (
          <div className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {closeButton && (
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div style={{ marginBottom: footer ? '20px' : '0' }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-lg)',
              marginTop: 'var(--space-lg)',
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'flex-end',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';

/**
 * Alert/Confirmation Modal
 */
export interface ConfirmModalProps extends Omit<ModalProps, 'children'> {
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title = 'Confirm',
  message,
  onConfirm,
  onCancel,
  onClose,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  ...props
}) => {
  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <Modal title={title} onClose={onClose} {...props}>
      {message && <p style={{ marginBottom: '20px' }}>{message}</p>}

      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={handleCancel}
        >
          {cancelText}
        </button>
        <button
          className={`btn btn-${isDangerous ? 'danger' : 'primary'}`}
          onClick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

ConfirmModal.displayName = 'ConfirmModal';

export default Modal;
