import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { usePopup } from '../components/PopupContext';

export default function Login() {
    const navigate = useNavigate();
    const { showError, showSuccess } = usePopup();
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Form States
    const [loginRole, setLoginRole] = useState('user'); 
    const [regRole, setRegRole] = useState('student');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Register Fields
    const [fName, setFName] = useState('');
    const [lName, setLName] = useState('');
    const [email, setEmail] = useState('');
    const [studentId, setStudentId] = useState('');
    const [level, setLevel] = useState('');
    const [subLevel, setSubLevel] = useState('');
    const [guestPurpose, setGuestPurpose] = useState('');

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
     * Handle Enter key press for login form
     */
    const handleLoginKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    /**
     * Handle Enter key press for registration form
     */
    const handleRegisterKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleRegister();
        }
    };

    const handleLogin = async () => {
        // Unified login; destination depends on account role.
        try {
            const res = await axios.post('http://127.0.0.1:8000/api/login/', {
                username: username.trim(),
                password: password.trim() // Sending plain text for reliable matching
            });

            if (res.data.status === 'success') {
                const userSession = { 
                    username: res.data.user.username, 
                    role: res.data.user.role, 
                    firstName: res.data.user.first_name, 
                    lastName: res.data.user.last_name,
                    identifier: res.data.user.identifier,
                    authToken: res.data.user.auth_token || ''
                };
                localStorage.setItem('currentUser', JSON.stringify(userSession));
                const normalizedRole = (res.data.user.role || '').toLowerCase();
                if (['root_admin', 'admin', 'guard'].includes(normalizedRole)) {
                    navigate('/personnel');
                } else {
                    navigate('/user');
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Login failed: Incorrect credentials.";
            showError(msg);
        }
    };

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        
        if (!username || !password || !fName || !lName) {
            return showError("Please fill in all required fields.");
        }

        if (regRole !== 'student' && !guestPurpose) {
            return showError("Please select a reason for Non-Student account.");
        }

        let identifierText = regRole === 'student' 
            ? `${studentId} | ${level} - ${subLevel}` 
            : (guestPurpose || "Non-Student");

        const newUser = {
            firstName: fName,
            lastName: lName,
            email: email,
            username: username.trim(),
            password: password.trim(), // Saving plain text
            identifier: identifierText,
            role: regRole
        };

        try {
            const res = await axios.post('http://127.0.0.1:8000/api/register/', newUser);
            if (res.data.status === 'success') {
                showSuccess("Account created successfully! You can now Login.");
                setIsRegistering(false);
                // Clear state
                setUsername(''); setPassword(''); setFName(''); setLName('');
            }
        } catch (err) {
            showError(err.response?.data?.message || "Registration failed.");
        }
    };

    return (
        <div className="center">
            <div className="card">
                <h2 style={{ textAlign: 'center' }}>UA Parking System</h2>
                <p className="subtitle" style={{ textAlign: 'center' }}>Secure Vehicle & User Access</p>

                {!isRegistering ? (
                    <div className="login-box">
                        <div className="panel">
                            <h3>Login As</h3>
                            <div className="role-tabs">
                                <button className={`role-tab ${loginRole === 'user' ? 'active' : ''}`} onClick={() => setLoginRole('user')}>Student / Non-Student</button>
                                <button className={`role-tab ${loginRole === 'admin' ? 'active' : ''}`} onClick={() => setLoginRole('admin')}>Personnel</button>
                            </div>
                        </div>

                        <div className="panel">
                            <h3>Credentials</h3>
                            <input 
                                type="text" 
                                placeholder="Username" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={handleLoginKeyPress}
                            />
                            <input 
                                type="password" 
                                placeholder="Password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleLoginKeyPress}
                            />
                            <button className="btn-blue" onClick={handleLogin} style={{ width: '100%', marginTop: '10px' }}>Login to Portal</button>
                            <p className="auth-switch" style={{ textAlign: 'center', marginTop: '15px' }}>
                                New here? <button className="link-btn" onClick={() => setIsRegistering(true)}>Register</button>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="register-box">
                        <div className="panel">
                            <h3>Create Account</h3>
                            <div className="role-tabs">
                                <button className={`role-tab ${regRole === 'student' ? 'active' : ''}`} onClick={() => setRegRole('student')}>Student</button>
                                <button className={`role-tab ${regRole === 'guest' ? 'active' : ''}`} onClick={() => setRegRole('guest')}>Non-Student</button>
                            </div>

                            <div className="action-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
                                <input type="text" placeholder="First Name" value={fName} onChange={(e) => setFName(e.target.value)} />
                                <input type="text" placeholder="Last Name" value={lName} onChange={(e) => setLName(e.target.value)} />
                            </div>

                            <div style={{ marginTop: '10px' }}>
                                {regRole === 'student' ? (
                                    <div className="student-info" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input type="text" placeholder="Student ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                                        <select value={level} onChange={(e) => setLevel(e.target.value)}>
                                            <option value="">Select Level</option>
                                            <option value="Senior High">Senior High</option>
                                            <option value="College">College</option>
                                        </select>
                                        {level && (
                                            <select value={subLevel} onChange={(e) => setSubLevel(e.target.value)}>
                                                <option value="">Select Specialization</option>
                                                {(level === 'Senior High' ? strands : courses).map(item => (
                                                    <option key={item} value={item}>{item}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ) : (
                                    <select value={guestPurpose} onChange={(e) => setGuestPurpose(e.target.value)}>
                                        <option value="">Select Reason</option>
                                        {nonStudentReasons.map(reason => (
                                            <option key={reason} value={reason}>{reason}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <input type="email" placeholder="Email" value={email} style={{ marginTop: '10px' }} onChange={(e) => setEmail(e.target.value)} />
                            <input type="text" placeholder="Username" value={username} style={{ marginTop: '10px' }} onChange={(e) => setUsername(e.target.value)} />
                            <input 
                                type="password" 
                                placeholder="Password" 
                                value={password} 
                                style={{ marginTop: '10px' }} 
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleRegisterKeyPress}
                            />
                            
                            <button className="btn-green" onClick={handleRegister} style={{ width: '100%', marginTop: '20px' }}>Create Account</button>
                            <p className="auth-switch" style={{ textAlign: 'center', marginTop: '15px' }}>
                                Have an account? <button className="link-btn" onClick={() => setIsRegistering(false)}>Login</button>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}