import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
    collection, query, getDocs, onSnapshot, serverTimestamp, where
} from 'firebase/firestore';

import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword, // Add this
    signOut                   // Add this
} from 'firebase/auth';

// --- Firebase Configuration ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCK2RuCvrlEJxD38pPDyk09q4Z30IH0JWY",
  authDomain: "projectorswebapp.firebaseapp.com",
  projectId: "projectorswebapp",
  storageBucket: "projectorswebapp.firebasestorage.app",
  messagingSenderId: "93395619894",
  appId: "1:93395619894:web:dea6c45afe0fed9e104897",
  measurementId: "G-P5D2N3RQGX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-projector-app';

// --- Global User ID (managed by AuthProvider) ---
let currentUserId = null; 

// --- Context for Authentication and Site Settings ---
const AuthContext = createContext();
const SiteSettingsContext = createContext();

// --- Sample Data (will be added to Firestore if not present) ---
const sampleProjectors = [
    {
        id: "cinemabeam-x10",
        name: "CinemaBeam X10",
        tagline: "Ultimate 4K Home Theater Experience",
        description: "Experience breathtaking 4K clarity and vibrant colors with the CinemaBeam X10. Perfect for movie nights and immersive gaming sessions. Features advanced HDR support and ultra-quiet operation.",
        specifications: {
            "Resolution": "4K UHD (3840 x 2160)",
            "Brightness": "3000 ANSI Lumens",
            "Contrast Ratio": "100,000:1 (Dynamic)",
            "Lamp Life": "Up to 20,000 hours (Eco Mode)",
            "Throw Ratio": "1.13-1.47",
            "Connectivity": "HDMI 2.0 (x2), USB-A, Optical Audio Out"
        },
        price: "$1299",
        images: [
            "https://placehold.co/600x400/333/fff?text=CinemaBeam+X10+View+1",
            "https://placehold.co/600x400/444/fff?text=CinemaBeam+X10+View+2",
            "https://placehold.co/600x400/555/fff?text=CinemaBeam+X10+View+3"
        ],
        isFeatured: true,
        // createdAt will be set by serverTimestamp()
    },
    {
        id: "portaview-p5",
        name: "PortaView P5",
        tagline: "Compact & Bright for On-the-Go Presentations",
        description: "The PortaView P5 is your ideal companion for business travel and impromptu movie nights. Lightweight, powerful, and with a built-in battery, it delivers sharp Full HD images anywhere.",
        specifications: {
            "Resolution": "Full HD (1920 x 1080)",
            "Brightness": "2000 ANSI Lumens",
            "Contrast Ratio": "10,000:1",
            "Battery Life": "Up to 3 hours",
            "Weight": "1.5 kg",
            "Connectivity": "HDMI, USB-C, MicroSD"
        },
        price: "$499",
        images: [
            "https://placehold.co/600x400/666/fff?text=PortaView+P5+View+1",
            "https://placehold.co/600x400/777/fff?text=PortaView+P5+View+2"
        ],
        isFeatured: false,
    },
    {
        id: "gamerpro-g7",
        name: "GamerPro G7",
        tagline: "Low Latency Gaming Projector",
        description: "Dominate the game with the GamerPro G7. Featuring an ultra-low input lag and a high refresh rate, this projector ensures smooth, responsive gameplay on a massive screen.",
        specifications: {
            "Resolution": "1080p (1920 x 1080) @ 120Hz",
            "Brightness": "2500 ANSI Lumens",
            "Input Lag": "<16ms",
            "Sound": "Built-in 10W Speaker",
            "Special Features": "Game Mode, HDR10 compatible"
        },
        price: "$799",
        images: [
            "https://placehold.co/600x400/888/fff?text=GamerPro+G7+View+1"
        ],
        isFeatured: false,
    }
];

// --- Helper Functions ---
const getProjectorsCollectionPath = () => `artifacts/${appId}/public/data/projectors`;
const getProjectorDocPath = (id) => `artifacts/${appId}/public/data/projectors/${id}`;
// Note: For inquiries, using currentUserId in the path means admin sees their own submissions.
// For a central admin, inquiries should go to a common admin path.
// This is a simplification for the demo.
const getInquiriesCollectionPath = () => {
    if (!currentUserId) {
        console.warn("getInquiriesCollectionPath called before currentUserId is set. This might lead to issues.");
        // Fallback or throw error, depending on desired strictness. For now, allow it but log.
        return `artifacts/${appId}/users/unknown_user/inquiries`; 
    }
    return `artifacts/${appId}/users/${currentUserId}/inquiries`;
};


// Function to initialize sample data
const initializeSampleData = async () => {
    if (!currentUserId) {
        console.log("User not authenticated yet (currentUserId not set), skipping sample data initialization.");
        return;
    }
    const projectorsCollectionRef = collection(db, getProjectorsCollectionPath());
    
    try {
        const querySnapshot = await getDocs(query(projectorsCollectionRef));

        if (querySnapshot.empty) {
            console.log("No projectors found, adding sample data...");
            for (const proj of sampleProjectors) {
                const projRef = doc(db, getProjectorDocPath(proj.id));
                try {
                    await setDoc(projRef, { ...proj, createdAt: serverTimestamp() });
                    console.log(`Added sample projector: ${proj.name}`);
                } catch (error) {
                    console.error(`Error adding sample projector ${proj.name}:`, error);
                }
            }
        } else {
            console.log("Projectors collection already has data. Skipping sample data initialization.");
        }
    } catch (error) {
        console.error("Error checking projectors collection for sample data initialization:", error);
    }
};
// --- AuthProvider (UPDATED) ---
const AuthProvider = ({ children }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [authReadyUserId, setAuthReadyUserId] = useState(null);

    // !!! IMPORTANT: Paste your Admin User's UID here !!!
    const ADMIN_USER_UID = "lYDbdoogC6WWLEV7rVS86MBdW353"; // <<<< PASTE UID HERE

    useEffect(() => {
        const attemptInitialSignIn = async () => { /* ... existing attemptSignIn logic ... */ };
        // attemptInitialSignIn(); // You might not need this if you are only using email/password for admin

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            let uId;
            setFirebaseUser(user); // Store the full Firebase user object
            if (user) {
                uId = user.uid;
                // Check if the logged-in user is the designated admin
                if (user.uid === ADMIN_USER_UID) {
                    setIsAdmin(true);
                    localStorage.setItem('isAdminLoggedIn', 'true'); // Optional: for session persistence
                } else {
                    setIsAdmin(false);
                    localStorage.removeItem('isAdminLoggedIn');
                }
            } else {
                // No user signed in (or signed out)
                uId = crypto.randomUUID(); // For anonymous session tracking if needed
                setIsAdmin(false);
                localStorage.removeItem('isAdminLoggedIn');
            }
            currentUserId = uId; // Set global for helpers (consider refactoring away from global)
            setAuthReadyUserId(uId);
            
            // Initialize sample data only once after auth state is clear
            if (!authLoading) { // Avoid re-initializing if this is just a token refresh
                initializeSampleData();
            }

            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [authLoading]); // Rerun if authLoading changes to ensure initializeSampleData runs correctly after initial load.

    const login = async (email, password) => {
        setAuthLoading(true); // Indicate loading during login attempt
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle setting isAdmin if UID matches
            // No need to explicitly set isAdmin here if onAuthStateChanged handles it based on UID.
            // If successful, onAuthStateChanged will set isAdmin if user.uid === ADMIN_USER_UID
            setAuthLoading(false);
            return true; // Indicate login attempt was processed
        } catch (error) {
            console.error("Admin login error:", error);
            setIsAdmin(false); // Ensure isAdmin is false on login failure
            localStorage.removeItem('isAdminLoggedIn');
            setAuthLoading(false);
            throw error; // Re-throw error to be caught by AdminLoginPage
        }
    };

    const logout = async () => {
        setAuthLoading(true);
        try {
            await signOut(auth);
            // onAuthStateChanged will handle setting isAdmin to false and clearing local storage
        } catch (error) {
            console.error("Sign out error:", error);
        } finally {
            // onAuthStateChanged should handle the rest, but explicitly clear for immediate effect
            setIsAdmin(false);
            localStorage.removeItem('isAdminLoggedIn');
            setAuthLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ isAdmin, login, logout, authLoading, firebaseUser, userId: authReadyUserId }}>
            {children}
        </AuthContext.Provider>
    );
};

const SiteSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        websiteName: "Projector Hub",
        logoUrl: "https://placehold.co/150x50/000000/FFFFFF?text=Logo",
        contactEmail: "info@projectorhub.com",
        contactPhone: "1-800-555-PROJECT",
        contactAddress: "123 Tech Avenue, Innovation City, TX 75001"
    });
    const [loading, setLoading] = useState(true);
    const authContext = useContext(AuthContext); // Get userId from AuthContext

    useEffect(() => {
        // Wait for userId from AuthContext to be available
        if (!authContext.userId) {
            // console.log("SiteSettingsProvider: Waiting for userId from AuthContext.");
            setLoading(true); // Ensure loading is true if userId is not yet available
            return;
        }
        // console.log("SiteSettingsProvider: userId available, fetching settings:", authContext.userId);
        setLoading(true); // Explicitly set loading before fetch
        const settingsRef = doc(db, `artifacts/${appId}/public/data/siteSettings/config`);
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data());
            } else {
                // Initialize default settings if not exist
                // Use the initial settings state for default values
                const defaultSettings = {
                    websiteName: "Projector Hub",
                    logoUrl: "https://placehold.co/150x50/000000/FFFFFF?text=Logo",
                    contactEmail: "info@projectorhub.com",
                    contactPhone: "1-800-555-PROJECT",
                    contactAddress: "123 Tech Avenue, Innovation City, TX 75001"
                };
                setDoc(settingsRef, defaultSettings).catch(err => console.error("Error initializing site settings:", err));
                setSettings(defaultSettings); // Set to default optimistically
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching site settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authContext.userId]); // Depend on userId from AuthContext

    const updateSettings = async (newSettings) => {
        const settingsRef = doc(db, `artifacts/${appId}/public/data/siteSettings/config`);
        try {
            await setDoc(settingsRef, newSettings, { merge: true });
            setSettings(prev => ({ ...prev, ...newSettings }));
        } catch (error) {
            console.error("Error updating site settings:", error);
            throw error; // Re-throw for form handling
        }
    };

    return (
        <SiteSettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SiteSettingsContext.Provider>
    );
};


// --- UI Components ---

// Generic Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none p-1">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

// Navigation Bar
const Navbar = () => {
    const { settings, loading: settingsLoading } = useContext(SiteSettingsContext);
    const { isAdmin, logout } = useContext(AuthContext);

    const commonLinkClasses = "px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors";
    const activeLinkClasses = "bg-indigo-600 text-white";
    const inactiveLinkClasses = "text-gray-300 hover:text-white";

    const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');

    useEffect(() => {
        const handleHashChange = () => setCurrentPath(window.location.hash || '#/');
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const getLinkClass = (path) => {
        return currentPath === path || (path === '#/admin' && currentPath.startsWith('#/admin/')) && currentPath !== '#/admin/login'
               ? `${commonLinkClasses} ${activeLinkClasses}` 
               : `${commonLinkClasses} ${inactiveLinkClasses}`;
    };
    
    if (settingsLoading) {
        return (
            <nav className="bg-indigo-800 shadow-lg sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <span className="h-8 w-auto text-white text-xl font-bold animate-pulse">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        );
    }

    return (
        <nav className="bg-indigo-800 shadow-lg sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <a href="#/" className="flex items-center space-x-2">
                                <img className="h-10 w-auto rounded-md bg-white p-0.5" src={settings.logoUrl || "https://placehold.co/100x40/ffffff/000000?text=Logo"} alt="Website Logo" 
                                onError={(e) => e.target.src = 'https://placehold.co/100x40/ffffff/000000?text=Error'}/>
                                <span className="text-white text-xl font-bold">{settings.websiteName}</span>
                            </a>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <a href="#/" className={getLinkClass('#/')}>Home</a>
                            <a href="#/projectors" className={getLinkClass('#/projectors')}>Projectors</a>
                            <a href="#/contact" className={getLinkClass('#/contact')}>Contact Us</a>
                            {isAdmin ? (
                                <>
                                    <a href="#/admin" className={getLinkClass('#/admin')}>Admin</a>
                                    <button onClick={() => { logout(); window.location.hash = '#/admin/login'; }} className={`${commonLinkClasses} ${inactiveLinkClasses}`}>Logout</button>
                                </>
                            ) : (
                                <a href="#/admin/login" className={getLinkClass('#/admin/login')}>Admin Login</a>
                            )}
                        </div>
                    </div>
                    {/* Basic Mobile Menu Toggle - can be expanded */}
                    <div className="-mr-2 flex md:hidden">
                        <button type="button" className="bg-indigo-700 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-indigo-800 focus:ring-white" aria-controls="mobile-menu" aria-expanded="false">
                            <span className="sr-only">Open main menu</span>
                            {/* Icon when menu is closed. Heroicon name: menu */}
                            <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            {/* Icon when menu is open. Heroicon name: x */}
                            <svg className="hidden h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
             {/* Mobile menu, show/hide based on menu state. */}
        </nav>
    );
};

// Footer
const Footer = () => {
    const { settings } = useContext(SiteSettingsContext);
    const authContextVal = useContext(AuthContext); // Get full context
    return (
        <footer className="bg-gray-800 text-white py-8 mt-auto"> {/* Changed mt-12 to mt-auto */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p>&copy; {new Date().getFullYear()} {settings.websiteName}. All rights reserved.</p>
                <p className="mt-1 text-sm">{settings.contactAddress} | {settings.contactPhone} | {settings.contactEmail}</p>
                 {authContextVal.userId && <p className="text-xs mt-2 text-gray-500">Session ID: {authContextVal.userId}</p>}
            </div>
        </footer>
    );
};

// --- Page Components ---

// Home Page
const HomePage = () => {
    const [featuredProjector, setFeaturedProjector] = useState(null);
    const [otherProjectors, setOtherProjectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const authContext = useContext(AuthContext);

    useEffect(() => {
        if (!authContext.userId) {
            // console.log("HomePage: Waiting for userId from AuthContext.");
            setLoading(true);
            return;
        }
        // console.log("HomePage: userId available, fetching projectors:", authContext.userId);
        setLoading(true);
        const projectorsRef = collection(db, getProjectorsCollectionPath());
        const q = query(projectorsRef); // Consider orderBy for consistent fallback

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allProjs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (allProjs.length > 0) {
                let featured = allProjs.find(p => p.isFeatured);
                if (!featured) {
                    featured = allProjs[0]; // Fallback to the first projector
                }
                setFeaturedProjector(featured);
                const others = allProjs.filter(p => p.id !== featured?.id); // Ensure featured might be null
                setOtherProjectors(others);
            } else {
                setFeaturedProjector(null);
                setOtherProjectors([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projectors for HomePage:", error);
            setFeaturedProjector(null);
            setOtherProjectors([]);
            setLoading(false); // Crucial: set loading to false on error
        });
        
        return () => unsubscribe();
    }, [authContext.userId]); // Depend on userId from AuthContext

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading projectors...</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Featured Projector Section */}
            {featuredProjector ? (
                <section className="mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 md:p-8 rounded-lg shadow-xl">
                    <div className="flex flex-col md:flex-row items-center">
                        <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                            <h1 className="text-3xl md:text-4xl font-bold mb-3">{featuredProjector.name}</h1>
                            <p className="text-lg md:text-xl mb-4">{featuredProjector.tagline}</p>
                            <p className="text-gray-200 mb-6 text-sm md:text-base line-clamp-3">{featuredProjector.description}</p>
                            <a href={`#/projector/${featuredProjector.id}`} className="bg-white text-indigo-600 font-semibold py-2 px-5 md:py-3 md:px-6 rounded-lg hover:bg-gray-100 transition-colors text-sm md:text-base">
                                Learn More
                            </a>
                        </div>
                        <div className="md:w-1/2">
                            <img 
                                src={featuredProjector.images && featuredProjector.images[0] ? featuredProjector.images[0] : 'https://placehold.co/600x400/cccccc/333333?text=Featured'} 
                                alt={featuredProjector.name} 
                                className="rounded-lg shadow-lg w-full h-auto object-cover max-h-72 md:max-h-96"
                                onError={(e) => e.target.src = 'https://placehold.co/600x400/cccccc/333333?text=No+Image'}
                            />
                        </div>
                    </div>
                </section>
            ) : (
                 !loading && <p className="text-center text-gray-600 py-10">No featured projector available right now.</p>
            )}

            {/* Other Projectors Section */}
            <section>
                <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8 text-center">Discover Our Projectors</h2>
                {otherProjectors.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {otherProjectors.map(proj => <ProjectorCard key={proj.id} projector={proj} />)}
                    </div>
                ) : (
                    !loading && <p className="text-center text-gray-600">No other projectors available at the moment.</p>
                )}
            </section>
        </div>
    );
};

// Projector Card Component
const ProjectorCard = ({ projector }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
        <img 
            src={projector.images && projector.images[0] ? projector.images[0] : 'https://placehold.co/400x250/cccccc/333333?text=Projector'} 
            alt={projector.name} 
            className="w-full h-48 sm:h-56 object-cover" // Adjusted height
            onError={(e) => e.target.src = 'https://placehold.co/400x250/cccccc/333333?text=Error'}
        />
        <div className="p-4 md:p-6 flex flex-col flex-grow"> {/* Added flex-grow */}
            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">{projector.name}</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-3 line-clamp-2 flex-grow">{projector.tagline || projector.description}</p> {/* Added flex-grow */}
            <p className="text-indigo-600 font-bold text-md md:text-lg mb-4">{projector.price}</p>
            <a href={`#/projector/${projector.id}`} className="block w-full text-center bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors mt-auto text-sm md:text-base"> {/* Added mt-auto */}
                View Details
            </a>
        </div>
    </div>
);

// Projector List Page
const ProjectorListPage = () => {
    const [projectors, setProjectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const authContext = useContext(AuthContext);

    useEffect(() => {
        if (!authContext.userId) {
            setLoading(true);
            return;
        }
        setLoading(true);
        const projectorsRef = collection(db, getProjectorsCollectionPath());
        const q = query(projectorsRef); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjectors(projs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projectors:", error);
            setProjectors([]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authContext.userId]);

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading projectors...</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-10 text-center">Our Projector Collection</h1>
            {projectors.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {projectors.map(proj => <ProjectorCard key={proj.id} projector={proj} />)}
                </div>
            ) : (
                 <p className="text-center text-gray-600 text-xl">No projectors found. Please check back later or contact us!</p>
            )}
        </div>
    );
};

// Projector Detail Page
const ProjectorDetailPage = () => {
    const [projector, setProjector] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState({ type: '', text: '' }); // For modal feedback
    
    const { id } = parseHash(); 
    const authContext = useContext(AuthContext);

    useEffect(() => {
        if (!id) {
            setError("Projector ID not found in URL.");
            setLoading(false);
            return;
        }
        if (!authContext.userId) { // Wait for userId
            // setError("User not authenticated yet."); // Or just keep loading
            setLoading(true);
            return;
        }
        setLoading(true);
        setError(null);
        const projectorRef = doc(db, getProjectorDocPath(id));
        const unsubscribe = onSnapshot(projectorRef, (docSnap) => {
            if (docSnap.exists()) {
                setProjector({ id: docSnap.id, ...docSnap.data() });
            } else {
                setError("Projector not found.");
                setProjector(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching projector details:", err);
            setError("Failed to load projector details.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [id, authContext.userId]);

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading projector details...</div>;
    if (error) return <div className="text-center py-10 text-xl text-red-600 bg-red-50 p-4 rounded-md">{error}</div>;
    if (!projector) return <div className="text-center py-10 text-xl">Projector data is not available.</div>;

    const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % (projector.images?.length || 1));
    const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + (projector.images?.length || 1)) % (projector.images?.length || 1));
    
    const handleInquirySubmit = async (formData) => {
        if (!authContext.userId) {
            setModalMessage({ type: 'error', text: 'Authentication issue. Please try again.' });
            return; // Should not happen if form is shown only when userId is available
        }
        try {
            await addDoc(collection(db, getInquiriesCollectionPath()), { // Uses global currentUserId via helper
                ...formData,
                projectId: projector.id,
                projectName: projector.name,
                type: "purchase",
                status: "new",
                submittedAt: serverTimestamp(),
                userId: authContext.userId 
            });
            setModalMessage({ type: 'success', text: 'Inquiry sent! We will contact you shortly.' });
            // setIsContactModalOpen(false); // Keep modal open to show success message
        } catch (err) {
            console.error("Error submitting inquiry:", err);
            setModalMessage({ type: 'error', text: 'Failed to send inquiry. Please try again.' });
        }
    };

    const openContactModal = () => {
        setModalMessage({ type: '', text: '' }); // Clear previous messages
        setIsContactModalOpen(true);
    };


    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white shadow-xl rounded-lg overflow-hidden">
                <div className="relative">
                    <img 
                        src={projector.images && projector.images.length > 0 ? projector.images[currentImageIndex] : 'https://placehold.co/800x500/cccccc/333333?text=Projector'} 
                        alt={`${projector.name} - Image ${currentImageIndex + 1}`} 
                        className="w-full h-64 sm:h-80 md:h-[500px] object-cover"
                        onError={(e) => e.target.src = 'https://placehold.co/800x500/cccccc/333333?text=Error'}
                    />
                    {projector.images && projector.images.length > 1 && (
                        <>
                            <button onClick={prevImage} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 sm:p-3 rounded-full hover:bg-opacity-75 transition-opacity text-xl sm:text-2xl z-10">‹</button>
                            <button onClick={nextImage} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 sm:p-3 rounded-full hover:bg-opacity-75 transition-opacity text-xl sm:text-2xl z-10">›</button>
                        </>
                    )}
                </div>

                <div className="p-4 md:p-6 lg:p-10">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2 sm:mb-3">{projector.name}</h1>
                    <p className="text-lg sm:text-xl text-gray-600 mb-3 sm:mb-4">{projector.tagline}</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-indigo-600 mb-4 sm:mb-6">{projector.price}</p>
                    
                    <div className="prose prose-sm sm:prose-base max-w-none mb-6 sm:mb-8 text-gray-700">
                        <p>{projector.description}</p>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-3 sm:mb-4">Specifications</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 sm:gap-y-3 mb-6 sm:mb-8 text-sm sm:text-base">
                        {projector.specifications && Object.entries(projector.specifications).map(([key, value]) => (
                            <div key={key} className="border-b border-gray-200 py-1.5 sm:py-2">
                                <span className="font-semibold text-gray-700">{key}:</span> <span className="text-gray-600">{value}</span>
                            </div>
                        ))}
                         {(!projector.specifications || Object.keys(projector.specifications).length === 0) && <p className="text-gray-500">No specifications listed.</p>}
                    </div>

                    <button 
                        onClick={openContactModal}
                        className="w-full sm:w-auto bg-green-600 text-white font-semibold py-2.5 px-6 sm:py-3 sm:px-8 rounded-lg hover:bg-green-700 transition-colors text-base sm:text-lg"
                    >
                        Contact to Buy
                    </button>
                </div>
            </div>
             <Modal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} title={`Inquire about ${projector.name}`}>
                {modalMessage.text && (
                    <p className={`mb-4 text-sm p-3 rounded-md ${modalMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {modalMessage.text}
                    </p>
                )}
                {modalMessage.type !== 'success' && <ContactForm onSubmit={handleInquirySubmit} context="purchase" customSetMessage={setModalMessage} />}
                 {modalMessage.type === 'success' && 
                    <button onClick={() => setIsContactModalOpen(false)} className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors">
                        Close
                    </button>}
            </Modal>
        </div>
    );
};


// Contact Form Component (reusable)
const ContactForm = ({ onSubmit, context = "general", customSetMessage }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Use customSetMessage if provided (for modals), otherwise internal state (not used here currently)
    const setSubmitMessage = customSetMessage || useState({ type: '', text: '' })[1];


    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
            setSubmitMessage({ type: 'error', text: 'Please fill in all required fields (Name, Email, Message).' });
            return;
        }
        // Basic email validation
        if (!/\S+@\S+\.\S+/.test(formData.email)) {
            setSubmitMessage({ type: 'error', text: 'Please enter a valid email address.' });
            return;
        }

        setIsSubmitting(true);
        setSubmitMessage({ type: '', text: '' }); // Clear previous message
        try {
            await onSubmit(formData); // onSubmit should handle setting success/error via customSetMessage
            // If onSubmit doesn't throw, it's a success (or it sets its own message)
            // The parent component (ProjectorDetailPage or ContactPage) now handles the success message.
            if (context !== "purchase") { // For general contact form, reset after success
                 setSubmitMessage({ type: 'success', text: 'Message sent successfully! We will get back to you soon.' });
                 setFormData({ name: '', email: '', phone: '', message: '' }); 
            }
        } catch (error) { // Catch errors if onSubmit re-throws them
            console.error("Form submission error caught in ContactForm:", error);
            setSubmitMessage({ type: 'error', text: error.message || 'Failed to send. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div>
                <label htmlFor={`name-${context}`} className={labelClass}>Full Name</label>
                <input type="text" name="name" id={`name-${context}`} value={formData.name} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label htmlFor={`email-${context}`} className={labelClass}>Email Address</label>
                <input type="email" name="email" id={`email-${context}`} value={formData.email} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label htmlFor={`phone-${context}`} className={labelClass}>Phone Number (Optional)</label>
                <input type="tel" name="phone" id={`phone-${context}`} value={formData.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <label htmlFor={`message-${context}`} className={labelClass}>Message</label>
                <textarea name="message" id={`message-${context}`} rows="4" value={formData.message} onChange={handleChange} className={inputClass} required></textarea>
            </div>
            {/* Submit message is now handled by parent for modals, or by internal state for non-modal (though not fully used here) */}
            <div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-2.5 px-4 md:py-3 md:px-6 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Sending...' : (context === "purchase" ? "Send Inquiry" : "Send Message")}
                </button>
            </div>
        </form>
    );
};


// Contact Page
const ContactPage = () => {
    const { settings } = useContext(SiteSettingsContext);
    const authContext = useContext(AuthContext);
    const [formSubmitMessage, setFormSubmitMessage] = useState({ type: '', text: '' });


    const handleFormSubmit = async (formData) => {
         if (!authContext.userId) {
            setFormSubmitMessage({type: 'error', text: "Authentication error. Please refresh and try again."});
            throw new Error("User not authenticated for inquiry submission.");
        }
        try {
            await addDoc(collection(db, getInquiriesCollectionPath()), { // Uses global currentUserId via helper
                ...formData,
                type: "contact",
                status: "new",
                submittedAt: serverTimestamp(),
                userId: authContext.userId 
            });
            setFormSubmitMessage({type: 'success', text: 'Message sent successfully! We will get back to you soon.'});
            // Form will be reset by ContactForm component if onSubmit doesn't throw
        } catch (error) {
            console.error("Error submitting contact form:", error);
            setFormSubmitMessage({type: 'error', text: 'Failed to send message. Please try again.'});
            throw error; 
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 sm:py-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-8 sm:mb-10 text-center">Get In Touch</h1>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-6">Send us a message</h2>
                    {formSubmitMessage.text && (
                        <p className={`mb-4 text-sm p-3 rounded-md ${formSubmitMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {formSubmitMessage.text}
                        </p>
                    )}
                    { /* Conditionally render form or hide after success if desired */ }
                    {formSubmitMessage.type !== 'success' && <ContactForm onSubmit={handleFormSubmit} context="general" customSetMessage={setFormSubmitMessage}/>}
                </div>
                <div className="bg-gray-50 p-6 sm:p-8 rounded-lg shadow-lg">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-6">Contact Information</h2>
                    <div className="space-y-4 text-gray-600 text-sm sm:text-base">
                        <p>
                            <strong className="text-gray-800 block mb-0.5">Address:</strong>
                            {settings.contactAddress || "Not available"}
                        </p>
                        <p>
                            <strong className="text-gray-800 block mb-0.5">Phone:</strong>
                            <a href={`tel:${settings.contactPhone}`} className="text-indigo-600 hover:underline">
                                {settings.contactPhone || "Not available"}
                            </a>
                        </p>
                        <p>
                            <strong className="text-gray-800 block mb-0.5">Email:</strong>
                            <a href={`mailto:${settings.contactEmail}`} className="text-indigo-600 hover:underline">
                                {settings.contactEmail || "Not available"}
                            </a>
                        </p>
                    </div>
                    <div className="mt-8">
                        <div className="w-full h-56 sm:h-64 bg-gray-300 rounded-md flex items-center justify-center text-gray-500">
                            Map Placeholder
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Admin Components ---

// Admin Login Page
// --- AdminLoginPage (UPDATED) ---
const AdminLoginPage = () => {
    const [email, setEmail] = useState(''); // Changed from username
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, isAdmin, authLoading } = useContext(AuthContext);
    const [isLoggingIn, setIsLoggingIn] = useState(false);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        try {
            await login(email, password); // login now expects email
            // If login is successful, onAuthStateChanged in AuthProvider will update isAdmin
            // and ProtectedAdminRoute will handle redirection.
            // No need to explicitly redirect here, let AuthProvider state update trigger re-render.
            // window.location.hash = '#/admin'; // This can be removed if ProtectedAdminRoute handles it well
        } catch (loginError) {
            if (loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password') {
                setError('Invalid email or password.');
            } else if (loginError.code === 'auth/invalid-email') {
                setError('Please enter a valid email address.');
            }
            else {
                setError('Login failed. Please try again.');
                console.error("Full login error:", loginError);
            }
        } finally {
            setIsLoggingIn(false);
        }
    };
    
    if (authLoading) { return <div className="text-center py-10 text-xl animate-pulse">Authenticating...</div>; }
    
    // If already admin and not loading, redirect (ProtectedAdminRoute also does this, but this can be quicker)
    if (isAdmin && !isLoggingIn) { 
        // setTimeout avoids potential issues with state updates during render
        setTimeout(() => { window.location.hash = '#/admin'; }, 0);
        return <div className="text-center py-10 text-xl">Redirecting to admin...</div>; 
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Admin Login</h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">{error}</p>}
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email-admin" className="sr-only">Email address</label>
                            <input id="email-admin" name="email" type="email" autoComplete="email" required 
                                   className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                                   placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="password-admin" className="sr-only">Password</label>
                            <input id="password-admin" name="password" type="password" autoComplete="current-password" required 
                                   className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                                   placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <button type="submit" disabled={isLoggingIn} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70">
                            {isLoggingIn ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Protected Route for Admin
const ProtectedAdminRoute = ({ children }) => {
    const { isAdmin, authLoading } = useContext(AuthContext);

    if (authLoading) {
        return <div className="text-center py-10 text-xl animate-pulse">Authenticating...</div>;
    }

    if (!isAdmin) {
        // Redirect to login page if not admin
        // Using a timeout can sometimes help with React state updates before navigation
        setTimeout(() => { window.location.hash = '#/admin/login'; }, 0);
        return <div className="text-center py-10 text-xl">Redirecting to login...</div>;
    }
    return children;
};

// Admin Layout (includes sidebar/nav for admin sections)
const AdminLayout = ({ children }) => {
    const [currentAdminPath, setCurrentAdminPath] = useState(window.location.hash || '#/admin');

    useEffect(() => {
        const handleHashChange = () => setCurrentAdminPath(window.location.hash || '#/admin');
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const getAdminLinkClass = (path) => {
        // Make dashboard link active for /admin or /admin/
        if (path === '#/admin' && (currentAdminPath === '#/admin' || currentAdminPath === '#/admin/')) {
            return "bg-indigo-700 text-white";
        }
        return currentAdminPath.startsWith(path) && path !== '#/admin' // For sub-pages like /admin/projectors
               ? "bg-indigo-700 text-white" 
               : "text-gray-300 hover:bg-indigo-600 hover:text-white";
    };

    return (
        <ProtectedAdminRoute>
            <div className="flex flex-col md:flex-row min-h-screen">
                <aside className="w-full md:w-64 bg-indigo-800 text-white p-4 md:p-6 space-y-2 md:space-y-4">
                    <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 text-center md:text-left">Admin Panel</h2>
                    <nav className="space-y-1 md:space-y-2">
                        <a href="#/admin" className={`block py-2 px-3 rounded-md transition-colors text-sm md:text-base ${getAdminLinkClass('#/admin')}`}>Dashboard</a>
                        <a href="#/admin/projectors" className={`block py-2 px-3 rounded-md transition-colors text-sm md:text-base ${getAdminLinkClass('#/admin/projectors')}`}>Manage Projectors</a>
                        <a href="#/admin/inquiries" className={`block py-2 px-3 rounded-md transition-colors text-sm md:text-base ${getAdminLinkClass('#/admin/inquiries')}`}>View Inquiries</a>
                        <a href="#/admin/settings" className={`block py-2 px-3 rounded-md transition-colors text-sm md:text-base ${getAdminLinkClass('#/admin/settings')}`}>Site Settings</a>
                    </nav>
                </aside>
                <main className="flex-1 p-4 md:p-8 bg-gray-100 overflow-y-auto">
                    {children}
                </main>
            </div>
        </ProtectedAdminRoute>
    );
};

// Admin Dashboard
const AdminDashboard = () => {
    // Placeholder for potential dashboard content
    const [projectorCount, setProjectorCount] = useState(0);
    const [inquiryCount, setInquiryCount] = useState(0);
    const authContext = useContext(AuthContext);


    useEffect(() => {
        if (!authContext.userId) return;

        const projectorsUnsub = onSnapshot(collection(db, getProjectorsCollectionPath()), snapshot => {
            setProjectorCount(snapshot.size);
        });
        // Note: getInquiriesCollectionPath uses global currentUserId.
        // For admin, this might mean their own inquiries unless path is adjusted.
        const inquiriesUnsub = onSnapshot(collection(db, getInquiriesCollectionPath()), snapshot => {
            setInquiryCount(snapshot.size);
        });

        return () => {
            projectorsUnsub();
            inquiriesUnsub();
        };
    }, [authContext.userId]);


    return (
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>
            <p className="text-gray-700 mb-8">Welcome to the admin panel. Select an option from the sidebar to manage your website.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Projectors</h2>
                    <p className="text-3xl font-bold text-indigo-600">{projectorCount}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">New Inquiries</h2>
                    <p className="text-3xl font-bold text-green-600">{inquiryCount} <span className="text-sm">(visible to you)</span></p>
                </div>
            </div>
        </div>
    );
};

// Admin Manage Projectors Page
const AdminProjectors = () => {
    const [projectors, setProjectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingProjector, setEditingProjector] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [projectorToDelete, setProjectorToDelete] = useState(null);
    const authContext = useContext(AuthContext);


    useEffect(() => {
        if (!authContext.userId) {
            setLoading(true);
            return;
        }
        setLoading(true);
        const projectorsRef = collection(db, getProjectorsCollectionPath());
        const q = query(projectorsRef); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjectors(projs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projectors for admin:", error);
            setProjectors([]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authContext.userId]);

    const handleAddProjector = () => {
        setEditingProjector(null); 
        setShowFormModal(true);
    };

    const handleEditProjector = (projector) => {
        setEditingProjector(projector);
        setShowFormModal(true);
    };

    const confirmDeleteProjector = (id) => {
        setProjectorToDelete(id);
        setShowConfirmModal(true);
    };
    
    const executeDeleteProjector = async () => {
        if (!projectorToDelete) return;
        try {
            await deleteDoc(doc(db, getProjectorDocPath(projectorToDelete)));
            // Firestore listener will update the list automatically
        } catch (error) {
            console.error("Error deleting projector:", error);
            // alert("Failed to delete projector."); // Replace with modal feedback
        } finally {
            setShowConfirmModal(false);
            setProjectorToDelete(null);
        }
    };


    const handleFormClose = () => {
        setShowFormModal(false);
        setEditingProjector(null);
    };

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading projectors...</div>;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Projectors</h1>
                <button onClick={handleAddProjector} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors text-sm sm:text-base">
                    Add New Projector
                </button>
            </div>

            {showFormModal && (
                <AdminProjectorForm 
                    projector={editingProjector} 
                    onClose={handleFormClose} 
                />
            )}
            
            <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion">
                <p className="text-gray-700 mb-6">Are you sure you want to delete this projector? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowConfirmModal(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md">Cancel</button>
                    <button onClick={executeDeleteProjector} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md">Delete</button>
                </div>
            </Modal>


            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Featured</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {projectors.map(proj => (
                            <tr key={proj.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{proj.name}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{proj.price}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{proj.isFeatured ? 'Yes' : 'No'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button onClick={() => handleEditProjector(proj)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button onClick={() => confirmDeleteProjector(proj.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {projectors.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No projectors found. Add one!</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Admin Projector Form (Add/Edit) - Modal
const AdminProjectorForm = ({ projector, onClose }) => {
    const initialFormData = {
        name: '', tagline: '', description: '', price: '',
        specifications: {}, images: [], isFeatured: false,
    };
    const [formData, setFormData] = useState(initialFormData);
    const [specKey, setSpecKey] = useState('');
    const [specValue, setSpecValue] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formMessage, setFormMessage] = useState({ type: '', text: '' });
    const authContext = useContext(AuthContext);


    useEffect(() => {
        if (projector) {
            setFormData({
                name: projector.name || '', tagline: projector.tagline || '',
                description: projector.description || '', price: projector.price || '',
                specifications: projector.specifications || {}, images: projector.images || [],
                isFeatured: projector.isFeatured || false,
            });
        } else {
            setFormData(initialFormData);
        }
        setFormMessage({ type: '', text: '' }); // Clear message on open/projector change
    }, [projector]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleAddSpec = () => {
        if (specKey.trim() && specValue.trim()) {
            setFormData(prev => ({ ...prev, specifications: { ...prev.specifications, [specKey.trim()]: specValue.trim() } }));
            setSpecKey(''); setSpecValue('');
        } else {
            setFormMessage({type: 'error', text: 'Specification name and value cannot be empty.'});
        }
    };
    const handleRemoveSpec = (keyToRemove) => setFormData(prev => {
        const newSpecs = { ...prev.specifications }; delete newSpecs[keyToRemove];
        return { ...prev, specifications: newSpecs };
    });

    const handleAddImage = () => {
        if (imageUrl.trim() && !formData.images.includes(imageUrl.trim())) {
             try {
                new URL(imageUrl.trim()); // Validate URL format
                setFormData(prev => ({ ...prev, images: [...prev.images, imageUrl.trim()] }));
                setImageUrl('');
                setFormMessage({ type: '', text: '' }); 
            } catch (_) {
                setFormMessage({type: 'error', text: 'Please enter a valid image URL.'});
            }
        } else if (!imageUrl.trim()) {
             setFormMessage({type: 'error', text: 'Image URL cannot be empty.'});
        } else if (formData.images.includes(imageUrl.trim())) {
             setFormMessage({type: 'error', text: 'This image URL has already been added.'});
        }
    };
    const handleRemoveImage = (urlToRemove) => setFormData(prev => ({ ...prev, images: prev.images.filter(url => url !== urlToRemove) }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!authContext.userId) {
            setFormMessage({type: 'error', text: "Authentication error. Cannot save projector."});
            return;
        }
        if (!formData.name.trim()) {
            setFormMessage({type: 'error', text: "Projector name is required."});
            return;
        }
        setIsSubmitting(true);
        setFormMessage({ type: '', text: '' });
        const dataToSave = { 
            ...formData, 
            createdAt: projector?.createdAt || serverTimestamp(), // Preserve original createdAt if editing
            updatedAt: serverTimestamp() 
        };

        try {
            if (projector && projector.id) {
                await updateDoc(doc(db, getProjectorDocPath(projector.id)), dataToSave);
            } else {
                const newId = dataToSave.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now();
                await setDoc(doc(db, getProjectorDocPath(newId)), dataToSave);
            }
            setFormMessage({type: 'success', text: `Projector ${projector ? 'updated' : 'added'} successfully!`});
            setTimeout(onClose, 1500); // Close form after a short delay on success
        } catch (error) {
            console.error("Error saving projector:", error);
            setFormMessage({type: 'error', text: `Failed to save projector: ${error.message}`});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <Modal isOpen={true} onClose={onClose} title={projector ? 'Edit Projector' : 'Add New Projector'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 sm:space-y-5">
                {formMessage.text && (
                    <p className={`text-sm p-3 rounded-md ${formMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {formMessage.text}
                    </p>
                )}
                <div>
                    <label htmlFor="name-projform" className={labelClass}>Name*</label>
                    <input type="text" name="name" id="name-projform" value={formData.name} onChange={handleChange} className={inputClass} required />
                </div>
                <div><label htmlFor="tagline-projform" className={labelClass}>Tagline</label><input type="text" name="tagline" id="tagline-projform" value={formData.tagline} onChange={handleChange} className={inputClass} /></div>
                <div><label htmlFor="description-projform" className={labelClass}>Description</label><textarea name="description" id="description-projform" rows="3" value={formData.description} onChange={handleChange} className={inputClass}></textarea></div>
                <div><label htmlFor="price-projform" className={labelClass}>Price</label><input type="text" name="price" id="price-projform" value={formData.price} onChange={handleChange} className={inputClass} placeholder="e.g., $999"/></div>

                <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-700">Specifications</h3>
                    {Object.entries(formData.specifications).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-xs p-1.5 bg-white rounded border"><span><strong>{key}:</strong> {value}</span><button type="button" onClick={() => handleRemoveSpec(key)} className="text-red-500 hover:text-red-700 ml-2 text-xs font-semibold">Remove</button></div>
                    ))}
                    <div className="flex flex-col sm:flex-row sm:space-x-2 sm:items-end gap-2">
                        <div className="flex-1"><label htmlFor="specKey" className={labelClass}>Spec Name</label><input type="text" id="specKey" value={specKey} onChange={(e) => setSpecKey(e.target.value)} placeholder="Resolution" className={inputClass} /></div>
                        <div className="flex-1"><label htmlFor="specValue" className={labelClass}>Spec Value</label><input type="text" id="specValue" value={specValue} onChange={(e) => setSpecValue(e.target.value)} placeholder="4K UHD" className={inputClass} /></div>
                        <button type="button" onClick={handleAddSpec} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-xs sm:text-sm w-full sm:w-auto">Add Spec</button>
                    </div>
                </div>

                <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-700">Image URLs</h3>
                    {formData.images.map((url, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-1.5 bg-white rounded border"><span className="truncate w-3/4">{url}</span><button type="button" onClick={() => handleRemoveImage(url)} className="text-red-500 hover:text-red-700 ml-2 text-xs font-semibold">Remove</button></div>
                    ))}
                    <div className="flex flex-col sm:flex-row sm:space-x-2 sm:items-end gap-2">
                        <div className="flex-1"><label htmlFor="imageUrl" className={labelClass}>Image URL</label><input type="url" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div>
                        <button type="button" onClick={handleAddImage} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-xs sm:text-sm w-full sm:w-auto">Add Image</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Note: Provide direct URLs to images. For uploads, Firebase Storage would be needed.</p>
                </div>

                <div className="flex items-center pt-2"><input type="checkbox" name="isFeatured" id="isFeatured-projform" checked={formData.isFeatured} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" /><label htmlFor="isFeatured-projform" className="ml-2 block text-sm text-gray-900">Mark as Featured Projector</label></div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 mt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md shadow-sm transition-colors">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50">
                        {isSubmitting ? 'Saving...' : (projector ? 'Update' : 'Add Projector')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


// Admin View Inquiries Page
const AdminInquiries = () => {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [inquiryToDelete, setInquiryToDelete] = useState(null);
    const authContext = useContext(AuthContext);

    useEffect(() => {
        if (!authContext.userId) {
            setLoading(true);
            return;
        }
        setLoading(true);
        // This path means admin sees inquiries associated with their own userId.
        // For a central admin, this path should be different (e.g., a common admin collection).
        const inquiriesRef = collection(db, getInquiriesCollectionPath()); 
        const q = query(inquiriesRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const inqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInquiries(inqs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching inquiries:", error);
            setInquiries([]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authContext.userId]);

    const updateInquiryStatus = async (id, newStatus) => {
        if (!authContext.userId) return;
        const inquiryRef = doc(db, getInquiriesCollectionPath(), id); // Use helper with currentUserId
        try {
            await updateDoc(inquiryRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating inquiry status:", error);
            // alert("Failed to update status."); // Use modal feedback
        }
    };
    
    const confirmDeleteInquiry = (id) => {
        setInquiryToDelete(id);
        setShowConfirmModal(true);
    };

    const executeDeleteInquiry = async () => {
        if (!inquiryToDelete || !authContext.userId) return;
        const inquiryRef = doc(db, getInquiriesCollectionPath(), inquiryToDelete);
        try {
            await deleteDoc(inquiryRef);
        } catch (error) {
            console.error("Error deleting inquiry:", error);
            // alert("Failed to delete inquiry."); // Use modal feedback
        } finally {
            setShowConfirmModal(false);
            setInquiryToDelete(null);
        }
    };


    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading inquiries...</div>;

    return (
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">View Inquiries</h1>
             <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion">
                <p className="text-gray-700 mb-6">Are you sure you want to delete this inquiry?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowConfirmModal(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md">Cancel</button>
                    <button onClick={executeDeleteInquiry} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md">Delete</button>
                </div>
            </Modal>
            {inquiries.length === 0 ? (
                <p className="text-gray-600 bg-white p-6 rounded-lg shadow">No inquiries found (associated with your current user session).</p>
            ) : (
                <div className="space-y-4 md:space-y-6">
                    {inquiries.map(inq => (
                        <div key={inq.id} className="bg-white p-4 md:p-6 rounded-lg shadow-md">
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                                <h2 className="text-lg sm:text-xl font-semibold text-indigo-700">
                                    From: {inq.name} ({inq.email})
                                    {inq.type === 'purchase' && inq.projectName && <span className="block sm:inline sm:ml-2 text-sm text-gray-600">For: {inq.projectName}</span>}
                                </h2>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full self-start sm:self-center ${
                                    inq.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                    inq.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                                    inq.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>{inq.status}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">Phone: {inq.phone || 'N/A'}</p>
                            <p className="text-xs sm:text-sm text-gray-500 mb-3">
                                Submitted: {inq.submittedAt?.toDate ? new Date(inq.submittedAt.toDate()).toLocaleString() : 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">{inq.message}</p>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                                <select 
                                    value={inq.status} 
                                    onChange={(e) => updateInquiryStatus(inq.id, e.target.value)}
                                    className="text-xs sm:text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 flex-grow sm:flex-grow-0"
                                >
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="resolved">Resolved</option>
                                </select>
                                <button onClick={() => confirmDeleteInquiry(inq.id)} className="text-red-500 hover:text-red-700 text-xs sm:text-sm border border-red-300 hover:bg-red-50 p-2 rounded-md transition-colors">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Admin Site Settings Page
const AdminSettings = () => {
    const { settings, updateSettings, loading: settingsLoading } = useContext(SiteSettingsContext);
    const [formData, setFormData] = useState(settings); // Initialize with current settings
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({type: '', text: ''});

    useEffect(() => {
        // Update formData if settings from context change (e.g., after initial load)
        if (settings) {
            setFormData(settings);
        }
    }, [settings]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({type: '', text: ''});
        try {
            await updateSettings(formData);
            setMessage({type: 'success', text: 'Settings updated successfully!'});
        } catch (error) {
            console.error("Error updating site settings:", error);
            setMessage({type: 'error', text: 'Failed to update settings. Please try again.'});
        } finally {
            setIsSubmitting(false);
        }
    };

    if (settingsLoading) return <div className="text-center py-10 text-xl animate-pulse">Loading settings...</div>;
    
    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Site Settings</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-lg shadow-md space-y-6 max-w-2xl">
                {message.text && <p className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message.text}</p>}
                <div>
                    <label htmlFor="websiteName-settings" className={labelClass}>Website Name</label>
                    <input type="text" name="websiteName" id="websiteName-settings" value={formData.websiteName || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="logoUrl-settings" className={labelClass}>Logo URL</label>
                    <input type="url" name="logoUrl" id="logoUrl-settings" value={formData.logoUrl || ''} onChange={handleChange} className={inputClass} placeholder="https://example.com/logo.png"/>
                    {formData.logoUrl && 
                        <img 
                            src={formData.logoUrl} 
                            alt="Logo Preview" 
                            className="mt-2 h-12 sm:h-16 w-auto rounded border p-1 bg-gray-50" 
                            onError={(e) => { e.target.style.display='none'; /* Optionally show a text placeholder */ }}
                        />
                    }
                </div>
                <div><label htmlFor="contactEmail-settings" className={labelClass}>Contact Email</label><input type="email" name="contactEmail" id="contactEmail-settings" value={formData.contactEmail || ''} onChange={handleChange} className={inputClass} /></div>
                <div><label htmlFor="contactPhone-settings" className={labelClass}>Contact Phone</label><input type="tel" name="contactPhone" id="contactPhone-settings" value={formData.contactPhone || ''} onChange={handleChange} className={inputClass} /></div>
                <div><label htmlFor="contactAddress-settings" className={labelClass}>Contact Address</label><textarea name="contactAddress" id="contactAddress-settings" rows="3" value={formData.contactAddress || ''} onChange={handleChange} className={inputClass}></textarea></div>
                <div>
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50">
                        {isSubmitting ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- Router Logic (Simple Hash Router) ---
const parseHash = () => {
    const hash = window.location.hash.substring(1) || '/'; 
    const parts = hash.split('/');
    // Ensure page defaults to 'home' if parts[1] is empty (e.g. for '#/' or just '#')
    const page = parts[1] || 'home'; 
    const id = parts[2]; 
    const subpage = parts[2] || null; 
    return { hash, page, id, subpage };
};

const Router = () => {
    const [route, setRoute] = useState(parseHash());
    const { authLoading } = useContext(AuthContext); // Use authLoading from context

    useEffect(() => {
        const handleHashChange = () => setRoute(parseHash());
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Show a global loading indicator if auth is still processing,
    // as many routes/components depend on auth state.
    if (authLoading && route.page !== 'admin' && route.subpage !== 'login') { 
        // Avoid global load screen for admin login page itself
        // to prevent flash if already logged in and redirecting.
        // A more nuanced loading could be per-page.
        // return <div className="text-center py-20 text-2xl animate-pulse">Initializing Application...</div>;
    }


    // Public Routes
    if (route.page === 'home' || route.hash === '#/' || route.hash === '') return <HomePage />;
    if (route.page === 'projectors' && !route.id) return <ProjectorListPage />;
    if (route.page === 'projector' && route.id) return <ProjectorDetailPage />;
    if (route.page === 'contact') return <ContactPage />;
    
    // Admin Routes
    if (route.page === 'admin') {
        if (route.subpage === 'login') return <AdminLoginPage />;
        
        let adminContent;
        // Ensure default case for /admin or /admin/ goes to dashboard
        const adminRouteKey = route.subpage || 'dashboard'; 
        switch (adminRouteKey) {
            case 'projectors': adminContent = <AdminProjectors />; break;
            case 'inquiries': adminContent = <AdminInquiries />; break;
            case 'settings': adminContent = <AdminSettings />; break;
            case 'dashboard': // Explicitly handle dashboard
            default: adminContent = <AdminDashboard />; 
        }
        return <AdminLayout>{adminContent}</AdminLayout>;
    }

    // Fallback for unknown routes
    // Consider a dedicated 404 component
    return <HomePage />; 
};


// --- Main App Component ---
function App() {
    // import { setLogLevel } from "firebase/app"; // For debugging
    // setLogLevel('debug'); 

    return (
        <AuthProvider>
            <SiteSettingsProvider>
                <div className="flex flex-col min-h-screen font-inter bg-gray-50 text-gray-800 border-2 border-red-500"> {/* <<< ADDED TEST BORDER */}
                    <Navbar />
                    <main className="flex-grow w-full"> {/* Ensure main content can grow */}
                        <Router />
                    </main>
                    <Footer />
                </div>
            </SiteSettingsProvider>
        </AuthProvider>
    );
}

export default App;

