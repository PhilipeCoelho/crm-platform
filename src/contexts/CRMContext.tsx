import { createContext, useContext, ReactNode } from 'react';
import { useCRMStore, CRMStore } from '../services/store';

const CRMContext = createContext<CRMStore | null>(null);

export function CRMProvider({ children }: { children: ReactNode }) {
    const store = useCRMStore();

    return (
        <CRMContext.Provider value={store}>
            {children}
        </CRMContext.Provider>
    );
}

export function useCRM() {
    const context = useContext(CRMContext);
    if (!context) {
        throw new Error("useCRM must be used within a CRMProvider");
    }
    return context;
}
