import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const NoteModal = ({ isOpen, onClose, onSave, initialNote, businessName }) => {
    const [note, setNote] = useState('');

    useEffect(() => {
        setNote(initialNote || '');
    }, [initialNote, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(note);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-[2000]"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
                style={{
                    animation: 'slideUp 0.3s ease-out',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 24px 16px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <h3 style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: '#111827',
                            marginBottom: '4px'
                        }}>
                            📝 Note
                        </h3>
                        <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            fontWeight: '500'
                        }}>
                            {businessName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#6b7280',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.color = '#111827';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flex: 1 }}>
                        <textarea
                            style={{
                                width: '100%',
                                minHeight: '180px',
                                padding: '16px',
                                border: '2px solid #e5e7eb',
                                borderRadius: '12px',
                                fontSize: '0.9375rem',
                                lineHeight: '1.6',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}
                            placeholder="Saisissez votre note ici..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            autoFocus
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '16px 24px 24px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                color: '#374151',
                                backgroundColor: '#f3f4f6',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '10px 24px',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontFamily: 'inherit',
                                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2563eb';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#3b82f6';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3)';
                            }}
                        >
                            <Save size={16} />
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
};

export default NoteModal;
