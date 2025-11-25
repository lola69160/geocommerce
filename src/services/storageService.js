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
