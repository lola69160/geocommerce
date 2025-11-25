import React, { useState } from 'react';
import Layout from './components/Layout';
import SearchPanel from './components/SearchPanel';
import Map from './components/Map';
import CartWidget from './components/CartWidget';
import NoteModal from './components/NoteModal';
import { searchBusinesses } from './services/api';
import { enrichWithBodacc } from './services/enrichmentService';
import * as storageService from './services/storageService';
import { generateMarkdownReport } from './utils/reportGenerator';

function App() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState([46.603354, 1.888334]);
  const [mapZoom, setMapZoom] = useState(6);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  // New state for enrichment and filtering
  const [enrichmentDone, setEnrichmentDone] = useState(false);
  const [filterClosedDays, setFilterClosedDays] = useState(false);
  const [currentNafCode, setCurrentNafCode] = useState(null);

  // Cart and Notes state
  const [cart, setCart] = useState({});
  const [notes, setNotes] = useState({});
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalBusiness, setNoteModalBusiness] = useState(null);

  // Load cart and notes on mount
  React.useEffect(() => {
    const loadData = async () => {
      const [cartData, notesData] = await Promise.all([
        storageService.getCart(),
        storageService.getNotes()
      ]);
      setCart(cartData);
      setNotes(notesData);
    };
    loadData();
  }, []);

  const handleSearch = async (activity, location, radius) => {
    setLoading(true);
    setEnrichmentDone(false);
    setCurrentNafCode(activity);

    try {
      const results = await searchBusinesses(activity, location, radius, 20);
      setBusinesses(results);

      if (location && location.geometry) {
        const [lon, lat] = location.geometry.coordinates;
        setMapCenter([lat, lon]);
        setMapZoom(13);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Background Enrichment Effect
  React.useEffect(() => {
    const doEnrichment = async () => {
      if (businesses.length > 0 && !enrichmentDone) {
        const enriched = await enrichWithBodacc(businesses, currentNafCode);
        setBusinesses(enriched);
        setEnrichmentDone(true);
      }
    };
    doEnrichment();
  }, [businesses, enrichmentDone, currentNafCode]);

  const handleSelectBusiness = (business) => {
    setSelectedBusiness(business);
    if (business.lat && business.lon) {
      setMapCenter([parseFloat(business.lat), parseFloat(business.lon)]);
      setMapZoom(16);
    }
  };

  const handleOpenNoteModal = (business) => {
    setNoteModalBusiness(business);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (noteText) => {
    if (!noteModalBusiness) return;

    const businessId = noteModalBusiness.siren || noteModalBusiness.siret;

    try {
      // Save note to backend
      const updatedNotes = await storageService.saveNote(businessId, noteText);
      setNotes(updatedNotes);

      // Auto-add to cart if note is added
      if (noteText && noteText.trim()) {
        const updatedCart = await storageService.addToCart(noteModalBusiness);
        setCart(updatedCart);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Erreur lors de l\'enregistrement de la note');
    }
  };

  const handleAddToCart = async (business) => {
    try {
      const updatedCart = await storageService.addToCart(business);
      setCart(updatedCart);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Erreur lors de l\'ajout au panier');
    }
  };

  const handleGenerateReport = () => {
    const cartItems = Object.values(cart);
    generateMarkdownReport(cartItems, notes);
  };

  // Apply filters
  const filteredBusinesses = businesses.filter(b => {
    if (filterClosedDays) {
      return b.closedDays && b.closedDays.length > 0;
    }
    return true;
  });

  return (
    <>
      <Layout
        sidebar={
          <SearchPanel
            onSearch={handleSearch}
            loading={loading}
            results={filteredBusinesses}
            onSelectBusiness={handleSelectBusiness}
            selectedBusiness={selectedBusiness}
            debugMode={debugMode}
            onToggleDebug={setDebugMode}
            filterClosedDays={filterClosedDays}
            onToggleFilterClosedDays={setFilterClosedDays}
            notes={notes}
            cart={cart}
            onOpenNoteModal={handleOpenNoteModal}
            onAddToCart={handleAddToCart}
          />
        }
        main={
          <Map
            businesses={filteredBusinesses}
            center={mapCenter}
            zoom={mapZoom}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={handleSelectBusiness}
            notes={notes}
            cart={cart}
            onOpenNoteModal={handleOpenNoteModal}
            onAddToCart={handleAddToCart}
          />
        }
      />

      <CartWidget
        cartCount={Object.keys(cart).length}
        onGenerateReport={handleGenerateReport}
      />

      <NoteModal
        isOpen={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        onSave={handleSaveNote}
        initialNote={noteModalBusiness ? notes[noteModalBusiness.siren || noteModalBusiness.siret] : ''}
        businessName={noteModalBusiness ? (noteModalBusiness.nom_complet || noteModalBusiness.enseigne) : ''}
      />
    </>
  );
}

export default App;

