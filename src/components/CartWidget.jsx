import React from 'react';
import { ShoppingCart, FileText } from 'lucide-react';

const CartWidget = ({ cartCount, onGenerateReport }) => {
    if (cartCount === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-lg shadow-lg z-[1000] flex flex-col items-center space-y-3 animate-fade-in">
            <div className="flex items-center space-x-2">
                <div className="relative">
                    <ShoppingCart size={24} />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {cartCount}
                    </span>
                </div>
                <span className="font-medium">Panier</span>
            </div>

            <button
                onClick={onGenerateReport}
                className="flex items-center px-3 py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-gray-200 transition-colors"
            >
                <FileText size={16} className="mr-2" />
                Générer Rapport
            </button>
        </div>
    );
};

export default CartWidget;
