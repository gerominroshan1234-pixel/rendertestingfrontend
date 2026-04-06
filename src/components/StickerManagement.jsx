import { useState } from 'react';
import { usePopup } from './PopupContext';
import axios from 'axios';
import { encryptDES } from '../utils/desCrypto';

/**
 * StickerManagement Component
 * Handles parking sticker applications, payment, and records
 */
export default function StickerManagement({
    user,
    records,
    paymentMethods,
    displayFullName,
    decryptData,
    fetchUserRecords
}) {
    const { showError, showSuccess } = usePopup();

    // Application form state
    const [plate, setPlate] = useState('');
    const [type, setType] = useState('4-Wheels');

    // Payment modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('GCash');
    const [paymentReference, setPaymentReference] = useState('');

    // Table pagination state (records list)
    const [applicationRecordsPage, setApplicationRecordsPage] = useState(1);

    // Number of rows shown per page in "My Application Records"
    const USER_RECORDS_PAGE_SIZE = 10;

    // FEATURE STEP (Form UX): pressing Enter in the plate input
    // performs the same action as clicking "Proceed to Payment".
    const handleApplicationKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleProceedToPayment(e);
        }
    };

    // FEATURE STEP 1 (Application): validate first before opening the payment modal.
    // e.preventDefault() stops the browser's default form submit/reload behavior.
    const handleProceedToPayment = (e) => {
        e.preventDefault();
        // This check prevents the flow from continuing without a plate number.
        if (!plate.trim()) {
            showError('Please enter Plate Number before proceeding to payment.');
            return;
        }
        // Only show the payment modal after the basic input is valid.
        setShowPaymentModal(true);
    };

    /**
    * FEATURE STEP 2 (Application): submit the sticker application to the backend.
     *
     * Flow:
     * 1) Validate required fields.
     * 2) Encrypt sensitive values (owner and plate) using DES utility.
     * 3) Send payload to API.
     * 4) On success, reset UI and refresh records.
     */
    const submitApp = async () => {
        // Required field checks before any encryption/network call.
        if (!plate) return showError("Please enter Plate Number.");
        if (!paymentMethod) return showError("Please select payment method.");
        if (!paymentReference.trim()) return showError("Please enter payment reference number.");

        // Encrypt sensitive data before sending it to the API.
        // plate and owner are encrypted so they are not stored or transmitted as plain text.
        const encPlate = encryptDES(plate);
        const encOwner = encryptDES(displayFullName);
        
        try {
            // Backend receives encrypted ownerName and plateNumber.
            await axios.post('http://127.0.0.1:8000/api/submit-vehicle/', {
                username: user.username,
                ownerName: encOwner,
                plateNumber: encPlate,
                vehicleType: type,
                paymentMethod,
                paymentReference: paymentReference.trim()
            });

            // On success: show a message and reset the form for the next entry.
            showSuccess("Application Sent!");
            setPlate('');
            setPaymentMethod('GCash');
            setPaymentReference('');
            setShowPaymentModal(false);

            // Refresh the table immediately so the user can see the new application.
            fetchUserRecords(user.username);
        } catch (err) {
            // Prefer backend message when available, fallback to generic text.
            showError(err?.response?.data?.message || "Submission failed.");
        }
    };

    // FEATURE (Records Table): show the newest records first without mutating the original array.
    const orderedUserApplicationRecords = records.slice().reverse();

    // FEATURE (Pagination): compute total pages and clamp the current page.
    // Math.max(1, ...) ensures the UI still has Page 1 even when there are no records.
    const userApplicationTotalPages = Math.max(1, Math.ceil(orderedUserApplicationRecords.length / USER_RECORDS_PAGE_SIZE));
    const safeApplicationRecordsPage = Math.min(applicationRecordsPage, userApplicationTotalPages);

    // Only these rows are displayed on the current page.
    const paginatedUserApplicationRecords = orderedUserApplicationRecords.slice(
        (safeApplicationRecordsPage - 1) * USER_RECORDS_PAGE_SIZE,
        (safeApplicationRecordsPage - 1) * USER_RECORDS_PAGE_SIZE + USER_RECORDS_PAGE_SIZE
    );

    return (
        <>
            {/* FEATURE A: Sticker application form */}
            {/* Step A1: user enters the plate and vehicle type */}
            {/* Step A2: user clicks Proceed to Payment */}
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

            {/* FEATURE B: Application records table */}
            {/* Step B1: get the records for the current page */}
            {/* Step B2: decrypt the stored plate_number before displaying it */}
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
                                        {/* The plate is stored encrypted in the backend,
                                            so we decrypt it here to show a readable value to the user. */}
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
                                            {/* Color rule: red means expired, green means still valid. */}
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

            {/* FEATURE C: Payment modal */}
            {/* Step C1: choose a payment method and enter the reference number */}
            {/* Step C2: click Confirm Payment to run submitApp() */}
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
        </>
    );
}