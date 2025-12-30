import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, File, Trash2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as storageService from '../services/storageService';

const DocumentUploadModal = ({ isOpen, onClose, business }) => {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef(null);

    const businessId = business?.siren || business?.siret;
    const businessName = business?.nom_complet || business?.enseigne || 'Commerce';

    // Charger les documents au montage
    useEffect(() => {
        if (isOpen && businessId) {
            loadDocuments();
        }
    }, [isOpen, businessId]);

    const loadDocuments = async () => {
        try {
            const docs = await storageService.getDocuments(businessId);
            setDocuments(docs);
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    };

    // Validation fichier
    const validateFile = (file) => {
        // Type MIME
        if (file.type !== 'application/pdf') {
            return 'Seuls les fichiers PDF sont acceptés';
        }

        // Taille (10 MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return 'Le fichier ne doit pas dépasser 10 MB';
        }

        return null;
    };

    // Upload fichier
    const handleFileUpload = async (file) => {
        setError('');
        setSuccess('');

        // Validation
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const result = await storageService.uploadDocument(
                file,
                businessId,
                businessName,
                (progress) => setUploadProgress(progress)
            );

            setDocuments(result.documents);
            setSuccess(`Document "${file.name}" uploadé avec succès`);

            // Reset après 3 secondes
            setTimeout(() => setSuccess(''), 3000);

        } catch (error) {
            setError(error.message || 'Erreur lors de l\'upload');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Suppression document
    const handleDeleteDocument = async (documentId, filename) => {
        if (!confirm(`Supprimer "${filename}" ?`)) return;

        try {
            const result = await storageService.deleteDocument(businessId, documentId);
            setDocuments(result.documents);
            setSuccess(`Document supprimé avec succès`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            setError('Erreur lors de la suppression');
        }
    };

    // Drag & Drop handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    // Format taille fichier
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-[2000]"
            style={{
                backgroundColor: 'rgba(26, 26, 36, 0.4)',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl"
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
                            📁 Documents
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
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                    {/* Messages */}
                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#dc2626'
                        }}>
                            <AlertCircle size={18} />
                            <span style={{ fontSize: '0.875rem' }}>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div style={{
                            padding: '12px 16px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#16a34a'
                        }}>
                            <CheckCircle size={18} />
                            <span style={{ fontSize: '0.875rem' }}>{success}</span>
                        </div>
                    )}

                    {/* Upload Zone */}
                    <div
                        style={{
                            border: `2px dashed ${dragActive ? '#FF6B4A' : '#d1d5db'}`,
                            borderRadius: '12px',
                            padding: '32px',
                            textAlign: 'center',
                            background: dragActive ? '#eff6ff' : '#f9fafb',
                            transition: 'all 0.2s',
                            marginBottom: '24px'
                        }}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Upload
                            size={48}
                            style={{
                                margin: '0 auto 16px',
                                color: dragActive ? '#FF6B4A' : '#9ca3af'
                            }}
                        />
                        <p style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '8px'
                        }}>
                            {dragActive ? 'Déposez le fichier ici' : 'Glissez un fichier PDF ici'}
                        </p>
                        <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            marginBottom: '16px'
                        }}>
                            ou
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0]);
                                }
                            }}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            style={{
                                padding: '10px 24px',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: uploading ? '#9ca3af' : '#FF6B4A',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {uploading ? `Upload en cours... ${uploadProgress}%` : 'Choisir un fichier'}
                        </button>
                        <p style={{
                            fontSize: '0.75rem',
                            color: '#9ca3af',
                            marginTop: '12px'
                        }}>
                            PDF uniquement • 10 MB maximum
                        </p>
                    </div>

                    {/* Progress Bar */}
                    {uploading && (
                        <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '24px'
                        }}>
                            <div style={{
                                width: `${uploadProgress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #FF6B4A 0%, #FF5733 100%)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    )}

                    {/* Liste des documents */}
                    <div>
                        <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#6b7280',
                            marginBottom: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Documents ({documents.length})
                        </h4>

                        {documents.length === 0 ? (
                            <p style={{
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                textAlign: 'center',
                                padding: '24px'
                            }}>
                                Aucun document uploadé
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <File size={20} color="#ef4444" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: '#111827',
                                                marginBottom: '2px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {doc.filename}
                                            </p>
                                            <p style={{
                                                fontSize: '0.75rem',
                                                color: '#6b7280'
                                            }}>
                                                {formatFileSize(doc.size)} • {formatDate(doc.uploadDate)}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <a
                                                href={storageService.getDocumentDownloadUrl(businessId, doc.id)}
                                                download
                                                style={{
                                                    padding: '8px',
                                                    background: '#FF6B4A',
                                                    color: 'white',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    textDecoration: 'none'
                                                }}
                                                title="Télécharger"
                                            >
                                                <Download size={16} />
                                            </a>
                                            <button
                                                onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                                style={{
                                                    padding: '8px',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px',
                            fontSize: '0.9375rem',
                            fontWeight: '600',
                            color: '#374151',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Fermer
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default DocumentUploadModal;
