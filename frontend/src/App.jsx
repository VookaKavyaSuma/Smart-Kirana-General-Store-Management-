import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/common/Navbar';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPreview from './pages/DashboardPreview';
import ItemsListPage from './pages/items/ItemsListPage';
import SuppliersListPage from './pages/suppliers/SuppliersListPage';
import SupplierDetailPage from './pages/suppliers/SupplierDetailPage';
import PurchasesListPage from './pages/purchases/PurchasesListPage';
import BillsListPage from './pages/bills/BillsListPage';
import PriceCalculatorModal from './components/conversion/PriceCalculatorModal';
import { Store } from 'lucide-react';

function MainApp() {
  const { store, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'items' | 'purchases' | 'suppliers' | 'supplier-detail'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  // Conversion calculator modal state (FR-4)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorItem, setCalculatorItem] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 mb-4 animate-bounce">
          <Store className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Loading Smart Kirana...</p>
        <p className="text-xs text-slate-400 mt-1">స్మార్ట్ కిరాణా లోడ్ అవుతోంది...</p>
      </div>
    );
  }

  // Not logged in: show Login or Register page
  if (!store) {
    if (authView === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => setAuthView('register')} />;
  }

  const handleOpenCalculator = (item = null) => {
    setCalculatorItem(item);
    setIsCalculatorOpen(true);
  };

  // Logged in: main app interface
  return (
    <div className="min-h-screen bg-slate-100/70 pb-16 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenCalculator={() => handleOpenCalculator(null)}
      />

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex-1">
        {currentTab === 'dashboard' && (
          <DashboardPreview onNavigateTab={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'items' && (
          <ItemsListPage
            onOpenSupplierDetail={(supplierId) => {
              setSelectedSupplierId(supplierId);
              setCurrentTab('supplier-detail');
            }}
            onOpenCalculatorForItem={(item) => handleOpenCalculator(item)}
          />
        )}

        {currentTab === 'purchases' && (
          <PurchasesListPage />
        )}

        {currentTab === 'bills' && (
          <BillsListPage />
        )}

        {currentTab === 'suppliers' && (
          <SuppliersListPage
            onSelectSupplier={(supplierId) => {
              setSelectedSupplierId(supplierId);
              setCurrentTab('supplier-detail');
            }}
          />
        )}

        {currentTab === 'supplier-detail' && (
          <SupplierDetailPage
            supplierId={selectedSupplierId}
            onBack={() => setCurrentTab('suppliers')}
            onAddItemForSupplier={() => setCurrentTab('items')}
          />
        )}
      </main>

      {/* Global 2-Way Conversion Calculator & Ready Price Chart Modal (FR-4) */}
      <PriceCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => {
          setIsCalculatorOpen(false);
          setCalculatorItem(null);
        }}
        initialItem={calculatorItem}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
