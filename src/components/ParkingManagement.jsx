import { useState, useEffect } from 'react';
import { usePopup } from './PopupContext';
import axios from 'axios';

/**
 * ParkingManagement Component
 * Handles parking slots, reservations, and parking operations
 */
export default function ParkingManagement({
    user,
    parkingSlots,
    setParkingSlots,
    userReservations,
    records,
    TOTAL_PARKING_SLOTS,
    getValidUserStickers,
    getPlateFromSticker,
    getReservationInfo,
    formatDateTime,
    getSlotStatusText,
    getSlotTooltipText,
    fetchUserReservations
}) {
    const { showError, showSuccess, showInfo } = usePopup();
    
    // Parking state
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedParkingSlotId, setSelectedParkingSlotId] = useState(null);
    const [selectedParkingAreaName, setSelectedParkingAreaName] = useState('Old Parking Space');
    const [showParkForSelectedSpot, setShowParkForSelectedSpot] = useState(false);
    const [parkStickerInput, setParkStickerInput] = useState('');
    const [parkPlateInput, setParkPlateInput] = useState('');
    
    // Multi-select and reservation state
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedSpotsForReservation, setSelectedSpotsForReservation] = useState(new Set());
    const [reservationSelectionOrder, setReservationSelectionOrder] = useState([]);
    const [showReservationModal, setShowReservationModal] = useState(false);
    const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
    const [leaveConfirmSlotId, setLeaveConfirmSlotId] = useState(null);
    
    // Reservation form state
    const [reserveStickerInput, setReserveStickerInput] = useState('');
    const [reserveDate, setReserveDate] = useState('');
    const [reserveTime, setReserveTime] = useState('');
    const [reservationReasonText, setReservationReasonText] = useState('');
    const [reservationReasonCategory, setReservationReasonCategory] = useState('');
    const [reservationOrgName, setReservationOrgName] = useState('');
    const [reservationEventName, setReservationEventName] = useState('');
    const [reservationActivityForm, setReservationActivityForm] = useState('');
    const [reservationRequesterName, setReservationRequesterName] = useState('');
    const [reservationOrgPosition, setReservationOrgPosition] = useState('');
    const [reservationModalError, setReservationModalError] = useState('');
    
    const [userReservationsPage, setUserReservationsPage] = useState(1);

    const USER_RESERVATIONS_PAGE_SIZE = 10;
    const parkingAreas = [
        { name: 'Old Parking Space', startId: 1, slotCount: 40, slotsPerRow: 10, totalRows: 4 },
        { name: 'Vertical Parking Space', startId: 41, slotCount: 50, slotsPerRow: 10, totalRows: 5 },
        { name: 'New Parking Space', startId: 91, slotCount: 90, slotsPerRow: 15, totalRows: 6 }
    ];

    useEffect(() => {
        // Reset form inputs when slot or parking area selection changes
        // Note: This batches multiple state updates together, which is automatic in React 18+
        const resetFormInputs = () => {
            setShowParkForSelectedSpot(false);
            setParkStickerInput('');
            setParkPlateInput('');
            setReserveStickerInput('');
            setReserveDate('');
            setReserveTime('');
        };
        resetFormInputs();
    }, [selectedParkingSlotId, selectedParkingAreaName]);

    const getParkingSlotFill = (slot) => {
        if (selectedParkingSlotId === slot.id) {
            return {
                background: 'linear-gradient(180deg, #0f766e 0%, #14b8a6 100%)',
                borderColor: '#0f766e',
                color: '#ffffff',
                shadow: '0 10px 24px rgba(20, 184, 166, 0.28)'
            };
        }

        if (slot.status === 'occupied') {
            return {
                background: 'linear-gradient(180deg, #fee2e2 0%, #fecaca 100%)',
                borderColor: '#ef4444',
                color: '#991b1b',
                shadow: '0 8px 18px rgba(239, 68, 68, 0.18)'
            };
        }

        const reservationInfo = getReservationInfo(slot);
        if (reservationInfo) {
            if (reservationInfo.isUpcoming) return {
                background: 'linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)',
                borderColor: '#9ca3af',
                color: '#374151',
                shadow: '0 8px 18px rgba(156, 163, 175, 0.18)'
            };

            return {
                background: reservationInfo.isOverdue
                    ? 'linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)'
                    : 'linear-gradient(180deg, #fef9c3 0%, #fde68a 100%)',
                borderColor: reservationInfo.isOverdue ? '#d97706' : '#ca8a04',
                color: '#78350f',
                shadow: '0 8px 18px rgba(202, 138, 4, 0.18)'
            };
        }

        return {
            background: 'linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)',
            borderColor: '#9ca3af',
            color: '#374151',
            shadow: '0 8px 18px rgba(156, 163, 175, 0.18)'
        };
    };

    // Returns the full slot object for the currently selected slot id.
    // We return null (not undefined) so calling code can do simple null checks.
    const getSelectedParkingSlot = () => parkingSlots.find(slot => slot.id === selectedParkingSlotId) || null;

    // Checks ownership: can the logged-in user manage/check out this occupied slot?
    // Rule used here: if the slot sticker matches any sticker in this user's records,
    // then this slot is considered owned by the current user.
    const isCurrentUserSpot = (slot) => {
        // Guard clause: no slot or no sticker means no ownership match is possible.
        if (!slot || !slot.stickerId) return false;

        // Normalize for safe comparison (ignore spaces and letter case).
        const normalizedSlotSticker = (slot.stickerId || '').trim().toUpperCase();

        // Empty sticker after normalization is treated as invalid/unowned.
        if (!normalizedSlotSticker) return false;

        // Search through the user's application records and check if at least one
        // approved/known sticker id matches the sticker currently parked in this slot.
        return records.some((record) => {
            const recordSticker = (record.sticker_id || '').trim().toUpperCase();
            return recordSticker && recordSticker === normalizedSlotSticker;
        });
    };

    // Special case for multi-reservation parking where a guest plate can park.
    // In this flow, reservedStickerId uses 'N/A' instead of a specific user sticker.
    const isGuestReservationWindow = (slot) => {
        const reservationInfo = getReservationInfo(slot);
        const reservedSticker = (slot?.reservedStickerId || '').trim().toUpperCase();
        return !!reservationInfo && (reservationInfo.isActive || reservationInfo.isOverdue) && reservedSticker === 'N/A';
    };

    // Core parking write operation:
    // 1) validate sticker
    // 2) validate reservation conflict
    // 3) update slot state + persist to localStorage
    const parkVehicle = (slotId, plateNumber, stickerId) => {
        const normalizedStickerId = (stickerId || '').trim().toUpperCase();
        const currentStickers = getValidUserStickers();
        if (!currentStickers.includes(normalizedStickerId)) {
            showError(`Invalid sticker ID. Valid approved stickers: ${currentStickers.join(', ') || 'None available - please contact admin'}`);
            return false;
        }

        const targetSlot = parkingSlots.find(slot => slot.id === slotId);
        const reservationInfo = getReservationInfo(targetSlot);
        const reservedStickerId = (targetSlot?.reservedStickerId || '').trim().toUpperCase();
        if (reservationInfo && (reservationInfo.isActive || reservationInfo.isOverdue) && reservedStickerId && reservedStickerId !== normalizedStickerId) {
            showError('This spot is reserved right now. Please choose another spot.');
            return false;
        }

        const updatedSlots = parkingSlots.map(slot =>
            slot.id === slotId
                ? {
                    ...slot,
                    status: 'occupied',
                    plateNumber,
                    stickerId: normalizedStickerId,
                    entryTime: new Date().toISOString(),
                    reservedFor: null,
                    reservedStickerId: ''
                }
                : slot
        );
        setParkingSlots(updatedSlots);
        localStorage.setItem('parkingSlots', JSON.stringify(updatedSlots));
        showSuccess(`Vehicle ${plateNumber} parked in slot ${slotId}`);
        return true;
    };

    // UI-level parking handler for the currently selected slot.
    // This function decides whether to use guest-flow or sticker-flow parking.
    const handleParkSelectedSpot = () => {
        const selectedSlot = getSelectedParkingSlot();

        if (!selectedSlot) {
            showError('Please select a parking spot first.');
            return;
        }

        if (selectedSlot.status !== 'available') {
            showError('Selected spot is already occupied.');
            return;
        }

        const reservationInfo = getReservationInfo(selectedSlot);

        // Guest flow: used for multi-spot reservations tagged as N/A sticker.
        if (isGuestReservationWindow(selectedSlot)) {
            const guestPlateNumber = (parkPlateInput || '').trim().toUpperCase();
            if (!guestPlateNumber) {
                showError('Plate number is required for this multiple reservation parking.');
                return;
            }

            const updatedSlots = parkingSlots.map((slot) =>
                slot.id === selectedSlot.id
                    ? {
                        ...slot,
                        status: 'occupied',
                        plateNumber: guestPlateNumber,
                        stickerId: 'GUEST',
                        entryTime: new Date().toISOString(),
                        reservedFor: null,
                        reservedStickerId: ''
                    }
                    : slot
            );
            setParkingSlots(updatedSlots);
            localStorage.setItem('parkingSlots', JSON.stringify(updatedSlots));
            setParkStickerInput('');
            setParkPlateInput('');
            setShowParkForSelectedSpot(false);
            showSuccess(`Vehicle ${guestPlateNumber} parked in slot ${selectedSlot.id}`);
            return;
        }

        if (!parkStickerInput.trim()) {
            showError('Please enter your UA sticker ID.');
            return;
        }

        // Normalize user input before validation and matching.
        const sticker = parkStickerInput.trim().toUpperCase();
        const reservedSticker = (selectedSlot.reservedStickerId || '').trim().toUpperCase();

        if (reservationInfo && (reservationInfo.isActive || reservationInfo.isOverdue) && reservedSticker && reservedSticker !== sticker) {
            showError('This slot has an active/overdue reservation. Guard can release expired reservations after checking no-show.');
            return;
        }

        const plateNumber = getPlateFromSticker(sticker);
        if (!plateNumber) {
            showError('Invalid sticker ID or not valid for the current semester.');
            return;
        }

        if (parkVehicle(selectedSlot.id, plateNumber, sticker)) {
            setParkStickerInput('');
            setShowParkForSelectedSpot(false);
        }
    };

    // Generic checkout function.
    // Accepts either slot number (e.g., "12") or plate number (e.g., "ABC1234").
    const leaveParking = (identifier) => {
        const trimmed = (identifier || '').trim();
        const normalized = trimmed.toUpperCase();

        // Resolve input to one concrete occupied slot.
        let slot = null;
        if (/^\d+$/.test(trimmed)) {
            const slotId = parseInt(trimmed, 10);
            slot = parkingSlots.find(s => s.id === slotId && s.status === 'occupied');
        } else {
            slot = parkingSlots.find(
                s => (s.plateNumber || '').trim().toUpperCase() === normalized && s.status === 'occupied'
            );
        }

        if (!slot) {
            showError('Vehicle or slot not found, or slot is already available.');
            return;
        }

        const updatedSlots = parkingSlots.map(s =>
            s.id === slot.id ? { ...s, status: 'available', plateNumber: '', stickerId: '', entryTime: null } : s
        );
        setParkingSlots(updatedSlots);
        localStorage.setItem('parkingSlots', JSON.stringify(updatedSlots));
        showInfo(`Vehicle ${slot.plateNumber} left slot ${slot.id} successfully.`);
    };


    // Opens confirmation modal only when selected spot is valid and owned by current user.
    const handleLeaveSelectedSpot = () => {
        const selectedSlot = getSelectedParkingSlot();
        if (!selectedSlot) {
            showError('Please select a parking spot first.');
            return;
        }

        if (selectedSlot.status !== 'occupied') {
            showError('Selected spot is not occupied.');
            return;
        }

        if (!isCurrentUserSpot(selectedSlot)) {
            showError('You can only leave/check out your own occupied spot.');
            return;
        }

        setLeaveConfirmSlotId(selectedSlot.id);
        setShowLeaveConfirmModal(true);
    };

    // Final confirmation action for checkout modal.
    const handleConfirmLeaveSelectedSpot = () => {
        if (!leaveConfirmSlotId) {
            setShowLeaveConfirmModal(false);
            return;
        }

        leaveParking(String(leaveConfirmSlotId));
        setSelectedParkingSlotId(null);
        setLeaveConfirmSlotId(null);
        setShowLeaveConfirmModal(false);
    };

    // Enables/disables multi-select mode for selecting several spots in one reservation.
    const handleToggleMultiSelectMode = () => {
        setIsMultiSelectMode((prevMode) => {
            const nextMode = !prevMode;
            if (!nextMode) {
                setSelectedSpotsForReservation(new Set());
                setReservationSelectionOrder([]);
            }
            showInfo(`Select Multiple ${nextMode ? 'enabled' : 'disabled'}.`, 1000);
            return nextMode;
        });
    };

    // Removes the most recently selected spot (stack-like undo behavior).
    const handleUndoReservationSelection = () => {
        if (reservationSelectionOrder.length === 0) return;
        const lastSelectedSpot = reservationSelectionOrder[reservationSelectionOrder.length - 1];

        setSelectedSpotsForReservation((prevSelected) => {
            const nextSelected = new Set(prevSelected);
            nextSelected.delete(lastSelectedSpot);
            return nextSelected;
        });
        setReservationSelectionOrder((prevOrder) => prevOrder.slice(0, -1));
    };

    // Clears all currently selected spots for reservation.
    const handleClearReservationSelections = () => {
        setSelectedSpotsForReservation(new Set());
        setReservationSelectionOrder([]);
    };

    // Prepares and opens reservation modal based on current selection mode.
    const handleOpenReservationModal = () => {
        // If user did not multi-select, fall back to the single clicked slot.
        const fallbackSingleSpot = selectedParkingSlotId ? [selectedParkingSlotId] : [];
        const normalizedSpots = selectedSpotsForReservation.size > 0
            ? Array.from(selectedSpotsForReservation)
            : fallbackSingleSpot;
        const validUserStickers = getValidUserStickers();

        // Validate spot selection
        if (normalizedSpots.length === 0) {
            showError('Please select at least one parking spot to reserve.');
            return;
        }

        if (normalizedSpots.length === 1 && validUserStickers.length === 0) {
            showError("You can't reserve without any valid parking stickers.");
            return;
        }

        // In single-select mode, use the currently selected spot as reservation target.
        setSelectedSpotsForReservation(new Set(normalizedSpots));
        setReservationSelectionOrder(normalizedSpots);

        // Reset form and open modal
        if (normalizedSpots.length === 1) {
            setReserveStickerInput(validUserStickers[0] || '');
        } else {
            setReserveStickerInput('');
        }
        setReserveDate('');
        setReserveTime('');
        setReservationReasonText('');
        setReservationReasonCategory('');
        setReservationOrgName('');
        setReservationEventName('');
        setReservationActivityForm('');
        setReservationRequesterName('');
        setReservationOrgPosition('');
        setReservationModalError('');
        setShowReservationModal(true);
    };

    // Validates reservation form data and submits it to backend.
    const handleSubmitReservation = () => {
        // Clear previous modal error before new validation pass.
        setReservationModalError('');

        if (!reserveDate || !reserveTime) {
            setReservationModalError('Please select reserve date and time.');
            return;
        }

        const selectedDate = new Date(`${reserveDate}T${reserveTime}`);
        if (Number.isNaN(selectedDate.getTime())) {
            setReservationModalError('Invalid reserve date and time.');
            return;
        }

        if (selectedDate <= new Date()) {
            setReservationModalError('Reserve date/time must be in the future.');
            return;
        }

        let sticker = 'N/A';
        const validUserStickers = getValidUserStickers();

        // Build reason text based on spot count
        let finalReason = '';
        let reservationCategoryPayload = 'single';
        if (selectedSpotsForReservation.size === 1) {
            // Single-spot reservations require a valid user sticker.
            if (validUserStickers.length === 0) {
                setReservationModalError("You can't reserve without any valid parking stickers.");
                return;
            }
            if (!reserveStickerInput.trim()) {
                setReservationModalError('Please select your UA sticker ID.');
                return;
            }
            sticker = reserveStickerInput.trim().toUpperCase();
            if (!validUserStickers.includes(sticker)) {
                setReservationModalError('Selected sticker ID is not valid for this account this semester.');
                return;
            }
            const plateNumber = getPlateFromSticker(sticker);
            if (!plateNumber) {
                setReservationModalError('Invalid sticker ID or not valid for the current semester.');
                return;
            }

            // Single spot: reason is just the text they entered
            if (!reservationReasonText.trim()) {
                setReservationModalError('Please provide a reason for the reservation.');
                return;
            }
            finalReason = reservationReasonText.trim();
        } else {
            // Multi-spot reservations are treated as organizational/guest-style requests.
            reservationCategoryPayload = reservationReasonCategory;

            if (!reservationReasonCategory) {
                setReservationModalError('Please choose a Reason Category first.');
                return;
            }

            if (!reservationReasonText.trim()) {
                setReservationModalError('Please provide a detailed reason for the reservation.');
                return;
            }

            if (reservationReasonCategory === 'School Related Event') {
                if (!reservationEventName.trim()) {
                    setReservationModalError('Please enter Event Name.');
                    return;
                }
                if (!reservationActivityForm.trim()) {
                    setReservationModalError('Please enter Activity Form No.');
                    return;
                }
                if (!reservationRequesterName.trim()) {
                    setReservationModalError('Please enter the name of person requesting the reservation.');
                    return;
                }
                finalReason = `Category: School Related Event | Event: ${reservationEventName.trim()} | Activity Form No: ${reservationActivityForm.trim()} | Requester: ${reservationRequesterName.trim()} | Details: ${reservationReasonText.trim()}`;
            } else if (reservationReasonCategory === 'Org Related Event') {
                if (!reservationOrgName.trim()) {
                    setReservationModalError('Please enter Org Name.');
                    return;
                }
                if (!reservationEventName.trim()) {
                    setReservationModalError('Please enter Event Name.');
                    return;
                }
                if (!reservationActivityForm.trim()) {
                    setReservationModalError('Please enter Activity Form.');
                    return;
                }
                if (!reservationRequesterName.trim()) {
                    setReservationModalError('Please enter the name of person requesting the reservation.');
                    return;
                }
                if (!reservationOrgPosition.trim()) {
                    setReservationModalError('Please enter Org Position.');
                    return;
                }
                finalReason = `Category: Org Related Event | Org: ${reservationOrgName.trim()} | Event: ${reservationEventName.trim()} | Activity Form: ${reservationActivityForm.trim()} | Requester: ${reservationRequesterName.trim()} | Position: ${reservationOrgPosition.trim()} | Details: ${reservationReasonText.trim()}`;
            } else {
                if (!reservationRequesterName.trim()) {
                    setReservationModalError('Please enter the name of person requesting the reservation.');
                    return;
                }
                finalReason = `Category: Others | Requester: ${reservationRequesterName.trim()} | Details: ${reservationReasonText.trim()}`;
            }
        }

        // Submit reservation to backend API
        // Isolated async call keeps the outer function readable and validation-first.
        const submitReservation = async () => {
            try {
                // Close modal immediately after submit click.
                setShowReservationModal(false);

                const response = await axios.post('http://127.0.0.1:8000/api/submit-reservation/', {
                    username: user.username,
                    sticker_id: sticker,
                    reservation_category: reservationCategoryPayload,
                    reserved_spots: Array.from(selectedSpotsForReservation),
                    reservation_reason: finalReason,
                    reserved_for_datetime: selectedDate.toISOString()
                });

                if (response.data.status === 'success') {
                    showSuccess(`Reservation submitted for ${selectedSpotsForReservation.size} spot(s). Waiting for admin approval...`);
                    
                    // Clear form and reset state
                    setReserveStickerInput('');
                    setReserveDate('');
                    setReserveTime('');
                    setReservationReasonText('');
                    setReservationReasonCategory('');
                    setReservationOrgName('');
                    setReservationEventName('');
                    setReservationActivityForm('');
                    setReservationRequesterName('');
                    setReservationOrgPosition('');
                    setSelectedSpotsForReservation(new Set());
                    setReservationSelectionOrder([]);
                    setIsMultiSelectMode(false);
                    
                    // Refresh reservations list
                    fetchUserReservations(user.username);
                } else {
                    showError(response.data.message || 'Failed to submit reservation');
                }
            } catch (error) {
                console.error('Reservation submission error:', error);
                showError(error.response?.data?.message || 'Error submitting reservation');
            }
        };

        submitReservation();
    };

    const displayParkingSlots = Array.from({ length: TOTAL_PARKING_SLOTS }, (_, i) => {
        return parkingSlots.find(slot => slot.id === i + 1) || {
            id: i + 1,
            status: 'available',
            plateNumber: '',
            stickerId: '',
            entryTime: null,
            reservedFor: null,
            reservedStickerId: ''
        };
    });

    const selectedParkingArea = parkingAreas.find(area => area.name === selectedParkingAreaName) || parkingAreas[0];
    const visibleParkingAreas = [selectedParkingArea];
    const selectedParkingSlot = getSelectedParkingSlot();

    const userReservationsTotalPages = Math.max(1, Math.ceil(userReservations.length / USER_RESERVATIONS_PAGE_SIZE));
    const safeUserReservationsPage = Math.min(userReservationsPage, userReservationsTotalPages);
    const paginatedUserReservations = userReservations.slice(
        (safeUserReservationsPage - 1) * USER_RESERVATIONS_PAGE_SIZE,
        (safeUserReservationsPage - 1) * USER_RESERVATIONS_PAGE_SIZE + USER_RESERVATIONS_PAGE_SIZE
    );

    const occupiedCount = parkingSlots.filter(slot => slot.status === 'occupied').length;
    const pendingReservationsCount = userReservations.filter(res => res.status === 'pending').length;

    return (
        <>
            {/* SIDEBAR NAVIGATION */}
            <div style={{ flex: '0 0 260px', width: '260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <aside style={{
                    border: '1px solid #dbe3ee',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    padding: '12px'
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.7px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Navigation
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button type="button" className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                        <button type="button" className={`tab-button ${activeTab === 'parking-map' ? 'active' : ''}`} onClick={() => setActiveTab('parking-map')}>Parking Map</button>
                    </div>
                </aside>

                {activeTab === 'parking-map' && (
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px', background: '#f8fafc' }}>
                        <h4 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '0.9rem' }}>Parking Map</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {parkingAreas.map((area) => {
                                const isActive = selectedParkingAreaName === area.name;
                                const activeStyleByArea = area.name === 'Old Parking Space'
                                    ? { border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4ed8' }
                                    : area.name === 'Vertical Parking Space'
                                        ? { border: '1px solid #ccfbf1', background: '#ecfeff', color: '#0f766e' }
                                        : { border: '1px solid #fbcfe8', background: '#fdf2f8', color: '#be185d' };

                                return (
                                    <button
                                        key={`sidebar-${area.name}`}
                                        type="button"
                                        onClick={() => {
                                            setSelectedParkingAreaName(area.name);
                                            setSelectedParkingSlotId(null);
                                        }}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            ...(isActive
                                                ? activeStyleByArea
                                                : { border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569' })
                                        }}
                                    >
                                        {area.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'parking-map' && (
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px', background: '#f8fafc' }}>
                        <h4 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '0.9rem' }}>Spot Interaction</h4>
                        {selectedParkingSlot ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                <div><span style={{ color: '#64748b' }}>Spot ID:</span> <strong>{selectedParkingSlot.id}</strong></div>
                                <div><span style={{ color: '#64748b' }}>Status:</span> <strong>{getSlotStatusText(selectedParkingSlot)}</strong></div>
                                <div><span style={{ color: '#64748b' }}>Assigned Sticker ID:</span> <strong>{selectedParkingSlot.stickerId || '---'}</strong></div>
                                <div><span style={{ color: '#64748b' }}>Reserved For:</span> <strong>{formatDateTime(selectedParkingSlot.reservedFor)}</strong></div>
                                <div><span style={{ color: '#64748b' }}>Reserved Sticker:</span> <strong>{selectedParkingSlot.reservedStickerId || '---'}</strong></div>

                                {(selectedParkingSlot.status === 'available' || isMultiSelectMode) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={handleToggleMultiSelectMode}
                                            style={{
                                                padding: '6px 10px',
                                                background: isMultiSelectMode ? '#8b5cf6' : '#e2e8f0',
                                                color: isMultiSelectMode ? 'white' : '#64748b',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {isMultiSelectMode ? '☑' : '☐'} Select Multiple
                                        </button>

                                        {isMultiSelectMode && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    className="btn-gray"
                                                    onClick={handleUndoReservationSelection}
                                                    disabled={reservationSelectionOrder.length === 0}
                                                    style={{ marginTop: 0, padding: '6px 10px', fontSize: '12px', opacity: reservationSelectionOrder.length === 0 ? 0.5 : 1 }}
                                                >
                                                    Undo Last
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-gray"
                                                    onClick={handleClearReservationSelections}
                                                    disabled={selectedSpotsForReservation.size === 0}
                                                    style={{ marginTop: 0, padding: '6px 10px', fontSize: '12px', opacity: selectedSpotsForReservation.size === 0 ? 0.5 : 1 }}
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="btn-blue"
                                                onClick={() => {
                                                    if (isGuestReservationWindow(selectedParkingSlot)) {
                                                        setParkPlateInput('');
                                                        setParkStickerInput('');
                                                    } else {
                                                        const validStickers = getValidUserStickers();
                                                        setParkStickerInput(validStickers[0] || '');
                                                    }
                                                    setShowParkForSelectedSpot(true);
                                                }}
                                                disabled={isMultiSelectMode}
                                                style={{
                                                    marginTop: 0,
                                                    padding: '8px 10px',
                                                    fontSize: '12px',
                                                    opacity: isMultiSelectMode ? 0.5 : 1,
                                                    cursor: isMultiSelectMode ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                Park
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-purple"
                                                onClick={handleOpenReservationModal}
                                                style={{ marginTop: 0, padding: '8px 10px', fontSize: '12px' }}
                                            >
                                                {isMultiSelectMode
                                                    ? `Reserve Spot(s) (${selectedSpotsForReservation.size})`
                                                    : 'Reserve Spot(s)'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {selectedParkingSlot.status === 'occupied' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn-gray"
                                            onClick={handleLeaveSelectedSpot}
                                            disabled={!isCurrentUserSpot(selectedParkingSlot)}
                                            style={{
                                                marginTop: 0,
                                                padding: '8px 10px',
                                                fontSize: '12px',
                                                opacity: isCurrentUserSpot(selectedParkingSlot) ? 1 : 0.55,
                                                cursor: isCurrentUserSpot(selectedParkingSlot) ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            Leave / Check Out
                                        </button>
                                        {!isCurrentUserSpot(selectedParkingSlot) && (
                                            <div style={{ fontSize: '11px', color: '#92400e' }}>
                                                You can only check out spots parked using your own sticker.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isMultiSelectMode && (
                                    <div style={{
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        background: '#ede9fe',
                                        border: '1px solid #c4b5fd',
                                        color: '#5b21b6',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>Multi-select ON</div>
                                        <div>
                                            Selected spots: {selectedSpotsForReservation.size > 0
                                                ? Array.from(selectedSpotsForReservation).sort((a, b) => a - b).join(', ')
                                                : 'None yet'}
                                        </div>
                                    </div>
                                )}

                                {selectedParkingSlot.status === 'available' && showParkForSelectedSpot && (
                                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', padding: '8px', marginTop: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#1e40af', marginBottom: '6px', fontWeight: 600 }}>
                                            Parking Spot #{selectedParkingSlot.id}
                                        </div>
                                        {isGuestReservationWindow(selectedParkingSlot) ? (
                                            <input
                                                type="text"
                                                placeholder="Enter Plate Number"
                                                value={parkPlateInput}
                                                onChange={(e) => setParkPlateInput(e.target.value)}
                                                style={{ margin: 0 }}
                                            />
                                        ) : (() => {
                                            const parkStickerOptions = getValidUserStickers();

                                            if (parkStickerOptions.length === 0) {
                                                return (
                                                    <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 700 }}>
                                                        No valid parking sticker found for this account this semester.
                                                    </div>
                                                );
                                            }

                                            if (parkStickerOptions.length === 1) {
                                                return (
                                                    <input
                                                        type="text"
                                                        value={parkStickerOptions[0]}
                                                        disabled
                                                        style={{ margin: 0, background: '#f8fafc', color: '#334155' }}
                                                    />
                                                );
                                            }

                                            return (
                                                <select
                                                    value={parkStickerInput}
                                                    onChange={(e) => setParkStickerInput(e.target.value)}
                                                    style={{ margin: 0 }}
                                                >
                                                    {parkStickerOptions.map((stickerOption) => (
                                                        <option key={stickerOption} value={stickerOption}>{stickerOption}</option>
                                                    ))}
                                                </select>
                                            );
                                        })()}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            {(() => {
                                                const parkStickerOptions = getValidUserStickers();
                                                const noValidSticker = !isGuestReservationWindow(selectedParkingSlot) && parkStickerOptions.length === 0;

                                                return (
                                                <button
                                                    type="button"
                                                    className="btn-green"
                                                    onClick={handleParkSelectedSpot}
                                                    disabled={noValidSticker}
                                                    style={{
                                                        marginTop: 0,
                                                        padding: '8px 10px',
                                                        fontSize: '12px',
                                                        opacity: noValidSticker ? 0.5 : 1,
                                                        cursor: noValidSticker ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    Confirm Park
                                                </button>
                                                    );
                                            })()}
                                            <button
                                                type="button"
                                                className="btn-gray"
                                                onClick={() => setShowParkForSelectedSpot(false)}
                                                style={{ marginTop: 0, padding: '8px 10px', fontSize: '12px' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                                Click a spot to see Spot ID, Status, and Assigned Sticker ID.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: '1 1 680px', minWidth: 0 }}>
                {activeTab === 'dashboard' && (
                <>
                    <div className="panel">
                        <h3 className="panel-title">Dashboard</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '12px' }}>
                                <div style={{ color: '#4c1d95', fontSize: '12px', fontWeight: 700 }}>Pending Reservations</div>
                                <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#1e1b4b' }}>{pendingReservationsCount}</div>
                            </div>
                            <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                                <div style={{ color: '#166534', fontSize: '12px', fontWeight: 700 }}>Occupied Slots</div>
                                <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#14532d' }}>{occupiedCount} / {TOTAL_PARKING_SLOTS}</div>
                            </div>
                        </div>
                    </div>

                    <div className="panel">
                        <h3 className="panel-title">📋 My Parking Reservations</h3>
                        {userReservations.length === 0 ? (
                            <p style={{ color: '#64748b' }}>You haven't made any reservations yet.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Spots</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Reason</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Reserved For</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Submitted</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Admin Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUserReservations.map((res) => {
                                            const statusColor = 
                                                res.status === 'approved' ? '#10b981' :
                                                res.status === 'denied' ? '#ef4444' :
                                                res.status === 'pending' ? '#f59e0b' :
                                                '#6b7280';
                                            const statusBg = 
                                                res.status === 'approved' ? '#d1fae5' :
                                                res.status === 'denied' ? '#fee2e2' :
                                                res.status === 'pending' ? '#fef3c7' :
                                                '#f3f4f6';

                                            return (
                                                <tr key={res.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '10px', fontWeight: 600 }}>
                                                        {Array.isArray(res.reserved_spots) 
                                                            ? res.reserved_spots.join(', ')
                                                            : JSON.parse(res.reserved_spots || '[]').join(', ')}
                                                    </td>
                                                    <td style={{ padding: '10px', fontSize: '12px' }}>{res.reservation_reason}</td>
                                                    <td style={{ padding: '10px', fontSize: '12px' }}>
                                                        {new Date(res.reserved_for_datetime).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 8px',
                                                            background: statusBg,
                                                            color: statusColor,
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {res.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px', fontSize: '12px' }}>
                                                        {new Date(res.created_at).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '10px', fontSize: '12px', color: '#64748b' }}>
                                                        {res.admin_notes || '---'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {userReservations.length > USER_RESERVATIONS_PAGE_SIZE && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <button
                                    className="btn-gray slim"
                                    onClick={() => setUserReservationsPage((prev) => Math.max(1, prev - 1))}
                                    disabled={safeUserReservationsPage === 1}
                                    style={{ marginTop: 0, opacity: safeUserReservationsPage === 1 ? 0.6 : 1, fontSize: '12px', padding: '4px 8px' }}
                                >
                                    Prev
                                </button>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', minWidth: '90px', textAlign: 'center' }}>
                                    Page {safeUserReservationsPage} of {userReservationsTotalPages}
                                </span>
                                <button
                                    className="btn-gray slim"
                                    onClick={() => setUserReservationsPage((prev) => Math.min(userReservationsTotalPages, prev + 1))}
                                    disabled={safeUserReservationsPage === userReservationsTotalPages}
                                    style={{ marginTop: 0, opacity: safeUserReservationsPage === userReservationsTotalPages ? 0.6 : 1, fontSize: '12px', padding: '4px 8px' }}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </>
                )}

                {activeTab === 'parking-map' && (
                <div className="panel">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '15px' }}>
                        <h3 className="panel-title" style={{ margin: 0 }}>Parking Layout Grid</h3>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#9ca3af', borderRadius: '50%', marginRight: '6px' }}></span>Available</span>
                            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', marginRight: '6px' }}></span>Occupied</span>
                            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ca8a04', borderRadius: '50%', marginRight: '6px' }}></span>Reserved</span>
                            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#14b8a6', borderRadius: '50%', marginRight: '6px' }}></span>Selected</span>
                        </div>
                    </div>

                    {displayParkingSlots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                            <p style={{ fontSize: '14px' }}>No parking slots available</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '980px' }}>
                                {visibleParkingAreas.map((area) => {
                                    const areaSlots = displayParkingSlots.slice(area.startId - 1, area.startId - 1 + area.slotCount);

                                    return (
                                        <div key={area.name} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#334155' }}>{area.name}</h4>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                {area.name === 'Vertical Parking Space' ? (
                                                    <>
                                                        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: '16px', overflowX: 'auto', paddingBottom: '6px' }}>
                                                            {Array.from({ length: 5 }, (_, columnIndex) => {
                                                                const columnSlots = areaSlots.slice(columnIndex * 10, (columnIndex + 1) * 10);

                                                                return (
                                                                    <div key={`${area.name}-col-${columnIndex}`} style={{ display: 'flex', alignItems: 'stretch', gap: '16px', flex: '0 0 auto' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '170px' }}>
                                                                            {columnSlots.map(slot => {
                                                                                const slotStyle = getParkingSlotFill(slot);
                                                                                const isSelected = selectedParkingSlotId === slot.id;

                                                                                return (
                                                                                    <button
                                                                                        key={slot.id}
                                                                                        type="button"
                                                                                        onDoubleClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            handleToggleMultiSelectMode();
                                                                                        }}
                                                                                        onClick={() => {
                                                                                            if (isMultiSelectMode) {
                                                                                                setSelectedParkingSlotId(slot.id);
                                                                                                setSelectedSpotsForReservation((prevSelected) => {
                                                                                                    const nextSelected = new Set(prevSelected);
                                                                                                    if (nextSelected.has(slot.id)) {
                                                                                                        nextSelected.delete(slot.id);
                                                                                                        setReservationSelectionOrder((prevOrder) => prevOrder.filter((id) => id !== slot.id));
                                                                                                    } else {
                                                                                                        nextSelected.add(slot.id);
                                                                                                        setReservationSelectionOrder((prevOrder) => [...prevOrder.filter((id) => id !== slot.id), slot.id]);
                                                                                                    }
                                                                                                    return nextSelected;
                                                                                                });
                                                                                            } else {
                                                                                                setSelectedParkingSlotId(isSelected ? null : slot.id);
                                                                                            }
                                                                                        }}
                                                                                        aria-pressed={isMultiSelectMode ? selectedSpotsForReservation.has(slot.id) : isSelected}
                                                                                        title={getSlotTooltipText(slot)}
                                                                                        style={{
                                                                                            border: `2px solid ${slotStyle.borderColor}`,
                                                                                            borderRadius: '14px',
                                                                                            padding: '14px 10px',
                                                                                            textAlign: 'center',
                                                                                            background: isMultiSelectMode && selectedSpotsForReservation.has(slot.id) 
                                                                                                ? '#bbf7d0'
                                                                                                : slotStyle.background,
                                                                                            color: isMultiSelectMode && selectedSpotsForReservation.has(slot.id)
                                                                                                ? '#14532d'
                                                                                                : slotStyle.color,
                                                                                            boxShadow: isMultiSelectMode && selectedSpotsForReservation.has(slot.id) 
                                                                                                ? '0 0 0 3px #22c55e'
                                                                                                : slotStyle.shadow,
                                                                                            borderColor: isMultiSelectMode && selectedSpotsForReservation.has(slot.id)
                                                                                                ? '#22c55e'
                                                                                                : slotStyle.borderColor,
                                                                                            cursor: 'pointer',
                                                                                            minHeight: '90px',
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            justifyContent: 'center',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease'
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1 }}>P</div>
                                                                                        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>#{slot.id}</div>
                                                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.9 }}>
                                                                                            {getSlotStatusText(slot)}
                                                                                        </div>
                                                                                        {isMultiSelectMode && selectedSpotsForReservation.has(slot.id) && (
                                                                                            <div style={{
                                                                                                fontSize: '0.66rem',
                                                                                                fontWeight: 800,
                                                                                                color: '#14532d',
                                                                                                background: '#dcfce7',
                                                                                                border: '1px solid #86efac',
                                                                                                borderRadius: '999px',
                                                                                                padding: '2px 6px',
                                                                                                lineHeight: 1
                                                                                            }}>
                                                                                                Selected
                                                                                            </div>
                                                                                        )}
                                                                                        {slot.stickerId && (
                                                                                            <div style={{ fontSize: '0.66rem', opacity: 0.95, wordBreak: 'break-word' }}>
                                                                                                {slot.stickerId}
                                                                                            </div>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        {columnIndex < 4 && (
                                                                            <div style={{ width: '36px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
                                                                                <div
                                                                                    style={{
                                                                                        width: (columnIndex === 1 || columnIndex === 3) ? '24px' : '18px',
                                                                                        borderRadius: '12px',
                                                                                        background: (columnIndex === 1 || columnIndex === 3)
                                                                                            ? 'linear-gradient(180deg, #4b5563 0%, #374151 100%)'
                                                                                            : '#94a3b8',
                                                                                        border: (columnIndex === 1 || columnIndex === 3) ? '1px solid #334155' : '1px solid #94a3b8',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        overflow: 'hidden'
                                                                                    }}
                                                                                >
                                                                                    <span
                                                                                        style={{
                                                                                            writingMode: 'vertical-rl',
                                                                                            textOrientation: 'mixed',
                                                                                            fontSize: '9px',
                                                                                            letterSpacing: '0.8px',
                                                                                            textTransform: 'uppercase',
                                                                                            fontWeight: 800,
                                                                                            color: (columnIndex === 1 || columnIndex === 3) ? '#ffffff' : '#1e293b',
                                                                                            opacity: 0.95
                                                                                        }}
                                                                                    >
                                                                                        {(columnIndex === 1 || columnIndex === 3) ? 'Road / Lane' : 'Gutter / Island'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {Array.from({ length: area.totalRows }, (_, rowIndex) => {
                                                            const startIndex = rowIndex * area.slotsPerRow;
                                                            const rowSlots = areaSlots.slice(startIndex, startIndex + area.slotsPerRow);

                                                            return (
                                                                <div key={`${area.name}-${rowIndex}`}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${area.slotsPerRow}, minmax(0, 1fr))`, gap: '12px' }}>
                                                                        {rowSlots.map(slot => {
                                                                            const slotStyle = getParkingSlotFill(slot);
                                                                            const isSelected = selectedParkingSlotId === slot.id;

                                                                                return (
                                                                                    <button
                                                                                        key={slot.id}
                                                                                        type="button"
                                                                                        onDoubleClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            handleToggleMultiSelectMode();
                                                                                        }}
                                                                                        onClick={() => {
                                                                                            if (isMultiSelectMode) {
                                                                                                setSelectedParkingSlotId(slot.id);
                                                                                                setSelectedSpotsForReservation((prevSelected) => {
                                                                                                    const nextSelected = new Set(prevSelected);
                                                                                                    if (nextSelected.has(slot.id)) {
                                                                                                        nextSelected.delete(slot.id);
                                                                                                        setReservationSelectionOrder((prevOrder) => prevOrder.filter((id) => id !== slot.id));
                                                                                                    } else {
                                                                                                        nextSelected.add(slot.id);
                                                                                                        setReservationSelectionOrder((prevOrder) => [...prevOrder.filter((id) => id !== slot.id), slot.id]);
                                                                                                    }
                                                                                                    return nextSelected;
                                                                                                });
                                                                                            } else {
                                                                                                setSelectedParkingSlotId(isSelected ? null : slot.id);
                                                                                            }
                                                                                        }}
                                                                                        aria-pressed={isMultiSelectMode ? selectedSpotsForReservation.has(slot.id) : isSelected}
                                                                                        title={getSlotTooltipText(slot)}
                                                                                        style={{
                                                                                            border: `2px solid ${isMultiSelectMode && selectedSpotsForReservation.has(slot.id) ? '#22c55e' : slotStyle.borderColor}`,
                                                                                            borderRadius: '14px',
                                                                                            padding: '14px 10px',
                                                                                            textAlign: 'center',
                                                                                            background: isMultiSelectMode && selectedSpotsForReservation.has(slot.id) ? '#bbf7d0' : slotStyle.background,
                                                                                            color: isMultiSelectMode && selectedSpotsForReservation.has(slot.id) ? '#14532d' : slotStyle.color,
                                                                                            boxShadow: isMultiSelectMode && selectedSpotsForReservation.has(slot.id) ? '0 0 0 3px #22c55e' : slotStyle.shadow,
                                                                                            cursor: 'pointer',
                                                                                            minHeight: '120px',
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            justifyContent: 'center',
                                                                                            alignItems: 'center',
                                                                                            gap: '6px',
                                                                                            transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease'
                                                                                        }}
                                                                                    >
                                                                                    <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1 }}>P</div>
                                                                                    <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>#{slot.id}</div>
                                                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.9 }}>
                                                                                        {getSlotStatusText(slot)}
                                                                                    </div>
                                                                                    {isMultiSelectMode && selectedSpotsForReservation.has(slot.id) && (
                                                                                        <div style={{
                                                                                            fontSize: '0.66rem',
                                                                                            fontWeight: 800,
                                                                                            color: '#14532d',
                                                                                            background: '#dcfce7',
                                                                                            border: '1px solid #86efac',
                                                                                            borderRadius: '999px',
                                                                                            padding: '2px 6px',
                                                                                            lineHeight: 1
                                                                                        }}>
                                                                                            Selected
                                                                                        </div>
                                                                                    )}
                                                                                    {slot.stickerId && (
                                                                                        <div style={{ fontSize: '0.68rem', opacity: 0.95, wordBreak: 'break-word' }}>
                                                                                            {slot.stickerId}
                                                                                        </div>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {(area.name === 'Old Parking Space' && (rowIndex === 0 || rowIndex === 2)) && (
                                                                        <div style={{ margin: '18px 0 2px', position: 'relative', height: '54px', borderRadius: '10px', overflow: 'hidden', background: 'linear-gradient(180deg, #4b5563 0%, #374151 100%)', border: '1px solid #1f2937' }}>
                                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                                                Road / Lane
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(area.name === 'Old Parking Space' && rowIndex === 1) && (
                                                                        <div style={{ margin: '10px 0 4px', position: 'relative', height: '20px', borderRadius: '8px', overflow: 'hidden', background: '#9ca3af', border: '1px solid #94a3b8' }}>
                                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                                                                Gutter / Island
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(area.name === 'New Parking Space' && (rowIndex === 0 || rowIndex === 2 || rowIndex === 4)) && (
                                                                        <div style={{ margin: '18px 0 2px', position: 'relative', height: '54px', borderRadius: '10px', overflow: 'hidden', background: 'linear-gradient(180deg, #4b5563 0%, #374151 100%)', border: '1px solid #1f2937' }}>
                                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                                                Road / Lane
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(area.name === 'New Parking Space' && (rowIndex === 1 || rowIndex === 3)) && (
                                                                        <div style={{ margin: '10px 0 4px', position: 'relative', height: '20px', borderRadius: '8px', overflow: 'hidden', background: '#9ca3af', border: '1px solid #94a3b8' }}>
                                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                                                                Gutter / Island
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* RESERVATION MODAL */}
            {showReservationModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '720px',
                        background: '#ffffff',
                        borderRadius: '16px',
                        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
                        border: '1px solid #e2e8f0',
                        padding: '24px'
                    }}>
                        <h3 style={{ margin: '0 0 12px', color: '#0f172a' }}>
                            Reserve Spot{selectedSpotsForReservation.size > 1 ? 's' : ''}
                        </h3>

                        {reservationModalError && (
                            <div style={{
                                marginBottom: '12px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                fontSize: '12px',
                                fontWeight: 700
                            }}>
                                {reservationModalError}
                            </div>
                        )}

                        {selectedSpotsForReservation.size === 1 ? (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                        UA Sticker ID
                                    </label>
                                    {(() => {
                                        const singleSpotStickerOptions = getValidUserStickers();
                                        if (singleSpotStickerOptions.length === 0) {
                                            return (
                                                <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 700 }}>
                                                    No valid parking sticker available. Reservation is disabled.
                                                </div>
                                            );
                                        }
                                        if (singleSpotStickerOptions.length === 1) {
                                            return (
                                                <input
                                                    type="text"
                                                    value={singleSpotStickerOptions[0]}
                                                    disabled
                                                    style={{ background: '#f8fafc', color: '#334155' }}
                                                />
                                            );
                                        }
                                        return (
                                            <select
                                                value={reserveStickerInput}
                                                onChange={(e) => setReserveStickerInput(e.target.value)}
                                            >
                                                {singleSpotStickerOptions.map((stickerOption) => (
                                                    <option key={stickerOption} value={stickerOption}>{stickerOption}</option>
                                                ))}
                                            </select>
                                        );
                                    })()}
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                        Reason
                                    </label>
                                    <input
                                        type="text"
                                        value={reservationReasonText}
                                        onChange={(e) => setReservationReasonText(e.target.value)}
                                        placeholder="Why are you reserving this spot?"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                        Reason Category
                                    </label>
                                    <select value={reservationReasonCategory} onChange={(e) => setReservationReasonCategory(e.target.value)}>
                                        <option value="" disabled>Select reason category</option>
                                        <option value="Org Related Event">Org Related Event</option>
                                        <option value="School Related Event">School Related Event</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>

                                {reservationReasonCategory === 'School Related Event' && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Event Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationEventName}
                                                    onChange={(e) => setReservationEventName(e.target.value)}
                                                    placeholder="Enter event name"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Activity Form No.
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationActivityForm}
                                                    onChange={(e) => setReservationActivityForm(e.target.value)}
                                                    placeholder="Enter activity form number"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                Name of Person Requesting Reservation
                                            </label>
                                            <input
                                                type="text"
                                                value={reservationRequesterName}
                                                onChange={(e) => setReservationRequesterName(e.target.value)}
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                    </>
                                )}

                                {reservationReasonCategory === 'Org Related Event' && (
                                    <>
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                Org Name
                                            </label>
                                            <input
                                                type="text"
                                                value={reservationOrgName}
                                                onChange={(e) => setReservationOrgName(e.target.value)}
                                                placeholder="Organization name"
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Event Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationEventName}
                                                    onChange={(e) => setReservationEventName(e.target.value)}
                                                    placeholder="Enter event name"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Activity Form
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationActivityForm}
                                                    onChange={(e) => setReservationActivityForm(e.target.value)}
                                                    placeholder="Activity / event name"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Name of Person Requesting Reservation
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationRequesterName}
                                                    onChange={(e) => setReservationRequesterName(e.target.value)}
                                                    placeholder="Full name"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                    Org Position
                                                </label>
                                                <input
                                                    type="text"
                                                    value={reservationOrgPosition}
                                                    onChange={(e) => setReservationOrgPosition(e.target.value)}
                                                    placeholder="Position"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {reservationReasonCategory === 'Others' && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                            Name of Person Requesting Reservation
                                        </label>
                                        <input
                                            type="text"
                                            value={reservationRequesterName}
                                            onChange={(e) => setReservationRequesterName(e.target.value)}
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                )}

                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                        Detailed Reason
                                    </label>
                                    <textarea
                                        value={reservationReasonText}
                                        onChange={(e) => setReservationReasonText(e.target.value)}
                                        placeholder="Write the full reservation reason here..."
                                        rows={4}
                                        style={{
                                            width: '100%',
                                            maxWidth: '100%',
                                            boxSizing: 'border-box',
                                            resize: 'vertical',
                                            overflowY: 'auto'
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                Date and Time
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Calendar Date</div>
                                    <input
                                        type="date"
                                        value={reserveDate}
                                        onChange={(e) => setReserveDate(e.target.value)}
                                        style={{
                                            cursor: 'pointer',
                                            background: '#f8fafc',
                                            border: '1px solid #94a3b8',
                                            color: '#0f172a',
                                            colorScheme: 'light'
                                        }}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Time</div>
                                    <input
                                        type="time"
                                        value={reserveTime}
                                        onChange={(e) => setReserveTime(e.target.value)}
                                        style={{
                                            cursor: 'pointer',
                                            background: '#f8fafc',
                                            border: '1px solid #94a3b8',
                                            color: '#0f172a',
                                            colorScheme: 'light'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {isMultiSelectMode && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                                Selected spots: {Array.from(selectedSpotsForReservation).sort((a, b) => a - b).join(', ')}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn-green"
                                onClick={handleSubmitReservation}
                                style={{ flex: 1, marginTop: 0 }}
                            >
                                Submit Reservation
                            </button>
                            <button
                                type="button"
                                className="btn-gray"
                                onClick={() => {
                                    setShowReservationModal(false);
                                    setReservationModalError('');
                                    setReserveStickerInput('');
                                    setReserveDate('');
                                    setReserveTime('');
                                    setReservationReasonText('');
                                    setReservationReasonCategory('');
                                    setReservationOrgName('');
                                    setReservationEventName('');
                                    setReservationActivityForm('');
                                    setReservationRequesterName('');
                                    setReservationOrgPosition('');
                                    setReservationSelectionOrder([]);
                                }}
                                style={{ flex: 1, marginTop: 0 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEAVE CONFIRM MODAL */}
            {showLeaveConfirmModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '420px',
                        background: '#ffffff',
                        borderRadius: '14px',
                        boxShadow: '0 18px 42px rgba(15, 23, 42, 0.22)',
                        border: '1px solid #e2e8f0',
                        padding: '18px'
                    }}>
                        <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '1rem' }}>Confirm Check Out</h3>
                        <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '13px' }}>
                            Leave/check out spot #{leaveConfirmSlotId} now?
                        </p>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn-green"
                                onClick={handleConfirmLeaveSelectedSpot}
                                style={{ flex: 1, marginTop: 0 }}
                            >
                                Yes, Check Out
                            </button>
                            <button
                                type="button"
                                className="btn-gray"
                                onClick={() => {
                                    setShowLeaveConfirmModal(false);
                                    setLeaveConfirmSlotId(null);
                                }}
                                style={{ flex: 1, marginTop: 0 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
