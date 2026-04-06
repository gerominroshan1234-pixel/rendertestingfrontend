import { createContext, useContext, useState } from 'react';
import Popup from './Popup';

// Context object that will share popup controls across the app tree.
const PopupContext = createContext();

/**
 * PopupProvider
 * Wrap your app (or a section of it) with this provider so any child
 * component can trigger user feedback popups (success, error, warning, info).
 */
export function PopupProvider({ children }) {
    // Holds the currently visible popup payload.
    // null means no popup is shown.
    const [popup, setPopup] = useState(null);

    // Generic popup setter used by all specialized helper methods below.
    // duration = 0 means the popup stays until the user closes it.
    const showPopup = (message, type = 'info', duration = 0) => {
        setPopup({ message, type, duration });
    };

    // Clears popup state so the popup component unmounts from the UI.
    const hidePopup = () => {
        setPopup(null);
    };

    // Success messages are short-lived by default to reduce UI clutter.
    const showSuccess = (message, duration = 3000) => {
        showPopup(message, 'success', duration);
    };

    // Error messages default to persistent display so users do not miss them.
    const showError = (message, duration = 0) => {
        showPopup(message, 'error', duration);
    };

    // Warning messages are also persistent by default.
    const showWarning = (message, duration = 0) => {
        showPopup(message, 'warning', duration);
    };

    // Informational messages can be timed or persistent depending on caller.
    const showInfo = (message, duration = 0) => {
        showPopup(message, 'info', duration);
    };

    return (
        // Expose popup actions through context so child components can call them.
        <PopupContext.Provider value={{
            showPopup,
            showSuccess,
            showError,
            showWarning,
            showInfo,
            hidePopup
        }}>
            {children}
            {/* Render popup only when state exists. */}
            {popup && (
                <Popup
                    message={popup.message}
                    type={popup.type}
                    onClose={hidePopup}
                    duration={popup.duration}
                />
            )}
        </PopupContext.Provider>
    );
}

/**
 * usePopup
 * Convenience hook for accessing popup controls from context.
 * Throws a clear error if used outside PopupProvider to prevent silent bugs.
 */
export function usePopup() {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error('usePopup must be used within a PopupProvider');
    }
    return context;
}