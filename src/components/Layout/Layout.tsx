import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useTour } from '../tour/TourProvider';
import './Layout.css';

export function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { status, currentStep } = useTour();

    // Automatically reveal mobile sidebar when tour highlights a sidebar navigation link
    useEffect(() => {
        if (status !== 'active' || !currentStep) return;
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const isSidebarStep = ['step-nav-people', 'step-nav-ar', 'step-nav-help'].includes(currentStep.id);
        if (isSidebarStep) {
            setIsMobileMenuOpen(true);
        } else {
            setIsMobileMenuOpen(false);
        }
    }, [currentStep, status]);

    return (
        <div className="app-layout">
            {/* Mobile Top Header (visible only on <= 768px) */}
            <header className="mobile-topbar">
                <div className="mobile-brand">
                    <span className="mobile-logo-icon">🧠</span>
                    <span className="mobile-logo-text">MemoryAR</span>
                </div>
                <button
                    type="button"
                    className="mobile-menu-btn"
                    onClick={() => setIsMobileMenuOpen(prev => !prev)}
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open navigation menu"}
                    aria-expanded={isMobileMenuOpen}
                >
                    <Menu size={22} />
                </button>
            </header>

            {/* Mobile Sidebar Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="mobile-sidebar-backdrop"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
