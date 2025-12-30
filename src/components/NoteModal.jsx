import React, { useState, useEffect } from 'react';
import { X, Save, FileText } from 'lucide-react';
import Modal, { ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter } from './ui/Modal';
import { Button } from './ui';
import { Textarea } from './ui/Input';

/**
 * NoteModal Component - Tech Premium Design System
 *
 * Modal for adding/editing notes on a business.
 * Features:
 * - Clean dark mode interface
 * - Auto-focus on textarea
 * - Glow effects on focus
 */
const NoteModal = ({ isOpen, onClose, onSave, initialNote, businessName }) => {
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote(initialNote || '');
  }, [initialNote, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(note);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <ModalHeader className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/15">
              <FileText size={20} className="text-primary-700" />
            </div>
            <div>
              <ModalTitle>Note</ModalTitle>
              <ModalDescription>{businessName}</ModalDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`
              p-2
              rounded-lg
              text-text-muted
              hover:text-text-primary
              hover:bg-surface-200
              transition-colors duration-fast
            `}
          >
            <X size={20} />
          </button>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Saisissez votre note ici..."
            rows={6}
            autoFocus
            className="resize-y"
          />
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<Save size={16} />}
          >
            Enregistrer
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default NoteModal;
