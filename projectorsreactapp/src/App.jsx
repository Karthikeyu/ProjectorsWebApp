import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
    collection, query, getDocs, onSnapshot, serverTimestamp, where, writeBatch, arrayUnion, arrayRemove
} from 'firebase/firestore';
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';

// --- Firebase Configuration (User's Original) ---
const firebaseConfig = {
  apiKey: "AIzaSyCK2RuCvrlEJxD38pPDyk09q4Z30IH0JWY",
  authDomain: "projectorswebapp.firebaseapp.com",
  projectId: "projectorswebapp",
  storageBucket: "projectorswebapp.appspot.com",
  messagingSenderId: "93395619894",
  appId: "1:93395619894:web:dea6c45afe0fed9e104897",
  measurementId: "G-P5D2N3RQGX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// Using a dynamic appId for collections to keep data separate in this environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-projector-app';

let currentUserId = null;

// --- Contexts ---
const AuthContext = createContext();
const SiteSettingsContext = createContext();
const CategoriesContext = createContext();

// --- Default Assets & Sample Data ---
const defaultLogoSvgDataUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='50' viewBox='0 0 150 50'><rect width='100%' height='100%' fill='%234F46E5' /><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='22' font-family='Arial, sans-serif' font-weight='bold'>Projex</text></svg>";

const sampleCategories = [
    { id: "Projectors", specKeys: ["Resolution", "Brightness", "Contrast Ratio", "Lamp Life", "Connectivity"] },
    { id: "Projector Screens", specKeys: ["Size", "Aspect Ratio", "Gain", "Material"] }
];

const sampleProducts = [
    {
        id: "cinemabeam-x10", name: "CinemaBeam X10", category: "Projectors", tagline: "Ultimate 4K Home Theater Experience",
        description: "Experience breathtaking 4K clarity and vibrant colors with the CinemaBeam X10. Perfect for movie nights and immersive gaming sessions. Features advanced HDR support and ultra-quiet operation.",
        specifications: { "Resolution": "4K UHD (3840 x 2160)", "Brightness": "3000 ANSI Lumens", "Contrast Ratio": "100,000:1 (Dynamic)", "Lamp Life": "Up to 20,000 hours", "Connectivity": "HDMI 2.0 (x2), USB-A" },
        price: "$1299", images: [ "https://placehold.co/800x500/333/fff?text=CinemaBeam+X10+Main" ], isFeatured: true,
    },
    {
        id: "portaview-p5", name: "PortaView P5", category: "Projectors", tagline: "Compact & Bright for On-the-Go",
        description: "The PortaView P5 is your ideal companion for business travel and impromptu movie nights. Lightweight, powerful, and with a built-in battery, it delivers sharp Full HD images anywhere.",
        specifications: { "Resolution": "Full HD (1920 x 1080)", "Brightness": "2000 ANSI Lumens", "Battery Life": "Up to 3 hours", "Weight": "1.5 kg" },
        price: "$499", images: [ "https://placehold.co/800x500/666/fff?text=PortaView+P5+Main" ], isFeatured: false,
    },
    {
        id: "gamerpro-g7", name: "GamerPro G7", category: "Projectors", tagline: "Low Latency Gaming Projector",
        description: "Dominate the game with the GamerPro G7. Featuring an ultra-low input lag and a high refresh rate, this projector ensures smooth, responsive gameplay on a massive screen.",
        specifications: { "Resolution": "1080p @ 120Hz", "Brightness": "2500 Lumens", "Connectivity": "HDMI 2.1" },
        price: "$799", images: [ "https://placehold.co/800x500/888/fff?text=GamerPro+G7+Main" ], isFeatured: false,
    },
    {
        id: "pro-matte-screen-120", name: "ProMatte Screen 120\"", category: "Projector Screens", tagline: "Wrinkle-Free, High-Contrast Viewing",
        description: "Achieve the perfect picture with our 120-inch ProMatte projection screen. The high-contrast material enhances color and clarity, while the tensioned frame ensures a perfectly flat, wrinkle-free surface.",
        specifications: { "Size": "120-inch Diagonal", "Aspect Ratio": "16:9", "Material": "Matte White PVC", "Gain": "1.1" },
        price: "$249", images: [ "https://placehold.co/800x500/ccc/333?text=ProMatte+Screen" ], isFeatured: false,
    },
];

// --- Helper Functions ---
const getProductsCollectionPath = () => `artifacts/${appId}/public/data/products`;
const getProductDocPath = (id) => `artifacts/${appId}/public/data/products/${id}`;
const getCategoriesCollectionPath = () => `artifacts/${appId}/public/data/categories`;
const getCategoryDocPath = (id) => `artifacts/${appId}/public/data/categories/${id}`;
const getGlobalInquiriesCollectionPath = () => `artifacts/${appId}/public/data/inquiries`;
const getGlobalInquiryDocPath = (id) => `artifacts/${appId}/public/data/inquiries/${id}`;


// --- Data Initialization ---
const initializeSampleData = async (isAdminUser) => {
    if (!currentUserId || !isAdminUser) { return; }
    const productsCollectionRef = collection(db, getProductsCollectionPath());
    const categoriesCollectionRef = collection(db, getCategoriesCollectionPath());

    try {
        const catSnapshot = await getDocs(query(categoriesCollectionRef));
        if (catSnapshot.empty) {
            const batch = writeBatch(db);
            sampleCategories.forEach(cat => {
                const catRef = doc(db, getCategoryDocPath(cat.id));
                batch.set(catRef, { name: cat.id, specKeys: cat.specKeys, createdAt: serverTimestamp() });
            });
            await batch.commit();
        }
        
        const prodSnapshot = await getDocs(query(productsCollectionRef));
        if (prodSnapshot.empty) {
            let featuredFound = false;
            const batch = writeBatch(db);
            for (const prod of sampleProducts) {
                const prodData = { ...prod, createdAt: serverTimestamp() };
                if (prodData.isFeatured) {
                    if (featuredFound) { prodData.isFeatured = false; } else { featuredFound = true; }
                }
                const prodRef = doc(db, getProductDocPath(prod.id));
                batch.set(prodRef, prodData);
            }
            await batch.commit();
        }
    } catch (error) {
        console.error(`Error initializing sample data. Check Firestore rules.`, error);
    }
};

// --- Context Providers ---
const AuthProvider = ({ children }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [authReadyUserId, setAuthReadyUserId] = useState(null);
    const ADMIN_USER_UID = "lYDbdoogC6WWLEV7rVS86MBdW353";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setAuthLoading(true);
            setFirebaseUser(user);
            let uId;
            let currentIsAdmin = false;
            if (user) {
                uId = user.uid;
                if (user.uid === ADMIN_USER_UID) {
                    currentIsAdmin = true; localStorage.setItem('isAdminLoggedIn', 'true');
                } else {
                    currentIsAdmin = false; localStorage.removeItem('isAdminLoggedIn');
                }
            } else {
                try {
                    const anonUserCredential = await signInAnonymously(auth); uId = anonUserCredential.user.uid;
                } catch (error) { uId = crypto.randomUUID(); }
                currentIsAdmin = false; localStorage.removeItem('isAdminLoggedIn');
            }
            setIsAdmin(currentIsAdmin); currentUserId = uId; setAuthReadyUserId(uId);
            if (uId && currentIsAdmin) { await initializeSampleData(currentIsAdmin); }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async (email, password) => { try { await signInWithEmailAndPassword(auth, email, password); return true; } catch (error) { throw error; } };
    const logout = async () => { try { await signOut(auth); } catch (error) { console.error(error); } setIsAdmin(false); localStorage.removeItem('isAdminLoggedIn'); };

    return (<AuthContext.Provider value={{ isAdmin, login, logout, authLoading, firebaseUser, userId: authReadyUserId }}>{children}</AuthContext.Provider>);
};

const SiteSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({ websiteName: "Projector Hub", logoUrl: defaultLogoSvgDataUrl, contactEmail: "info@projectorhub.com", contactPhone: "1-800-555-PROJECT", contactAddress: "123 Tech Avenue, Innovation City, TX 75001" });
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useContext(AuthContext);

    useEffect(() => {
        setLoading(true);
        const settingsPath = `artifacts/${appId}/public/data/siteSettings/config`;
        const settingsRef = doc(db, settingsPath);
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data(); setSettings({ ...data, logoUrl: data.logoUrl || defaultLogoSvgDataUrl });
            } else if (isAdmin) {
                const defaultSettingsData = { websiteName: "Projector Hub", logoUrl: defaultLogoSvgDataUrl, contactEmail: "info@projectorhub.com", contactPhone: "1-800-555-PROJECT", contactAddress: "123 Tech Avenue, Innovation City, TX 75001", createdAt: serverTimestamp() };
                setDoc(settingsRef, defaultSettingsData).then(() => setSettings(defaultSettingsData)).catch(err => console.error(err));
            }
            setLoading(false);
        }, (error) => { console.error(error); setLoading(false); });
        return () => unsubscribe();
    }, [isAdmin]);

    const updateSettings = async (newSettings) => {
        const settingsRef = doc(db, `artifacts/${appId}/public/data/siteSettings/config`);
        try { await setDoc(settingsRef, { ...newSettings, updatedAt: serverTimestamp() }, { merge: true }); setSettings(p => ({ ...p, ...newSettings })); }
        catch (error) { throw error; }
    };

    return (<SiteSettingsContext.Provider value={{ settings, updateSettings, loading }}>{children}</SiteSettingsContext.Provider>);
};

const CategoriesProvider = ({ children }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const categoriesRef = collection(db, getCategoriesCollectionPath());
        const unsubscribe = onSnapshot(query(categoriesRef), (snapshot) => {
            const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(fetchedCategories.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching categories:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (<CategoriesContext.Provider value={{ categories, loading }}>{children}</CategoriesContext.Provider>);
};

// --- UI Components ---
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

const Navbar = () => { 
    const { settings } = useContext(SiteSettingsContext);
    const { isAdmin, logout } = useContext(AuthContext);
    const { categories, loading: categoriesLoading } = useContext(CategoriesContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');
    useEffect(() => { const h = () => setCurrentPath(window.location.hash || '#/'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const handleMobileLinkClick = () => setIsMobileMenuOpen(false);

    const renderProductsLink = () => {
        if (categoriesLoading) {
            return <span className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 animate-pulse">Products...</span>;
        }
        if (categories.length === 1) {
            const categoryPath = `#/products/${encodeURIComponent(categories[0].id)}`;
            return <a href={categoryPath} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath.startsWith('#/products/') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>{categories[0].name}</a>;
        }
        if (categories.length > 1) {
            return (
                <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(prev => !prev)} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center ${currentPath.startsWith('#/products/') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>
                        <span>Products</span>
                        <svg className={`w-4 h-4 ml-1 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                                {categories.map(category => (
                                    <a key={category.id} href={`#/products/${encodeURIComponent(category.id)}`} onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{category.name}</a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <nav className="bg-indigo-800 shadow-lg sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <a href="#/" className="flex items-center space-x-2 flex-shrink-0">
                        <img className="h-10 w-auto rounded-md bg-white p-0.5" src={settings.logoUrl || defaultLogoSvgDataUrl} alt="Website Logo"/>
                        <span className="text-white text-xl font-bold">{settings.websiteName}</span>
                    </a>
                    <div className="hidden md:flex items-baseline space-x-4">
                        <a href="#/" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath === '#/' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>Home</a>
                        {renderProductsLink()}
                        <a href="#/contact" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath === '#/contact' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>Contact Us</a>
                        {isAdmin ? (
                            <>
                                <a href="#/admin" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath.startsWith('#/admin/') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>Admin</a>
                                <button onClick={() => logout()} className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-indigo-700">Logout</button>
                            </>
                        ) : (
                            <a href="#/admin/login" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath === '#/admin/login' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-700'}`}>Admin Login</a>
                        )}
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-indigo-700">
                            <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                            <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <a href="#/" onClick={handleMobileLinkClick} className="text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">Home</a>
                        {categories.map(category => (<a key={category.id} href={`#/products/${encodeURIComponent(category.id)}`} onClick={handleMobileLinkClick} className="text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">{category.name}</a>))}
                        <a href="#/contact" onClick={handleMobileLinkClick} className="text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">Contact Us</a>
                        {isAdmin ? <a href="#/admin" onClick={handleMobileLinkClick} className="text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">Admin</a> : <a href="#/admin/login" onClick={handleMobileLinkClick} className="text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">Admin Login</a>}
                        {isAdmin && <button onClick={() => { logout(); handleMobileLinkClick(); }} className="w-full text-left text-gray-300 hover:bg-indigo-700 block px-3 py-2 rounded-md">Logout</button>}
                    </div>
                </div>
            )}
        </nav>
    );
};

const Footer = () => {
    const { settings } = useContext(SiteSettingsContext);
    const authContextVal = useContext(AuthContext);
    return (<footer className="bg-gray-800 text-white py-8 mt-auto"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"><p>&copy; {new Date().getFullYear()} {settings.websiteName}. All rights reserved.</p><p className="mt-1 text-sm">{settings.contactAddress} | {settings.contactPhone} | {settings.contactEmail}</p>{authContextVal.userId && <p className="text-xs mt-2 text-gray-500">Session ID: {authContextVal.userId}</p>}</div></footer>);
};

const HomePage = () => {
    const [featuredProduct, setFeaturedProduct] = useState(null);
    const [productsByCategory, setProductsByCategory] = useState({});
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setLoading(true);
        const productsRef = collection(db, getProductsCollectionPath());
        const unsubscribe = onSnapshot(query(productsRef), (snapshot) => {
            const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const featured = allProducts.find(p => p.isFeatured) || allProducts[0] || null;
            setFeaturedProduct(featured);

            const grouped = allProducts.reduce((acc, product) => {
                const category = product.category || 'Uncategorized';
                if (!acc[category]) { acc[category] = []; }
                acc[category].push(product);
                return acc;
            }, {});

            setProductsByCategory(grouped);
            
            setLoading(false);
        }, (error) => {
            console.error("Home page products error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading products...</div>;
    
    return (
        <div className="container mx-auto px-4 py-8">
            {featuredProduct && (<section className="mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 md:p-8 rounded-lg shadow-xl"><div className="flex flex-col md:flex-row items-center"><div className="md:w-1/2 mb-6 md:mb-0 md:pr-8"><h1 className="text-3xl md:text-4xl font-bold mb-3">{featuredProduct.name}</h1><p className="text-lg md:text-xl mb-4">{featuredProduct.tagline}</p><p className="text-gray-200 mb-6 text-sm md:text-base line-clamp-3">{featuredProduct.description}</p><a href={`#/product/${featuredProduct.id}`} className="bg-white text-indigo-600 font-semibold py-2 px-5 md:py-3 md:px-6 rounded-lg hover:bg-gray-100 transition-colors text-sm md:text-base">Learn More</a></div><div className="md:w-1/2"><img src={featuredProduct.images?.[0]} alt={featuredProduct.name} className="rounded-lg shadow-lg w-full h-auto object-cover max-h-72 md:max-h-96"/></div></div></section>)}

            <div className="space-y-16">
                {Object.entries(productsByCategory).map(([category, products]) => {
                    const productsToShow = products.filter(p => p.id !== featuredProduct?.id);
                    if (productsToShow.length === 0) return null;
                    
                    return (
                        <section key={category}>
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">{category}</h2>
                                <a href={`#/products/${encodeURIComponent(category)}`} className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                                    View All
                                    <span aria-hidden="true"> &rarr;</span>
                                </a>
                            </div>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                {productsToShow.slice(0, 3).map(prod => <ProductCard key={prod.id} product={prod} />)}
                            </div>
                        </section>
                    )
                })}
            </div>
        </div>
    );
};

const ProductCard = ({ product }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
        <img src={product.images?.[0]} alt={product.name} className="w-full h-48 sm:h-56 object-cover" />
        <div className="p-4 md:p-6 flex flex-col flex-grow">
            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">{product.name}</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-3 line-clamp-2 flex-grow">{product.tagline}</p>
            <p className="text-indigo-600 font-bold text-md md:text-lg mb-4">{product.price}</p>
            <a href={`#/product/${product.id}`} className="block w-full text-center bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 mt-auto">View Details</a>
        </div>
    </div>
);

const CategoryPage = () => {
    const { categoryName } = parseHash();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const decodedCategoryName = decodeURIComponent(categoryName);
        const productsRef = collection(db, getProductsCollectionPath());
        const q = query(productsRef, where("category", "==", decodedCategoryName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(prods);
            setLoading(false);
        }, (error) => { console.error(error); setLoading(false); });
        return () => unsubscribe();
    }, [categoryName]);

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading {decodeURIComponent(categoryName)}...</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-10 text-center">{decodeURIComponent(categoryName)}</h1>
            {products.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                    {products.map(prod => <ProductCard key={prod.id} product={prod} />)}
                </div>
            ) : (
                <p className="text-center text-gray-600 text-xl">No products found in this category.</p>
            )}
        </div>
    );
};

const SpecIcon = ({ iconName, className }) => {
    const icons = {
        resolution: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" /></svg>,
        brightness: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>,
        default: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };
    const iconKey = iconName.toLowerCase().replace(/\s+/g, '');
    return icons[iconKey] || icons.default;
};
const ProductDetailPage = () => {
    const [product, setProduct] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [currentImageIndex, setCurrentImageIndex] = useState(0); const [isContactModalOpen, setIsContactModalOpen] = useState(false); const [modalMessage, setModalMessage] = useState({ type: '', text: '' }); const { id } = parseHash(); const authContext = useContext(AuthContext);
    useEffect(() => { if (!id) { setError("ID not found."); setLoading(false); return; } setLoading(true); setError(null); setCurrentImageIndex(0); const unsub = onSnapshot(doc(db, getProductDocPath(id)), (s) => { if (s.exists()) { setProduct({ id: s.id, ...s.data() }); } else { setError("Not found."); setProduct(null); } setLoading(false); }, (e) => { console.error("Detail error:", e); setError("Load failed."); setLoading(false); }); return () => unsub(); }, [id]);
    if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="text-xl text-gray-500 animate-pulse">Loading product details...</div></div>; if (error) return <div className="text-center py-10 text-xl text-red-600 bg-red-50 p-4 rounded-md">{error}</div>; if (!product) return <div className="text-center py-10 text-xl">Product data not available.</div>;
    const images = product.images || []; const nextImg = () => setCurrentImageIndex((p) => (p + 1) % (images.length || 1)); const prevImg = () => setCurrentImageIndex((p) => (p - 1 + (images.length || 1)) % (images.length || 1));
    const submitInquiry = async (d) => { if (!authContext.userId) { setModalMessage({ type: 'error', text: 'Auth issue.' }); return; } try { await addDoc(collection(db, getGlobalInquiriesCollectionPath()), { ...d, productId: product.id, productName: product.name, type: "purchase", status: "new", submittedAt: serverTimestamp(), userId: authContext.userId }); setModalMessage({ type: 'success', text: 'Your inquiry has been sent successfully!' }); } catch (e) { console.error("Inquiry error:", e); setModalMessage({ type: 'error', text: 'Failed to send inquiry. Please try again later.' }); } }; const openModal = () => { setModalMessage({ type: '', text: '' }); setIsContactModalOpen(true); };
    const specifications = product.specifications ? Object.entries(product.specifications) : [];
    return (<div className="bg-gray-50 min-h-screen py-8 md:py-12"><div className="container mx-auto px-4"><div className="bg-white shadow-2xl rounded-xl overflow-hidden"><div className="md:flex"><div className="md:w-1/2 bg-gray-100 p-4 sm:p-6"><div className="relative aspect-w-16 aspect-h-9 md:aspect-h-10 rounded-lg overflow-hidden shadow-lg"><img src={images.length > 0 ? images[currentImageIndex] : 'https://placehold.co/800x500/cccccc/333333?text=Product'} alt={`${product.name} ${currentImageIndex + 1}`} className="w-full h-full object-contain transition-opacity duration-300 ease-in-out" onError={(e) => e.target.src = 'https://placehold.co/800x500/cccccc/333333?text=Image+Error'} />{images.length > 1 && (<><button onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-all z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button><button onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-all z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button></>)}</div>{images.length > 1 && (<div className="flex justify-center space-x-2 mt-4 overflow-x-auto pb-2">{images.map((u, i) => (<img key={i} src={u} alt={`Thumb ${i + 1}`} className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 flex-shrink-0 transition-all duration-150 ease-in-out hover:opacity-100 ${currentImageIndex === i ? 'border-indigo-500 shadow-md scale-105' : 'border-transparent opacity-60'}`} onClick={() => setCurrentImageIndex(i)} onError={(e) => e.target.src = 'https://placehold.co/64x64/cccccc/333333?text=Err'} />))}</div>)}</div><div className="md:w-1/2 p-6 md:p-8 lg:p-10 flex flex-col justify-between"><div><h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-2 leading-tight">{product.name}</h1><p className="text-lg sm:text-xl text-indigo-600 font-semibold mb-4">{product.tagline}</p><p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6 line-clamp-5 md:line-clamp-none">{product.description}</p></div><div className="mt-auto"><p className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">{product.price}</p><button onClick={openModal} className="w-full bg-green-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-700 transition-transform duration-150 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-lg shadow-md">Contact to Buy</button></div></div></div>{specifications.length > 0 && (<div className="border-t border-gray-200 px-6 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12"><h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-8 text-center">Key Specifications</h2><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">{specifications.map(([key, value]) => (<div key={key} className="bg-gray-50 p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out flex items-start space-x-4"><div className="flex-shrink-0 mt-1"><SpecIcon iconName={key} className="w-7 h-7 text-indigo-500" /></div><div><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{key}</h3><p className="text-md font-medium text-gray-800 mt-0.5">{String(value)}</p></div></div>))}</div></div>)}</div><Modal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} title={`Inquire about ${product.name}`}>{modalMessage.text && (<p className={`mb-4 text-sm p-3 rounded-md ${modalMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{modalMessage.text}</p>)}{modalMessage.type !== 'success' && <ContactForm onSubmit={submitInquiry} context="purchase" customSetMessage={(m) => setModalMessage({ type: m.type, text: m.text })} />}{modalMessage.type === 'success' && <button onClick={() => setIsContactModalOpen(false)} className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">Close</button>}</Modal></div></div>);
};
const ContactForm = ({ onSubmit, context = "general", customSetMessage }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' }); const [isSubmitting, setIsSubmitting] = useState(false); const setMsg = customSetMessage || useState({ type: '', text: '' })[1];
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e) => { e.preventDefault(); if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) { setMsg({ type: 'error', text: 'Required fields missing.' }); return; } if (!/\S+@\S+\.\S+/.test(formData.email)) { setMsg({ type: 'error', text: 'Valid email needed.' }); return; } setIsSubmitting(true); setMsg({ type: '', text: '' }); try { await onSubmit(formData); if (context !== "purchase") { setMsg({ type: 'success', text: 'Sent!' }); setFormData({ name: '', email: '', phone: '', message: '' }); } } catch (e) { setMsg({ type: 'error', text: e.message || 'Failed.' }); } finally { setIsSubmitting(false); } };
    const input = "w-full px-3 py-2 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"; const label = "block text-sm font-medium mb-1";
    return (<form onSubmit={handleSubmit} className="space-y-6"><div><label htmlFor={`n-${context}`} className={label}>{`Name`}</label><input type="text" name="name" id={`n-${context}`} value={formData.name} onChange={handleChange} className={input} required /></div><div><label htmlFor={`e-${context}`} className={label}>Email</label><input type="email" name="email" id={`e-${context}`} value={formData.email} onChange={handleChange} className={input} required /></div><div><label htmlFor={`p-${context}`} className={label}>Phone (Opt.)</label><input type="tel" name="phone" id={`p-${context}`} value={formData.phone} onChange={handleChange} className={input} /></div><div><label htmlFor={`m-${context}`} className={label}>Message</label><textarea name="message" id={`m-${context}`} rows="4" value={formData.message} onChange={handleChange} className={input} required></textarea></div><div><button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50">{isSubmitting ? 'Sending...' : 'Send'}</button></div></form>);
};

const ContactPage = () => {
    const { settings } = useContext(SiteSettingsContext); const authContext = useContext(AuthContext); const [msg, setMsg] = useState({ t: '', x: '' });
    const submit = async (d) => { if (!authContext.userId) { setMsg({ t: 'error', x: "Auth error." }); throw new Error("No auth."); } try { await addDoc(collection(db, getGlobalInquiriesCollectionPath()), { ...d, type: "contact", status: "new", submittedAt: serverTimestamp(), userId: authContext.userId }); setMsg({ t: 'success', x: 'Sent!' }); } catch (e) { setMsg({ t: 'error', x: 'Failed.' }); throw e; } };
    return (<div className="container mx-auto px-4 py-12"><h1 className="text-4xl font-bold mb-10 text-center">Get In Touch</h1><div className="grid md:grid-cols-2 gap-12"><div className="bg-white p-8 rounded shadow-lg"><h2 className="text-2xl font-semibold mb-6">Send a message</h2>{msg.x && (<p className={`mb-4 p-3 rounded ${msg.t === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>{msg.x}</p>)}{msg.t !== 'success' && <ContactForm onSubmit={submit} customSetMessage={(m) => setMsg({ t: m.type, x: m.text })} />}</div><div className="bg-gray-50 p-8 rounded shadow-lg"><h2 className="text-2xl font-semibold mb-6">Contact Info</h2><div className="space-y-4"><p><strong>Address:</strong><br />{settings.contactAddress || "N/A"}</p><p><strong>Phone:</strong><br /><a href={`tel:${settings.contactPhone}`} className="text-indigo-600">{settings.contactPhone || "N/A"}</a></p><p><strong>Email:</strong><br /><a href={`mailto:${settings.contactEmail}`} className="text-indigo-600">{settings.contactEmail || "N/A"}</a></p></div><div className="mt-8 w-full h-64 bg-gray-300 rounded flex items-center justify-center">Map</div></div></div></div>);
};
const AdminLoginPage = () => {
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const { login, isAdmin, authLoading } = useContext(AuthContext); const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    useEffect(() => {
        if (!authLoading && isAdmin) {
            window.location.hash = '#/admin';
        }
    }, [isAdmin, authLoading]);
    
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); setIsLoggingIn(true); try { await login(email, password); } catch (loginError) { if (loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-email') { setError('Invalid email or password.'); } else { setError('Login failed. Please try again.'); console.error("Full login error:", loginError); } } finally { setIsLoggingIn(false); } };
    if (authLoading && !isAdmin) { return <div className="text-center py-10 text-xl animate-pulse">Initializing session...</div>; }
    if (isAdmin && !isLoggingIn) { setTimeout(() => { window.location.hash = '#/admin'; }, 0); return <div className="text-center py-10 text-xl">Redirecting to admin...</div>; }
    
    return (<div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8"><div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl"><div><h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Admin Login</h2></div><form className="mt-8 space-y-6" onSubmit={handleSubmit}>{error && <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">{error}</p>}<div className="rounded-md shadow-sm -space-y-px"><div><label htmlFor="email-admin" className="sr-only">Email address</label><input id="email-admin" name="email" type="email" autoComplete="email" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} /></div><div><label htmlFor="password-admin" className="sr-only">Password</label><input id="password-admin" name="password" type="password" autoComplete="current-password" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /></div></div><div><button type="submit" disabled={isLoggingIn} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70">{isLoggingIn ? 'Signing in...' : 'Sign in'}</button></div></form></div></div>);
};
const ProtectedAdminRoute = ({ children }) => { 
    const { isAdmin, authLoading } = useContext(AuthContext);
    if (authLoading && !isAdmin) return <div className="text-center py-10 text-xl animate-pulse">Initializing session...</div>; 
    if (!authLoading && !isAdmin) { setTimeout(() => { window.location.hash = '#/admin/login'; }, 0); return <div className="text-center py-10 text-xl">Redirecting to login...</div>; }
    if (authLoading && isAdmin) return <div className="text-center py-10 text-xl animate-pulse">Loading Admin Area...</div>; 
    return children; 
};
const AdminLayout = ({ children }) => {
    const [path, setPath] = useState(window.location.hash || '#/admin'); useEffect(() => { const h = () => setPath(window.location.hash || '#/admin'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
    const linkClass = (p) => ((p === '#/admin' && (path === '#/admin' || path === '#/admin/')) || (path.startsWith(p) && p !== '#/admin') ? "bg-indigo-700 text-white" : "text-gray-300 hover:bg-indigo-600");
    return (<ProtectedAdminRoute><div className="flex flex-col md:flex-row min-h-screen"><aside className="w-full md:w-64 bg-indigo-800 text-white p-6"><h2 className="text-2xl font-semibold mb-6">Admin Panel</h2><nav className="space-y-2"><a href="#/admin" className={`block py-2 px-3 rounded ${linkClass('#/admin')}`}>Dashboard</a><a href="#/admin/products" className={`block py-2 px-3 rounded ${linkClass('#/admin/products')}`}>Products</a><a href="#/admin/inquiries" className={`block py-2 px-3 rounded ${linkClass('#/admin/inquiries')}`}>Inquiries</a><a href="#/admin/settings" className={`block py-2 px-3 rounded ${linkClass('#/admin/settings')}`}>Settings</a></nav></aside><main className="flex-1 p-8 bg-gray-100">{children}</main></div></ProtectedAdminRoute>);
};
const AdminDashboard = () => {
    const [pc, setPc] = useState(0); const [ic, setIc] = useState(0);
    useEffect(() => {
        const pU = onSnapshot(collection(db, getProductsCollectionPath()), s => setPc(s.size)); 
        const iU = onSnapshot(collection(db, getGlobalInquiriesCollectionPath()), s => setIc(s.size)); 
        return () => { pU(); iU(); }; 
    }, []);
    return (<div><h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1><p className="mb-8">Welcome!</p><div className="grid md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded shadow"><h2 className="text-xl mb-2">Total Products</h2><p className="text-3xl font-bold">{pc}</p></div><div className="bg-white p-6 rounded shadow"><h2 className="text-xl mb-2">Total Inquiries</h2><p className="text-3xl font-bold">{ic}</p></div></div></div>);
};

const AdminProducts = () => {
    const [products, setProducts] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [showFormModal, setShowFormModal] = useState(false); 
    const [editingProduct, setEditingProduct] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    
    useEffect(() => {
        const productsRef = collection(db, getProductsCollectionPath());
        const unsub = onSnapshot(query(productsRef), s => { setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, e => { console.error(e); setLoading(false); });
        return () => unsub();
    }, []);

    const handleAddProduct = () => { setEditingProduct(null); setShowFormModal(true); };
    const handleEditProduct = (prod) => { setEditingProduct(prod); setShowFormModal(true); };
    const confirmDeleteProduct = (id) => { setProductToDelete(id); setShowConfirmModal(true); };

    const executeDeleteProduct = async () => {
        if (!productToDelete) return;
        try { await deleteDoc(doc(db, getProductDocPath(productToDelete))); }
        catch(e) { console.error(e); }
        finally { setShowConfirmModal(false); setProductToDelete(null); }
    };

    if (loading) return <div className="text-center py-10 text-xl animate-pulse">Loading products...</div>;

    return (
        <div className="space-y-6">
            <AdminCategories /> 
            
            <div className="flex justify-between items-center mt-8">
                <h1 className="text-3xl font-bold text-gray-800">Manage Products</h1>
                <button onClick={handleAddProduct} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md">Add New Product</button>
            </div>

            {showFormModal && <AdminProductForm product={editingProduct} onClose={() => setShowFormModal(false)} />}
            {showConfirmModal && <Modal isOpen={true} onClose={() => setShowConfirmModal(false)} title="Confirm Deletion"><p>Are you sure?</p><div className="flex justify-end space-x-2 mt-4"><button onClick={() => setShowConfirmModal(false)}>Cancel</button><button onClick={executeDeleteProduct}>Delete</button></div></Modal>}

            <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.map(prod => (
                            <tr key={prod.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{prod.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prod.category || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prod.price}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-3">
                                        <button onClick={() => handleEditProduct(prod)} title="Edit Product" className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <button onClick={() => confirmDeleteProduct(prod.id)} title="Delete Product" className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                               <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminProductForm = ({ product, onClose }) => {
    const { categories } = useContext(CategoriesContext);
    const initialFormData = { name: '', category: '', tagline: '', description: '', price: '', specifications: {}, images: [], isFeatured: false };
    const [formData, setFormData] = useState(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentCategory = categories.find(c => c.name === formData.category);
    const specKeysForCategory = currentCategory?.specKeys || [];

    useEffect(() => {
        if (product) {
            setFormData({ ...initialFormData, ...product });
        } else {
            setFormData({ ...initialFormData, category: categories[0]?.name || '' });
        }
    }, [product, categories]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleCategoryChange = (e) => {
        const newCategoryName = e.target.value;
        const newCategory = categories.find(c => c.name === newCategoryName);
        const newSpecKeys = newCategory?.specKeys || [];
        const newSpecifications = {};
        newSpecKeys.forEach(key => { newSpecifications[key] = product?.specifications?.[key] || ''; });

        setFormData(prev => ({
            ...prev,
            category: newCategoryName,
            specifications: newSpecifications
        }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToSave = { ...formData, category: formData.category || 'Uncategorized', updatedAt: serverTimestamp() };
        if (!product) dataToSave.createdAt = serverTimestamp();

        try {
            if (product?.id) {
                await updateDoc(doc(db, getProductDocPath(product.id)), dataToSave);
            } else {
                const newId = dataToSave.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
                await setDoc(doc(db, getProductDocPath(newId)), dataToSave);
            }
            onClose();
        } catch(err) { console.error(err); } finally { setIsSubmitting(false); }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} title={product ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto p-1 pr-3">
                <div><label>Name*</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full border p-2 rounded"/></div>
                <div>
                    <label>Category*</label>
                    <select name="category" value={formData.category} onChange={handleCategoryChange} required className="w-full border p-2 rounded">
                        <option value="">-- Select a Category --</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div><label>Tagline</label><input type="text" name="tagline" value={formData.tagline} onChange={handleChange} className="w-full border p-2 rounded"/></div>
                <div><label>Description</label><textarea name="description" value={formData.description} onChange={handleChange} className="w-full border p-2 rounded"/></div>
                <div><label>Price</label><input type="text" name="price" value={formData.price} onChange={handleChange} className="w-full border p-2 rounded"/></div>
                
                {specKeysForCategory.length > 0 && (
                     <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                         <h3 className="text-sm font-medium text-gray-700">Key Specifications</h3>
                         {specKeysForCategory.map(key => (
                             <div key={key}>
                                 <label className="block text-sm text-gray-600">{key}</label>
                                 <input
                                     type="text"
                                     value={formData.specifications[key] || ''}
                                     onChange={(e) => setFormData(p => ({...p, specifications: {...p.specifications, [key]: e.target.value}}))}
                                     className="w-full border p-2 rounded mt-1"
                                 />
                             </div>
                         ))}
                     </div>
                )}
                
                {/* ... images, featured checkbox, buttons ... */}
                <div className="flex justify-end space-x-3 pt-4 border-t"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={isSubmitting}>Save</button></div>
            </form>
        </Modal>
    );
};

const AdminCategories = () => {
    const { categories, loading: categoriesLoading } = useContext(CategoriesContext);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [editingCategory, setEditingCategory] = useState({ id: null, name: '' });
    const [editingSpec, setEditingSpec] = useState({ categoryId: null, oldKey: '', newKey: '' });
    const [newSpecKey, setNewSpecKey] = useState('');


    const handleAddCategory = async (e) => {
        e.preventDefault();
        const trimmedName = newCategoryName.trim();
        if (!trimmedName || categories.find(c => c.name === trimmedName)) { return; }
        try {
            await setDoc(doc(db, getCategoryDocPath(trimmedName)), { name: trimmedName, specKeys: [], createdAt: serverTimestamp() });
            setNewCategoryName('');
        } catch(error) { console.error("Error adding category:", error); }
    };
    
    const handleUpdateCategoryName = async (id, newName) => {
        const trimmedName = newName.trim();
        if (!trimmedName || id === trimmedName) { setEditingCategory({ id: null, name: '' }); return; }
        try {
            const oldDocRef = doc(db, getCategoryDocPath(id));
            const oldDocSnap = await getDoc(oldDocRef);
            if (oldDocSnap.exists()) {
                const data = oldDocSnap.data();
                data.name = trimmedName;
                const newDocRef = doc(db, getCategoryDocPath(trimmedName));
                await setDoc(newDocRef, data);
                await deleteDoc(oldDocRef);
            }
            setEditingCategory({ id: null, name: '' });
        } catch (error) { console.error("Error updating category:", error); }
    };
    
    const handleAddSpecKey = async (categoryId, event) => {
        event.stopPropagation();
        const trimmedKey = newSpecKey.trim();
        if (!trimmedKey) return;
        const categoryRef = doc(db, getCategoryDocPath(categoryId));
        try {
            await updateDoc(categoryRef, {
                specKeys: arrayUnion(trimmedKey)
            });
            setNewSpecKey('');
        } catch (error) { console.error("Error adding spec key:", error); }
    };
    
    const handleRemoveSpecKey = async (categoryId, keyToRemove, event) => {
        event.stopPropagation();
        const categoryRef = doc(db, getCategoryDocPath(categoryId));
        try {
            await updateDoc(categoryRef, {
                specKeys: arrayRemove(keyToRemove)
            });
        } catch (error) { console.error("Error removing spec key:", error); }
    };

    // FIX: Added the missing handleUpdateSpecKey function
    const handleUpdateSpecKey = async (categoryId, oldKey, newKey) => {
        const trimmedNewKey = newKey.trim();
        if (!trimmedNewKey || oldKey === trimmedNewKey) {
            setEditingSpec({ categoryId: null, oldKey: '', newKey: '' });
            return;
        }

        const categoryRef = doc(db, getCategoryDocPath(categoryId));
        try {
            const categoryDoc = await getDoc(categoryRef);
            if (categoryDoc.exists()) {
                const specKeys = categoryDoc.data().specKeys || [];
                const keyIndex = specKeys.indexOf(oldKey);
                if (keyIndex > -1 && !specKeys.includes(trimmedNewKey)) { // prevent duplicates
                    specKeys[keyIndex] = trimmedNewKey;
                    await updateDoc(categoryRef, { specKeys: specKeys });
                }
            }
        } catch (error) {
            console.error("Error updating spec key:", error);
        } finally {
            setEditingSpec({ categoryId: null, oldKey: '', newKey: '' });
        }
    };

    const handleDeleteCategory = async (id, event) => {
        event.stopPropagation();
        if(window.confirm("Are you sure you want to delete this category? This will not delete the products within it, but they will become uncategorized.")) {
            try { await deleteDoc(doc(db, getCategoryDocPath(id))); } catch (error) { console.error("Error deleting category: ", error); }
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Manage Categories</h2>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-grow px-3 py-2 border border-gray-300 rounded-md"/>
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add</button>
            </form>
            <div className="space-y-2">
                {categoriesLoading && <p>Loading...</p>}
                {categories.map(cat => (
                    <div key={cat.id} className="p-2 bg-gray-50 rounded-md">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}>
                            <span className="text-gray-700 font-semibold">{cat.name}</span>
                            <div className="flex items-center space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); setEditingCategory({ id: cat.id, name: cat.name })}} className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded-full transition-colors" title="Rename Category">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button onClick={(e) => {e.stopPropagation(); handleDeleteCategory(cat.id, e)}} className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full transition-colors" title="Delete Category">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                       <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        {editingCategory?.id === cat.id && (
                            <form onSubmit={(e) => { e.preventDefault(); handleUpdateCategoryName(cat.id, editingCategory.name); }} className="mt-2 flex gap-2">
                                <input type="text" value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} className="flex-grow border px-2 py-1 rounded-md" autoFocus/>
                                <button type="submit" className="text-sm bg-green-500 text-white px-3 py-1 rounded">Save</button>
                            </form>
                        )}
                        {expandedCategory === cat.id && (
                            <div className="mt-4 pt-4 border-t space-y-3" onClick={e => e.stopPropagation()}>
                                <h4 className="text-sm font-semibold">Specification Keys for {cat.name}</h4>
                                {cat.specKeys?.map(key => (
                                    <div key={key} className="flex items-center justify-between text-sm bg-white p-1.5 rounded">
                                        {editingSpec.oldKey === key && editingSpec.categoryId === cat.id ? (
                                            <input type="text" value={editingSpec.newKey} onChange={e => setEditingSpec({...editingSpec, newKey: e.target.value})} onBlur={() => handleUpdateSpecKey(cat.id, editingSpec.oldKey, editingSpec.newKey)} className="border px-1 py-0.5 rounded" autoFocus />
                                        ) : ( <span>{key}</span> )}
                                        <div>
                                            <button onClick={() => setEditingSpec({ categoryId: cat.id, oldKey: key, newKey: key })} className="text-indigo-600 text-xs px-2">Edit</button>
                                            <button onClick={(e) => handleRemoveSpecKey(cat.id, key, e)} className="text-red-500 text-xs">Remove</button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                    <input value={newSpecKey} onChange={e => setNewSpecKey(e.target.value)} placeholder="New spec key name" className="flex-grow px-2 py-1 border rounded"/>
                                    <button onClick={(e) => handleAddSpecKey(cat.id, e)} className="text-sm bg-green-500 text-white px-3 py-1 rounded">Add Spec</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminInquiries = () => {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inquiryToComplete, setInquiryToComplete] = useState(null);
    const [inquiryToDelete, setInquiryToDelete] = useState(null);

    useEffect(() => {
        const inquiriesRef = collection(db, getGlobalInquiriesCollectionPath());
        const unsubscribe = onSnapshot(query(inquiriesRef), (snapshot) => {
            const fetchedInquiries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedInquiries.sort((a, b) => {
                if (a.status === 'completed' && b.status !== 'completed') return 1;
                if (a.status !== 'completed' && b.status === 'completed') return -1;
                return (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0);
            });
            setInquiries(fetchedInquiries);
            setLoading(false);
        }, (error) => { console.error("Error fetching inquiries:", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    const executeMarkAsCompleted = async () => {
        if (!inquiryToComplete) return;
        const inquiryRef = doc(db, getGlobalInquiryDocPath(inquiryToComplete.id));
        try {
            await updateDoc(inquiryRef, { status: 'completed', completedAt: serverTimestamp() });
        } catch (error) {
            console.error("Error updating inquiry status: ", error);
        } finally {
            setInquiryToComplete(null);
        }
    };
    
    const executeDelete = async () => {
        if (!inquiryToDelete) return;
        const inquiryRef = doc(db, getGlobalInquiryDocPath(inquiryToDelete.id));
        try {
            await deleteDoc(inquiryRef);
        } catch (error) {
            console.error("Error deleting inquiry: ", error);
        } finally {
            setInquiryToDelete(null);
        }
    };

    if (loading) return <div>Loading inquiries...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Inquiries</h1>
            
            {inquiryToComplete && (
                <Modal isOpen={true} onClose={() => setInquiryToComplete(null)} title="Confirm Action">
                    <p>Are you sure you want to mark this inquiry as completed?</p>
                    <div className="flex justify-end space-x-4 mt-6">
                        <button onClick={() => setInquiryToComplete(null)} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">Cancel</button>
                        <button onClick={executeMarkAsCompleted} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Confirm</button>
                    </div>
                </Modal>
            )}

            {inquiryToDelete && (
                <Modal isOpen={true} onClose={() => setInquiryToDelete(null)} title="Confirm Deletion">
                    <div className="flex items-start space-x-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Inquiry</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">Are you sure you want to permanently delete this inquiry? This action cannot be undone.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-4 mt-6">
                        <button onClick={() => setInquiryToDelete(null)} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">Cancel</button>
                        <button onClick={executeDelete} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">Delete</button>
                    </div>
                </Modal>
            )}

            <div className="space-y-4">
                {inquiries.length > 0 ? inquiries.map(inq => (
                    <div key={inq.id} className={`bg-white p-4 rounded-lg shadow-sm transition-all ${inq.status === 'completed' ? 'opacity-60 bg-gray-50' : ''}`}>
                       <div className="flex justify-between items-start">
                           <div>
                                <p><strong>From:</strong> {inq.name} (<a href={`mailto:${inq.email}`} className="text-indigo-600 hover:underline">{inq.email}</a>)</p>
                                <p><strong>Regarding:</strong> {inq.productName || "General Contact"}</p>
                                <p className="mt-2 bg-gray-100 p-3 rounded"><strong>Message:</strong> {inq.message}</p>
                                <p className="text-xs text-gray-400 mt-2">Submitted: {inq.submittedAt?.toDate().toLocaleString()}</p>
                                {inq.completedAt && <p className="text-xs text-green-600 mt-1">Completed: {inq.completedAt?.toDate().toLocaleString()}</p>}
                           </div>
                           <div className="flex-shrink-0 ml-4 flex flex-col items-end space-y-2">
                               {inq.status !== 'completed' ? (
                                   <button onClick={() => setInquiryToComplete(inq)} className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full hover:bg-green-200">
                                        Mark as Completed
                                   </button>
                               ) : (
                                   <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                                       <svg className="w-4 h-4 mr-1.5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                       Completed
                                   </span>
                               )}
                               <button 
                                   onClick={() => setInquiryToDelete(inq)} 
                                   className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400" 
                                   title="Delete Inquiry"
                                   disabled={inq.status !== 'completed'}
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                       <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                   </svg>
                               </button>
                           </div>
                       </div>
                    </div>
                )) : <p>No inquiries found.</p>}
            </div>
        </div>
    );
};
const AdminSettings = () => {
    const { settings, updateSettings, loading: settingsLoading } = useContext(SiteSettingsContext);
    const [formData, setFormData] = useState(settings);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (!settingsLoading) {
            setFormData(settings);
        }
    }, [settingsLoading, settings]);
    
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e) => { e.preventDefault(); setIsSubmitting(true); try { await updateSettings(formData); } catch (e) { console.error(e); } finally { setIsSubmitting(false); } };
    
    if (settingsLoading) return <div>Loading settings...</div>;
    
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Site Settings</h1>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow max-w-2xl space-y-6">
                <div><label>Website Name</label><input type="text" name="websiteName" value={formData.websiteName || ''} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                <div><label>Logo URL</label><input type="url" name="logoUrl" value={formData.logoUrl || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                <div><label>Contact Email</label><input type="email" name="contactEmail" value={formData.contactEmail || ''} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                <div><label>Contact Phone</label><input type="tel" name="contactPhone" value={formData.contactPhone || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                <div><label>Contact Address</label><textarea name="contactAddress" value={formData.contactAddress || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                <div><button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white py-2 px-4 rounded">Save</button></div>
            </form>
        </div>
    );
};

const parseHash = () => { 
    const hash = window.location.hash.substring(1) || '/'; 
    const parts = hash.split('/'); 
    const page = parts[1] || 'home'; 
    const id = (page === 'product') ? parts[2] : null;
    const categoryName = (page === 'products') ? parts[2] : null;
    const subpage = (page === 'admin') ? parts[2] : null;
    return { hash, page, id, subpage, categoryName }; 
};

const Router = () => {
    const [route, setRoute] = useState(parseHash());
    useEffect(() => { const h = () => setRoute(parseHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);

    if (route.page === 'home' || route.hash === '#/' || route.hash === '') return <HomePage />;
    if (route.page === 'products' && route.categoryName) return <CategoryPage />;
    if (route.page === 'product' && route.id) return <ProductDetailPage />;
    if (route.page === 'contact') return <ContactPage />;
    
    if (route.page === 'admin') {
        if (route.subpage === 'login') return <AdminLoginPage />;
        let adminContent;
        const adminRouteKey = route.subpage || 'dashboard'; 
        switch (adminRouteKey) {
            case 'products': adminContent = <AdminProducts />; break;
            case 'inquiries': adminContent = <AdminInquiries />; break;
            case 'settings': adminContent = <AdminSettings />; break;
            default: adminContent = <AdminDashboard />; 
        }
        return <AdminLayout>{adminContent}</AdminLayout>;
    }

    return <HomePage />;
};

function App() {
    return (
        <AuthProvider>
            <SiteSettingsProvider>
                <CategoriesProvider>
                    <div className="flex flex-col min-h-screen font-inter bg-gray-50 text-gray-800">
                        <Navbar />
                        <main className="flex-grow w-full">
                            <Router />
                        </main>
                        <Footer />
                    </div>
                </CategoriesProvider>
            </SiteSettingsProvider>
        </AuthProvider>
    );
}
export default App;
