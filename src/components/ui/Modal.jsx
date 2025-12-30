import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal Component - Tech Premium Design System
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback when modal should close
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl' | 'full'
 * @param {boolean} closeOnBackdrop - Close when clicking backdrop
 * @param {boolean} closeOnEscape - Close when pressing Escape
 * @param {boolean} showCloseButton - Show X button
 */
const Modal = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  className = '',
  ...props
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Size styles
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  // Handle Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose?.();
    }
  }, [closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose?.();
    }
  };

  // Focus trap and body scroll lock
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previousActiveElement.current = document.activeElement;

      // Focus the modal
      modalRef.current?.focus();

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Add escape key listener
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        // Unlock body scroll
        document.body.style.overflow = '';

        // Remove escape key listener
        document.removeEventListener('keydown', handleKeyDown);

        // Restore focus
        previousActiveElement.current?.focus?.();
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`
        fixed inset-0 z-modal
        flex items-center justify-center
        p-4
        animate-fade-in
      `}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0
          bg-surface-900/40
          backdrop-blur-md
        `}
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`
          relative
          w-full ${sizeStyles[size]}
          bg-white
          border-2 border-surface-400
          rounded-2xl
          shadow-2xl
          overflow-hidden
          animate-scale-in
          focus:outline-none
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className={`
              absolute top-4 right-4 z-10
              w-9 h-9
              flex items-center justify-center
              rounded-xl
              text-text-tertiary
              hover:text-text-primary
              hover:bg-surface-200
              transition-all duration-fast
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            `}
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

/**
 * ModalHeader - Top section with title
 */
export const ModalHeader = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`
      px-6 pt-6 pb-4
      border-b border-surface-300
      bg-surface-50
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </div>
);

/**
 * ModalTitle - Heading for modal
 */
export const ModalTitle = ({
  children,
  className = '',
  ...props
}) => (
  <h2
    className={`
      font-display font-semibold text-xl text-text-primary
      pr-8
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </h2>
);

/**
 * ModalDescription - Subtext for modal header
 */
export const ModalDescription = ({
  children,
  className = '',
  ...props
}) => (
  <p
    className={`
      text-sm text-text-secondary mt-1
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </p>
);

/**
 * ModalBody - Main scrollable content area
 */
export const ModalBody = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`
      px-6 py-4
      overflow-y-auto
      max-h-[60vh]
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </div>
);

/**
 * ModalFooter - Bottom section with actions
 */
export const ModalFooter = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`
      px-6 py-4
      border-t border-surface-300
      flex items-center justify-end gap-3
      bg-surface-50
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </div>
);

/**
 * Confirm Modal - Pre-built confirmation dialog
 */
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) => {
  const buttonVariant = {
    danger: 'danger',
    primary: 'primary',
    success: 'success',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <p className="text-text-secondary">{message}</p>
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={loading}
          className={`
            px-4 py-2
            text-text-secondary
            hover:text-text-primary
            hover:bg-surface-700
            rounded-lg
            transition-colors duration-fast
          `}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`
            px-4 py-2
            bg-gradient-to-r
            ${variant === 'danger' ? 'from-red-500 to-red-600' : ''}
            ${variant === 'primary' ? 'from-primary-500 to-primary-600' : ''}
            ${variant === 'success' ? 'from-emerald-500 to-emerald-600' : ''}
            text-white
            rounded-lg
            hover:opacity-90
            transition-opacity duration-fast
            disabled:opacity-50
          `}
        >
          {loading ? 'Loading...' : confirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default Modal;
