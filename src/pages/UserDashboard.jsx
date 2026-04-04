import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { usePopup } from '../components/PopupContext';

/**
 * UserDashboard Component
 * Main user interface for parking applications and parking access.
 * Features: Application submission, status tracking, parking access, profile management.
 */
export default function UserDashboard() {
    const navigate = useNavigate();
    const { showError, showSuccess, showInfo } = usePopup();
    const passwordRule = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    const TOTAL_PARKING_SLOTS = 180;

    // User and application data
    const [user, setUser] = useState(null);
    const [records, setRecords] = useState([]);

    // Form and UI state
    const [plate, setPlate] = useState('');
    const [type, setType] = useState('4-Wheels');
    const [showNotif, setShowNotif] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [timeTick, setTimeTick] = useState(Date.now());
    const [paymentMethod, setPaymentMethod] = useState('GCash');
    const [paymentReference, setPaymentReference] = useState('');

    // Profile update state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [newIdentifier, setNewIdentifier] = useState('');

    // Parking functionality state
    const [activeTab, setActiveTab] = useState('dashboard');
    const [parkingSlots, setParkingSlots] = useState([]);
    const [stickers, setStickers] = useState([]);
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
    
    // Reservation form state (single and multiple spots)
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
    
    const [userReservations, setUserReservations] = useState([]);
    const [applicationRecordsPage, setApplicationRecordsPage] = useState(1);
    const [userReservationsPage, setUserReservationsPage] = useState(1);
    const [reservationStatusNotifs, setReservationStatusNotifs] = useState([]);
    const [readReservationNotifKeys, setReadReservationNotifKeys] = useState([]);

    // Parking form state
    const [stickerInput, setStickerInput] = useState('');
    const [slotInput, setSlotInput] = useState('');
    const [leaveIdentifier, setLeaveIdentifier] = useState('');

    const paymentMethods = ['Pay On-Site', 'GCash', 'BPI', 'BDO', 'PNB', 'USSC', 'Palawan Express', 'RCBC', 'Cebuana Lhuillier'];

    // Dropdown data
    const strands = ["STEM", "ABM", "HUMSS", "GAS", "TVL"];
    const courses = ["BSIT", "BSCS", "BSBA", "BSCrim", "BSHM", "BSA", "BSED"];
    const nonStudentReasons = [
        'Parent/Guardian',
        'Service Personnel',
        'Visitor',
        'Delivery Rider',
        'Vendor/Supplier',
        'Alumni',
        'Event Participant',
        'Other'
    ];

    /**
     * Decrypt DES-encrypted data using the application secret key.
     */
    const decryptData = (ciphertext) => {
        try {
            const bytes = CryptoJS.DES.decrypt(ciphertext, 'UA-SECRET-KEY');
            return bytes.toString(CryptoJS.enc.Utf8) || ciphertext;
        } catch (e) { return ciphertext; }
    };

    const getCurrentSemesterRange = (baseDate = new Date()) => {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth() + 1;

        if (month >= 8 && month <= 12) {
            return {
                start: new Date(year, 7, 1),
                end: new Date(year, 11, 31)
            };
        }

        if (month >= 1 && month <= 5) {
            return {
                start: new Date(year, 0, 1),
                end: new Date(year, 4, 31)
            };
        }

        return {
            start: new Date(year, 5, 1),
            end: new Date(year, 6, 31)
        };
    };

    const isStickerValidForCurrentSemester = (record) => {
        if (!record || record.status !== 'Approved' || !record.expiration_date) {
            return false;
        }

        const expiration = new Date(`${record.expiration_date}T00:00:00`);
        if (Number.isNaN(expiration.getTime())) {
            return false;
        }

        const { start, end } = getCurrentSemesterRange(new Date());
        return expiration >= start && expiration <= end;
    };

    /**
     * Get plate number from sticker ID by looking up user applications.
     */
    const getPlateFromSticker = (stickerId) => {
        if (!records || records.length === 0) return null;
        const normalizedStickerId = (stickerId || '').trim().toUpperCase();
        const application = records.find(r =>
            isStickerValidForCurrentSemester(r) &&
            (r.sticker_id || '').trim().toUpperCase() === normalizedStickerId
        );
        return application ? decryptData(application.plate_number) : null;
    };

    /**
     * Get valid sticker IDs for the current semester.
     */
    const getValidUserStickers = () => {
        if (!records || records.length === 0) return [];
        return [...new Set(records
            .filter(r => isStickerValidForCurrentSemester(r))
            .map(r => (r.sticker_id || '').trim().toUpperCase())
            .filter(id => id))];
    };

    /**
     * Initialize user session and fetch application records.
     * Redirects to login if no valid session exists.
     */
    useEffect(() => {
        const savedUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!savedUser) {
            navigate('/');
        } else {
            setUser(savedUser);
            setNewIdentifier(savedUser.identifier || '');
            fetchUserRecords(savedUser.username);
            fetchUserReservations(savedUser.username);
        }
    }, [navigate]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeTick(Date.now());
        }, 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!user?.username) return;
        fetchUserReservations(user.username);
    }, [timeTick, user?.username]);

    useEffect(() => {
        if (!user?.username) {
            setReservationStatusNotifs([]);
            setReadReservationNotifKeys([]);
            return;
        }

        const notifStorageKey = `reservationStatusNotifs_${user.username}`;
        const readStorageKey = `reservationStatusNotifRead_${user.username}`;

        const savedNotifs = JSON.parse(localStorage.getItem(notifStorageKey) || '[]');
        const savedReadKeys = JSON.parse(localStorage.getItem(readStorageKey) || '[]');

        setReservationStatusNotifs(Array.isArray(savedNotifs) ? savedNotifs : []);
        setReadReservationNotifKeys(Array.isArray(savedReadKeys) ? savedReadKeys : []);
    }, [user?.username]);

    useEffect(() => {
        if (!user?.username || !Array.isArray(userReservations)) return;

        const snapshotKey = `reservationStatusSnapshot_${user.username}`;
        const notifStorageKey = `reservationStatusNotifs_${user.username}`;

        const previousSnapshotRaw = JSON.parse(localStorage.getItem(snapshotKey) || '{}');
        const previousSnapshot = previousSnapshotRaw && typeof previousSnapshotRaw === 'object' ? previousSnapshotRaw : {};

        const storedNotifsRaw = JSON.parse(localStorage.getItem(notifStorageKey) || '[]');
        const storedNotifs = Array.isArray(storedNotifsRaw) ? storedNotifsRaw : [];
        const existingKeys = new Set(storedNotifs.map((item) => item.key));

        const nextSnapshot = {};
        const newNotifs = [];

        userReservations.forEach((reservation) => {
            const reservationId = String(reservation.id);
            const nextStatus = (reservation.status || '').toLowerCase();
            const previousStatus = (previousSnapshot[reservationId] || '').toLowerCase();
            nextSnapshot[reservationId] = nextStatus;

            if (!previousStatus || previousStatus === nextStatus) return;

            const notifKey = `${reservationId}-${nextStatus}`;
            if (existingKeys.has(notifKey)) return;

            newNotifs.push({
                key: notifKey,
                reservationId: reservation.id,
                previousStatus,
                nextStatus,
                reservedFor: reservation.reserved_for_datetime,
                adminNotes: (reservation.admin_notes || '').trim(),
                createdAt: new Date().toISOString()
            });
        });

        localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));

        if (newNotifs.length > 0) {
            const mergedNotifs = [...newNotifs, ...storedNotifs].slice(0, 120);
            localStorage.setItem(notifStorageKey, JSON.stringify(mergedNotifs));
            setReservationStatusNotifs(mergedNotifs);

            const latest = newNotifs[0];
            showInfo(`Reservation #${latest.reservationId} changed to ${latest.nextStatus}.`, 2500);
            return;
        }

        setReservationStatusNotifs(storedNotifs);
    }, [user?.username, userReservations, showInfo]);

    useEffect(() => {
        setApplicationRecordsPage(1);
    }, [records.length]);

    useEffect(() => {
        setUserReservationsPage(1);
    }, [userReservations.length]);

    /**
     * Load parking slots and valid stickers from localStorage.
     */
    useEffect(() => {
        const savedSlots = localStorage.getItem('parkingSlots');
        if (savedSlots) {
            const parsedSlots = JSON.parse(savedSlots);
            const normalizedSlots = Array.from({ length: TOTAL_PARKING_SLOTS }, (_, i) => {
                const existingSlot = parsedSlots.find(slot => slot.id === i + 1);
                if (existingSlot) {
                    return {
                        ...existingSlot,
                        reservedFor: existingSlot.reservedFor || null,
                        reservedStickerId: existingSlot.reservedStickerId || ''
                    };
                }
                return {
                    id: i + 1,
                    status: 'available',
                    plateNumber: '',
                    stickerId: '',
                    entryTime: null,
                    reservedFor: null,
                    reservedStickerId: ''
                };
            });
            setParkingSlots(normalizedSlots);
            localStorage.setItem('parkingSlots', JSON.stringify(normalizedSlots));
        } else {
            const initialSlots = Array.from({ length: TOTAL_PARKING_SLOTS }, (_, i) => ({
                id: i + 1,
                status: 'available',
                plateNumber: '',
                stickerId: '',
                entryTime: null,
                reservedFor: null,
                reservedStickerId: ''
            }));
            setParkingSlots(initialSlots);
            localStorage.setItem('parkingSlots', JSON.stringify(initialSlots));
        }
        const savedStickers = localStorage.getItem('validParkingStickers');
        if (savedStickers) {
            setStickers(JSON.parse(savedStickers));
        } else {
            setStickers([]);
        }
    }, [TOTAL_PARKING_SLOTS]);

    /**
     * Fetch user's vehicle application records from backend.
     */
    const fetchUserRecords = async (username) => {
        try {
            const res = await axios.get(`http://127.0.0.1:8000/api/user-records/?username=${username}`);
            setRecords(res.data);
        } catch (err) {
            console.error("User fetch error:", err);
        }
    };

    /**
     * Fetch user's parking reservations (pending, approved, denied).
     */
    const fetchUserReservations = async (username) => {
        try {
            const res = await axios.get(`http://127.0.0.1:8000/api/user-reservations/?username=${username}`);
            setUserReservations(res.data);
        } catch (err) {
            console.error("Reservations fetch error:", err);
        }
    };

    /**
     * Park a vehicle in a specific slot after validating sticker ID.
     * Updates parking state and localStorage.
     */
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

    /**
     * Handle parking vehicle with proper form validation.
     */
    const handleParkVehicle = () => {
        if (!stickerInput.trim()) {
            showError('Please enter a sticker ID');
            return;
        }
        if (!slotInput.trim()) {
            showError('Please enter a slot number');
            return;
        }

        const sticker = stickerInput.trim().toUpperCase();
        const slot = parseInt(slotInput.trim());

        const plateNumber = getPlateFromSticker(sticker);
        if (!plateNumber) {
            showError('Invalid sticker ID or not valid for the current semester.');
            return;
        }

        const availableSlots = parkingSlots.filter(s => s.status === 'available');
        if (availableSlots.length === 0) {
            showError('No available slots');
            return;
        }

        if (availableSlots.find(s => s.id === slot)) {
            if (parkVehicle(slot, plateNumber, sticker)) {
                setStickerInput('');
                setSlotInput('');
            }
        } else {
            showError('Invalid slot number');
        }
    };

    const getReservationInfo = (slot) => {
        if (!slot?.reservedFor || !slot?.reservedStickerId) return null;
        const reservedAt = new Date(slot.reservedFor);
        if (Number.isNaN(reservedAt.getTime())) return null;

        const graceEnd = new Date(reservedAt.getTime() + (30 * 60 * 1000));
        const now = new Date();

        return {
            reservedAt,
            graceEnd,
            isUpcoming: now < reservedAt,
            isActive: now >= reservedAt && now <= graceEnd,
            isOverdue: now > graceEnd
        };
    };

    const formatDateTime = (value) => {
        if (!value) return '---';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '---';
        return d.toLocaleString();
    };

    const getSlotStatusText = (slot) => {
        if (slot.status === 'occupied') return 'Occupied';
        const reservationInfo = getReservationInfo(slot);
        if (!reservationInfo) return 'Available';
        if (reservationInfo.isUpcoming) return 'Available';
        if (reservationInfo.isOverdue) return 'Reserved (Overdue)';
        if (reservationInfo.isActive) return 'Reserved (Now)';
        return 'Reserved';
    };

    const getSlotTooltipText = (slot) => {
        const lines = [
            `Spot ID: ${slot.id}`,
            `Status: ${getSlotStatusText(slot)}`,
            `Assigned Sticker ID: ${slot.stickerId || '---'}`
        ];

        if (slot.reservedStickerId || slot.reservedFor) {
            lines.push(`Reserved Sticker ID: ${slot.reservedStickerId || '---'}`);
            lines.push(`Reserved For: ${formatDateTime(slot.reservedFor)}`);
        }

        return lines.join('\n');
    };

    const isGuestReservationWindow = (slot) => {
        const reservationInfo = getReservationInfo(slot);
        const reservedSticker = (slot?.reservedStickerId || '').trim().toUpperCase();
        return !!reservationInfo && (reservationInfo.isActive || reservationInfo.isOverdue) && reservedSticker === 'N/A';
    };

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

    const handleOpenReservationModal = () => {
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

    const handleClearReservationSelections = () => {
        setSelectedSpotsForReservation(new Set());
        setReservationSelectionOrder([]);
    };

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

    const handleSubmitReservation = () => {
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

    const handleGuardReleaseReservation = () => {
        const selectedSlot = getSelectedParkingSlot();
        if (!selectedSlot) return;

        const reservationInfo = getReservationInfo(selectedSlot);
        if (!reservationInfo || !reservationInfo.isOverdue) {
            showError('Only overdue reservations can be released.');
            return;
        }

        const updatedSlots = parkingSlots.map(slot =>
            slot.id === selectedSlot.id
                ? { ...slot, reservedStickerId: '', reservedFor: null }
                : slot
        );
        setParkingSlots(updatedSlots);
        localStorage.setItem('parkingSlots', JSON.stringify(updatedSlots));
        showInfo(`Reservation cleared for spot ${selectedSlot.id}.`);
    };

    /**
     * Remove vehicle from parking by slot number or plate number.
     */
    const leaveParking = (identifier) => {
        const trimmed = (identifier || '').trim();
        const normalized = trimmed.toUpperCase();

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

    /**
     * Handle leaving parking with proper form validation.
     */
    const handleLeaveParking = () => {
        if (!leaveIdentifier.trim()) {
            showError('Please enter plate number or slot number');
            return;
        }
        leaveParking(leaveIdentifier.trim());
        setLeaveIdentifier('');
    };

    const isCurrentUserSpot = (slot) => {
        if (!slot || !slot.stickerId) return false;
        const normalizedSlotSticker = (slot.stickerId || '').trim().toUpperCase();
        if (!normalizedSlotSticker) return false;

        return records.some((record) => {
            const recordSticker = (record.sticker_id || '').trim().toUpperCase();
            return recordSticker && recordSticker === normalizedSlotSticker;
        });
    };

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

    const getSelectedParkingSlot = () => parkingSlots.find(slot => slot.id === selectedParkingSlotId) || null;

    useEffect(() => {
        setShowParkForSelectedSpot(false);
        setParkStickerInput('');
        setParkPlateInput('');
        setReserveStickerInput('');
        setReserveDate('');
        setReserveTime('');
    }, [selectedParkingSlotId, selectedParkingAreaName]);

    // Get unread notifications (application updates + reservation status updates)
    const applicationNotifications = records.filter(r => r.is_seen === false);
    const unreadReservationStatusNotifs = reservationStatusNotifs.filter(
        (notif) => !readReservationNotifKeys.includes(notif.key)
    );
    const unreadNotificationCount = applicationNotifications.length + unreadReservationStatusNotifs.length;

    useEffect(() => {
        if (!user?.username || parkingSlots.length === 0) return;

        const now = Date.now();
        const escalationDelayMs = 5 * 60 * 1000;
        const userNotifKey = `userReservationReminderNotifs_${user.username}`;
        const userNotifRaw = JSON.parse(localStorage.getItem(userNotifKey) || '[]');
        const userNotif = Array.isArray(userNotifRaw) ? userNotifRaw : [];

        const escalationNotifRaw = JSON.parse(localStorage.getItem('personnelEscalationNotifs') || '[]');
        const escalationNotif = Array.isArray(escalationNotifRaw) ? escalationNotifRaw : [];

        const approvedReservations = userReservations.filter(
            (reservation) => (reservation.status || '').toLowerCase() === 'approved'
        );

        let userChanged = false;
        let escalationChanged = false;

        approvedReservations.forEach((reservation) => {
            const reservedAt = new Date(reservation.reserved_for_datetime || '');
            if (Number.isNaN(reservedAt.getTime())) return;

            const graceEnd = new Date(reservedAt.getTime() + (30 * 60 * 1000));
            const overdueMs = now - graceEnd.getTime();
            if (overdueMs < 0) return;

            let spots = [];
            if (Array.isArray(reservation.reserved_spots)) {
                spots = reservation.reserved_spots;
            } else {
                try {
                    spots = JSON.parse(reservation.reserved_spots || '[]');
                } catch {
                    spots = [];
                }
            }

            spots
                .map((spot) => parseInt(spot, 10))
                .filter((spot) => !Number.isNaN(spot))
                .forEach((spotId) => {
                    const slot = parkingSlots.find((parkingSlot) => parkingSlot.id === spotId);
                    if (slot && slot.status === 'occupied') return;

                    const baseKey = `${reservation.id}-${spotId}`;
                    const userStageKey = `${baseKey}-user-30m`;
                    const escalationStageKey = `${baseKey}-personnel-35m`;

                    if (overdueMs < escalationDelayMs && !userNotif.includes(userStageKey)) {
                        userNotif.push(userStageKey);
                        userChanged = true;
                        showInfo(`Reservation for spot ${spotId} reached 30 minutes. If already parked, change it to Park now. If you will not show up, please release your reservation. Personnel escalation starts in 5 minutes.`, 2600);
                    }

                    if (overdueMs >= escalationDelayMs && !escalationNotif.includes(escalationStageKey)) {
                        escalationNotif.push(escalationStageKey);
                        escalationChanged = true;
                    }
                });
        });

        if (userChanged) {
            localStorage.setItem(userNotifKey, JSON.stringify(userNotif.slice(-400)));
        }
        if (escalationChanged) {
            localStorage.setItem('personnelEscalationNotifs', JSON.stringify(escalationNotif.slice(-500)));
        }
    }, [parkingSlots, userReservations, user, timeTick]);

    useEffect(() => {
        if (!Array.isArray(userReservations) || userReservations.length === 0 || parkingSlots.length === 0) {
            return;
        }

        const now = new Date();
        const approvedReservations = userReservations.filter((reservation) => {
            if ((reservation.status || '').toLowerCase() !== 'approved') return false;
            const reservedAt = new Date(reservation.reserved_for_datetime);
            return !Number.isNaN(reservedAt.getTime());
        });

        if (approvedReservations.length === 0) return;

        const updatesBySlot = new Map();

        const getReservationPriority = (reservedAtIso) => {
            const reservedAt = new Date(reservedAtIso);
            if (Number.isNaN(reservedAt.getTime())) {
                return { rank: -1, timeValue: 0 };
            }

            const graceEnd = new Date(reservedAt.getTime() + (30 * 60 * 1000));
            if (now > graceEnd) {
                return { rank: 3, timeValue: reservedAt.getTime() };
            }
            if (now >= reservedAt) {
                return { rank: 2, timeValue: reservedAt.getTime() };
            }
            // Upcoming gets the lowest priority; nearer upcoming time wins.
            return { rank: 1, timeValue: -reservedAt.getTime() };
        };

        approvedReservations.forEach((reservation) => {
            const reservedAtIso = reservation.reserved_for_datetime || null;
            const reservedSticker = (reservation.sticker_id || '').trim().toUpperCase();
            const nextPriority = getReservationPriority(reservedAtIso);

            let spots = [];
            if (Array.isArray(reservation.reserved_spots)) {
                spots = reservation.reserved_spots;
            } else {
                try {
                    spots = JSON.parse(reservation.reserved_spots || '[]');
                } catch {
                    spots = [];
                }
            }

            spots
                .map((spotId) => parseInt(spotId, 10))
                .filter((spotId) => !Number.isNaN(spotId))
                .forEach((spotId) => {
                    const current = updatesBySlot.get(spotId);
                    const shouldReplace = !current
                        || nextPriority.rank > current.priority.rank
                        || (nextPriority.rank === current.priority.rank && nextPriority.timeValue > current.priority.timeValue);

                    if (!shouldReplace) return;

                    updatesBySlot.set(spotId, {
                        reservedFor: reservedAtIso,
                        reservedStickerId: reservedSticker,
                        priority: nextPriority
                    });
                });
        });

        if (updatesBySlot.size === 0) return;

        let changed = false;
        const syncedSlots = parkingSlots.map((slot) => {
            const update = updatesBySlot.get(slot.id);
            if (!update) return slot;

            // Don't overwrite a currently occupied slot; reservation is already consumed.
            if (slot.status === 'occupied') return slot;

            const nextReservedFor = update.reservedFor || null;
            const nextReservedSticker = update.reservedStickerId || '';
            if (slot.reservedFor === nextReservedFor && slot.reservedStickerId === nextReservedSticker) {
                return slot;
            }

            changed = true;
            return {
                ...slot,
                reservedFor: nextReservedFor,
                reservedStickerId: nextReservedSticker
            };
        });

        if (changed) {
            setParkingSlots(syncedSlots);
            localStorage.setItem('parkingSlots', JSON.stringify(syncedSlots));
        }
    }, [userReservations, parkingSlots]);

    /**
     * Handle Enter key press for application form
     */
    const handleApplicationKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleProceedToPayment(e);
        }
    };

    /**
     * Mark all notifications as read for the current user.
     */
    const markAsRead = async () => {
        const unreadReservationKeys = unreadReservationStatusNotifs.map((notif) => notif.key);
        try {
            await axios.post('http://127.0.0.1:8000/api/mark-notifications-read/', {
                username: user.username
            });
            fetchUserRecords(user.username);
        } catch (err) {
            console.error("Could not mark as read:", err);
        }

        if (user?.username && unreadReservationKeys.length > 0) {
            const readStorageKey = `reservationStatusNotifRead_${user.username}`;
            const mergedReadKeys = [...new Set([...readReservationNotifKeys, ...unreadReservationKeys])];
            setReadReservationNotifKeys(mergedReadKeys);
            localStorage.setItem(readStorageKey, JSON.stringify(mergedReadKeys));
        }

        setShowNotif(false);
    };

    // 3. Update Profile Logic
    const handleUpdateProfile = async () => {
        try {
            const wantsPasswordChange = oldPassword || newPassword || confirmNewPassword;

            if (wantsPasswordChange) {
                if (!oldPassword || !newPassword || !confirmNewPassword) {
                    showError('Please fill old password, new password, and confirm new password.');
                    return;
                }

                if (!passwordRule.test(oldPassword)) {
                    showError('Old password must be at least 8 characters with at least one uppercase letter and one number.');
                    return;
                }

                if (!passwordRule.test(newPassword)) {
                    showError('New password must be at least 8 characters with at least one uppercase letter and one number.');
                    return;
                }

                if (!passwordRule.test(confirmNewPassword)) {
                    showError('Confirm password must be at least 8 characters with at least one uppercase letter and one number.');
                    return;
                }

                if (newPassword !== confirmNewPassword) {
                    showError('New password and confirm new password do not match.');
                    return;
                }
            }

            const updateData = {
                username: user.username,
                identifier: newIdentifier,
            };
            
            if (wantsPasswordChange) {
                updateData.oldPassword = oldPassword.trim();
                updateData.password = newPassword.trim();
            }

            await axios.post('http://127.0.0.1:8000/api/update-profile/', updateData);
            
            if (wantsPasswordChange) {
                showSuccess("Password changed! Please log in again.");
                localStorage.removeItem('currentUser');
                navigate('/');
            } else {
                const updatedUser = { ...user, identifier: newIdentifier };
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                setUser(updatedUser);
                showSuccess("Profile updated successfully!");
                setShowSettings(false);
            }
        } catch (err) {
            showError(err?.response?.data?.message || "Update failed. Check backend connection.");
        }
    };

    // 4. Submit Application
    const submitApp = async () => {
        if (!plate) return showError("Please enter Plate Number.");
        if (!paymentMethod) return showError("Please select payment method.");
        if (!paymentReference.trim()) return showError("Please enter payment reference number.");

        const displayFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
        const encPlate = CryptoJS.DES.encrypt(plate, 'UA-SECRET-KEY').toString();
        const encOwner = CryptoJS.DES.encrypt(displayFullName, 'UA-SECRET-KEY').toString();
        
        try {
            await axios.post('http://127.0.0.1:8000/api/submit-vehicle/', {
                username: user.username,
                ownerName: encOwner,
                plateNumber: encPlate,
                vehicleType: type,
                paymentMethod,
                paymentReference: paymentReference.trim()
            });
            showSuccess("Application Sent!");
            setPlate('');
            setPaymentMethod('GCash');
            setPaymentReference('');
            setShowPaymentModal(false);
            fetchUserRecords(user.username);
        } catch (err) {
            showError(err?.response?.data?.message || "Submission failed.");
        }
    };

    const handleProceedToPayment = (e) => {
        e.preventDefault();
        if (!plate.trim()) {
            showError('Please enter Plate Number before proceeding to payment.');
            return;
        }
        setShowPaymentModal(true);
    };

    if (!user) return null;

    const normalizedRole = (user.role || '').toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const isGuest = normalizedRole === 'guest' || normalizedRole === 'non-student';
    const roleLabel = isGuest ? 'NON-STUDENT' : (user.role?.toUpperCase() || 'USER');
    const validStickerList = getValidUserStickers();
    const occupiedCount = parkingSlots.filter(slot => slot.status === 'occupied').length;
    const pendingReservationsCount = userReservations.filter(res => res.status === 'pending').length;
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
    const parkingAreas = [
        { name: 'Old Parking Space', startId: 1, slotCount: 40, slotsPerRow: 10, totalRows: 4 },
        { name: 'Vertical Parking Space', startId: 41, slotCount: 50, slotsPerRow: 10, totalRows: 5 },
        { name: 'New Parking Space', startId: 91, slotCount: 90, slotsPerRow: 15, totalRows: 6 }
    ];
    const selectedParkingArea = parkingAreas.find(area => area.name === selectedParkingAreaName) || parkingAreas[0];
    const visibleParkingAreas = [selectedParkingArea];
    const selectedParkingSlot = getSelectedParkingSlot();
    const displayFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;

    const USER_RECORDS_PAGE_SIZE = 10;
    const USER_RESERVATIONS_PAGE_SIZE = 10;

    const orderedUserApplicationRecords = records.slice().reverse();
    const userApplicationTotalPages = Math.max(1, Math.ceil(orderedUserApplicationRecords.length / USER_RECORDS_PAGE_SIZE));
    const safeApplicationRecordsPage = Math.min(applicationRecordsPage, userApplicationTotalPages);
    const paginatedUserApplicationRecords = orderedUserApplicationRecords.slice(
        (safeApplicationRecordsPage - 1) * USER_RECORDS_PAGE_SIZE,
        (safeApplicationRecordsPage - 1) * USER_RECORDS_PAGE_SIZE + USER_RECORDS_PAGE_SIZE
    );

    const userReservationsTotalPages = Math.max(1, Math.ceil(userReservations.length / USER_RESERVATIONS_PAGE_SIZE));
    const safeUserReservationsPage = Math.min(userReservationsPage, userReservationsTotalPages);
    const paginatedUserReservations = userReservations.slice(
        (safeUserReservationsPage - 1) * USER_RESERVATIONS_PAGE_SIZE,
        (safeUserReservationsPage - 1) * USER_RESERVATIONS_PAGE_SIZE + USER_RESERVATIONS_PAGE_SIZE
    );

    return (
        <div className="center">
            <div className="card dashboard-card">
                <div className="topbar">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h2 style={{ margin: 0 }}>Welcome, <span style={{ color: '#6366f1' }}>{displayFullName}</span></h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p className="subtitle" style={{ margin: 0 }}>UA Parking Portal •</p>
                            <span className={`role-badge ${isGuest ? 'guest-tag' : 'student-tag'}`}>
                                {roleLabel}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                        <button className="btn-gray slim" onClick={() => setShowSettings(true)}>⚙️</button>

                        <button className="btn-gray slim bell-btn" onClick={() => setShowNotif(!showNotif)}>
                            🔔
                            {unreadNotificationCount > 0 && <span className="notif-count">{unreadNotificationCount}</span>}
                        </button>

                        {showNotif && (
                            <div className="notif-dropdown">
                                <h4>Recent Updates</h4>
                                {unreadNotificationCount === 0 ? (
                                    <p className="empty-notif">No new notifications.</p>
                                ) : (
                                    <>
                                        {applicationNotifications.slice().reverse().map((n, i) => (
                                            <div key={`app-${i}`} className="notif-item">
                                                Vehicle <strong>{decryptData(n.plate_number)}</strong> has been
                                                <strong className={n.status === 'Approved' ? 'text-green' : 'text-red'}> {n.status}</strong>.
                                            </div>
                                        ))}
                                        {unreadReservationStatusNotifs.map((notif) => (
                                            <div key={notif.key} className="notif-item">
                                                Reservation <strong>#{notif.reservationId}</strong> changed from
                                                <strong style={{ color: '#b45309' }}> {notif.previousStatus || 'pending'}</strong> to
                                                <strong style={{ color: notif.nextStatus === 'approved' ? '#16a34a' : notif.nextStatus === 'denied' ? '#dc2626' : '#0f766e' }}> {notif.nextStatus}</strong>.
                                                {notif.adminNotes ? (
                                                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>
                                                        Note: {notif.adminNotes}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </>
                                )}
                                {unreadNotificationCount > 0 && (
                                    <button className="link-btn mark-read" onClick={markAsRead}>Mark as Read</button>
                                )}
                            </div>
                        )}

                        <button className="btn-blue slim" onClick={() => { localStorage.removeItem('currentUser'); navigate('/'); }}>
                            Logout
                        </button>
                    </div>
                </div>

                {/* SETTINGS MODAL POPUP */}
                {showSettings && (
                    <div className="modal-overlay">
                        <div className="modal-content card" style={{ maxWidth: '520px', width: '92%' }}>
                            <h3 style={{ marginTop: 0, color: '#ffffff' }}>Account Settings</h3>
                            <div style={{ textAlign: 'left', marginTop: '15px' }}>
                                <label className="small-label">Old Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Enter old password" 
                                    value={oldPassword} 
                                    onChange={(e) => setOldPassword(e.target.value)} 
                                    style={{ marginBottom: '10px' }}
                                />

                                <label className="small-label">New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Enter new password" 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    style={{ marginBottom: '10px' }}
                                />

                                <label className="small-label">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Confirm new password" 
                                    value={confirmNewPassword} 
                                    onChange={(e) => setConfirmNewPassword(e.target.value)} 
                                    style={{ marginBottom: '15px' }}
                                />

                                <hr style={{ border: '0.5px solid #e2e8f0', margin: '15px 0' }} />

                                {isGuest ? (
                                    <div>
                                        <label className="small-label">Reason for Account</label>
                                        <select value={newIdentifier} onChange={(e) => setNewIdentifier(e.target.value)}>
                                            <option value="">Select Reason</option>
                                            {!nonStudentReasons.includes(newIdentifier) && newIdentifier && (
                                                <option value={newIdentifier}>Current: {newIdentifier}</option>
                                            )}
                                            {nonStudentReasons.map(reason => (
                                                <option key={reason} value={reason}>{reason}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div>
                                            <label className="small-label">Student ID (Permanent)</label>
                                            <input type="text" value={user.identifier.split(' | ')[0]} disabled className="disabled-input" />
                                        </div>
                                        <div>
                                            <label className="small-label">Update Level</label>
                                            <select 
                                                value={newIdentifier.includes('Senior High') ? 'Senior High' : 'College'} 
                                                onChange={(e) => {
                                                    const idPart = user.identifier.split(' | ')[0];
                                                    setNewIdentifier(`${idPart} | ${e.target.value} - `);
                                                }}
                                            >
                                                <option value="Senior High">Senior High</option>
                                                <option value="College">College</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="small-label">Select Course/Strand</label>
                                            <select 
                                                onChange={(e) => {
                                                    const base = newIdentifier.split(' - ')[0];
                                                    setNewIdentifier(`${base} - ${e.target.value}`);
                                                }}
                                            >
                                                <option value="">-- Choose --</option>
                                                {(newIdentifier.includes('Senior High') ? strands : courses).map(item => (
                                                    <option key={item} value={item}>{item}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button className="btn-green" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={handleUpdateProfile}>Save Changes</button>
                                <button className="btn-gray" onClick={() => { setShowSettings(false); setOldPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {showPaymentModal && (
                    <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                        <div className="modal-content card" style={{ maxWidth: '560px', width: '94%', color: '#ffffff' }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{ marginTop: 0, color: '#ffffff' }}>Sticker Payment</h3>
                            <p style={{ marginBottom: '12px', color: '#ffffff' }}>
                                List of Payment Method:{' '}
                                <a
                                    href="https://bit.ly/ListOfPaymentMethod"
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#93c5fd' }}
                                >
                                    https://bit.ly/ListOfPaymentMethod
                                </a>
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                        <label className="small-label" style={{ color: '#ffffff' }}>Payment Method</label>
                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                            {paymentMethods.map(method => (
                                                <option key={method} value={method}>{method}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="small-label" style={{ color: '#ffffff' }}>Reference Number</label>
                                        <input
                                            type="text"
                                            placeholder="Enter payment reference number"
                                            value={paymentReference}
                                            onChange={(e) => setPaymentReference(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ padding: '10px', borderRadius: '8px', background: '#1e3a8a', color: '#ffffff', fontSize: '13px' }}>
                                        Fee: {type === '2-Wheels' ? 'Php 1,000' : type === '4-Wheels' ? 'Php 2,000' : 'Php 3,000'}
                                    </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                                <button className="btn-gray" style={{ width: '110px', flexShrink: 0 }} onClick={() => setShowPaymentModal(false)}>Back</button>
                                <button className="btn-green" style={{ flex: 1 }} onClick={submitApp}>Confirm Payment</button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                            <button type="button" className={`tab-button ${activeTab === 'stickers' ? 'active' : ''}`} onClick={() => setActiveTab('stickers')}>Stickers</button>
                            {isAdmin && (
                                <button type="button" className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Reports</button>
                            )}
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

                    <div style={{ flex: '1 1 680px', minWidth: 0 }}>

                {activeTab === 'stickers' && (
                <>
                {/* APPLICATION FORM */}
                <div className="panel">
                    <h3 className="panel-title">Apply for Parking Sticker</h3>
                    <form onSubmit={handleProceedToPayment}>
                        <div className="form-row-single">
                            <div className="auto-field">
                                <label className="small-label">Registered Owner</label>
                                <input type="text" value={displayFullName} disabled className="disabled-input" />
                            </div>
                            <div className="input-field">
                                <label className="small-label">Plate Number</label>
                                <input 
                                    placeholder="Enter Plate Number" 
                                    value={plate} 
                                    onChange={e => setPlate(e.target.value)}
                                    onKeyDown={handleApplicationKeyPress}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                            <div>
                                <label className="small-label">Vehicle Type</label>
                                <select value={type} onChange={e => setType(e.target.value)} style={{ margin: '7px 0' }}>
                                    <option value="2-Wheels">2-Wheels (₱1,000)</option>
                                    <option value="4-Wheels">4-Wheels (₱2,000)</option>
                                    <option value="Service">Service (₱3,000)</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn-purple submit-btn" style={{ width: '100%', marginTop: '15px' }}>
                            Proceed to Payment
                        </button>
                    </form>
                </div>

                <div className="panel">
                    <h3 className="panel-title">My Application Records</h3>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Plate Number</th>
                                    <th>Type</th>
                                    <th>Payment Method</th>
                                    <th>Reference No.</th>
                                    <th>Status</th>
                                    <th>Sticker ID</th>
                                    <th>Expires</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr><td colSpan="7" className="empty-table">No records found.</td></tr>
                                ) : (
                                    paginatedUserApplicationRecords.map((v, i) => (
                                        <tr key={i}>
                                            <td className="bold-plate">{decryptData(v.plate_number)}</td>
                                            <td>{v.vehicle_type}</td>
                                            <td>{v.payment_method || '---'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{v.payment_reference || '---'}</td>
                                            <td>
                                                <span className={`status-badge ${v.status.toLowerCase()}`}>
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="sticker-id">{v.sticker_id || '---'}</td>
                                            <td>
                                                {v.expiration_date ? (
                                                    <span style={{ 
                                                        color: new Date(v.expiration_date) < new Date() ? '#dc2626' : '#16a34a',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {new Date(v.expiration_date).toLocaleDateString()}
                                                    </span>
                                                ) : '---'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {orderedUserApplicationRecords.length > USER_RECORDS_PAGE_SIZE && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <button
                                className="btn-gray slim"
                                onClick={() => setApplicationRecordsPage((prev) => Math.max(1, prev - 1))}
                                disabled={safeApplicationRecordsPage === 1}
                                style={{ marginTop: 0, opacity: safeApplicationRecordsPage === 1 ? 0.6 : 1, fontSize: '12px', padding: '4px 8px' }}
                            >
                                Prev
                            </button>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', minWidth: '90px', textAlign: 'center' }}>
                                Page {safeApplicationRecordsPage} of {userApplicationTotalPages}
                            </span>
                            <button
                                className="btn-gray slim"
                                onClick={() => setApplicationRecordsPage((prev) => Math.min(userApplicationTotalPages, prev + 1))}
                                disabled={safeApplicationRecordsPage === userApplicationTotalPages}
                                style={{ marginTop: 0, opacity: safeApplicationRecordsPage === userApplicationTotalPages ? 0.6 : 1, fontSize: '12px', padding: '4px 8px' }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                </>)}

                {activeTab === 'dashboard' && (
                <>

                <div className="panel">
                    <h3 className="panel-title">Dashboard</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ color: '#4c1d95', fontSize: '12px', fontWeight: 700 }}>My Applications</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#1e1b4b' }}>{records.length}</div>
                        </div>
                        <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ color: '#0f766e', fontSize: '12px', fontWeight: 700 }}>Valid Stickers</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#134e4a' }}>{validStickerList.length}</div>
                        </div>
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ color: '#92400e', fontSize: '12px', fontWeight: 700 }}>Pending Reservations</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#78350f' }}>{pendingReservationsCount}</div>
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

                </>)}

                {activeTab === 'sticker-verification' && (
                <>

                <div className="panel">
                    <h3 className="panel-title">Sticker Verification</h3>
                    {validStickerList.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No active sticker found for this account.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Sticker ID</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Plate Number</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Expires</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records
                                        .filter(r => r.status === 'Approved' && r.sticker_id)
                                        .slice()
                                        .reverse()
                                        .map((record, index) => {
                                            const isSemesterValid = isStickerValidForCurrentSemester(record);
                                            return (
                                                <tr key={`${record.sticker_id}-${index}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '10px', fontWeight: 700 }}>{record.sticker_id}</td>
                                                    <td style={{ padding: '10px' }}>{decryptData(record.plate_number)}</td>
                                                    <td style={{ padding: '10px' }}>{record.expiration_date ? new Date(record.expiration_date).toLocaleDateString() : '---'}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 8px',
                                                            borderRadius: '999px',
                                                            background: isSemesterValid ? '#dcfce7' : '#fee2e2',
                                                            color: isSemesterValid ? '#166534' : '#b91c1c',
                                                            fontSize: '11px',
                                                            fontWeight: 700
                                                        }}>
                                                            {isSemesterValid ? 'Verified' : 'Invalid This Semester'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                </>)}

                {activeTab === 'reports' && isAdmin && (
                <>

                <div className="panel">
                    <h3 className="panel-title">Reports</h3>
                    <p style={{ marginTop: 0, color: '#64748b' }}>Admin snapshot of your current parking and reservation activity.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#ffffff' }}>
                            <div style={{ color: '#334155', fontSize: '12px', fontWeight: 700 }}>Total Reservations</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{userReservations.length}</div>
                        </div>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#ffffff' }}>
                            <div style={{ color: '#334155', fontSize: '12px', fontWeight: 700 }}>Approved Applications</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{records.filter(r => r.status === 'Approved').length}</div>
                        </div>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#ffffff' }}>
                            <div style={{ color: '#334155', fontSize: '12px', fontWeight: 700 }}>Occupied Slots</div>
                            <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{occupiedCount}</div>
                        </div>
                    </div>
                </div>

                </>)}

                {activeTab === 'parking-map' && (
                <>

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
                                                                                                // Multi-select mode for reservations
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
                                                                                                // Single select mode for parking
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

                </>)}

                    </div>
                </div>

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

            </div>
        </div>
    );
}