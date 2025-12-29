import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const getNotes = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/notes`);
        return response.data;
    } catch (error) {
        console.error('Error fetching notes:', error);
        return {};
    }
};

export const saveNote = async (businessId, text) => {
    try {
        const response = await axios.post(`${API_URL}/api/notes`, { businessId, text });
        return response.data;
    } catch (error) {
        console.error('Error saving note:', error);
        throw error;
    }
};

export const getCart = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/cart`);
        return response.data;
    } catch (error) {
        console.error('Error fetching cart:', error);
        return {};
    }
};

export const addToCart = async (business) => {
    try {
        const response = await axios.post(`${API_URL}/api/cart`, { business });
        return response.data;
    } catch (error) {
        console.error('Error adding to cart:', error);
        throw error;
    }
};

export const removeFromCart = async (businessId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/cart/${businessId}`);
        return response.data;
    } catch (error) {
        console.error('Error removing from cart:', error);
        throw error;
    }
};

export const getDocuments = async (siret) => {
    try {
        const response = await axios.get(`${API_URL}/api/documents/${siret}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching documents:', error);
        return [];
    }
};

export const uploadDocument = async (file, siret, businessName, onProgress) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('siret', siret);
        formData.append('businessName', businessName);

        const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading document:', error);
        const errorMessage = error.response?.data?.error || 'Erreur lors de l\'upload';
        throw new Error(errorMessage);
    }
};

export const deleteDocument = async (siret, documentId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/documents/${siret}/${documentId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
};

export const getDocumentDownloadUrl = (siret, documentId) => {
    return `${API_URL}/api/documents/download/${siret}/${documentId}`;
};
