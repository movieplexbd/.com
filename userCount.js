// Firebase SDK থেকে প্রয়োজনীয় ফাংশনগুলি ইম্পোর্ট করুন
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
    
    // আপনার Firebase কনফিগারেশন
    const firebaseConfig = {
    apiKey: "AIzaSyBsz-82MDaibWnIBUpoykrZHyJW7UMedX8",
    authDomain: "movies-bee24.firebaseapp.com",
    databaseURL: "https://movies-bee24-default-rtdb.firebaseio.com",
    projectId: "movies-bee24",
    storageBucket: "movies-bee24.appspot.com",
    messagingSenderId: "1080659811750",
    appId: "1:1080659811750:web:c1ef7d4dacc3ab17edc367",
    measurementId: "G-T68EYGG3SF"
    };
    
    // Firebase ইনিশিয়ালাইজ করুন
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    
    // ভিজিটর কাউন্ট আপডেট করার ফাংশন
    function incrementVisitorCount() {
    const countRef = ref(database, 'visitorsCount/count');
    get(countRef).then((snapshot) => {
    if (snapshot.exists()) {
    const currentCount = snapshot.val();
    set(countRef, currentCount + 1);
    } else {
    set(countRef, 1);
    }
    });
    }
    
    
    
    // ওয়েবসাইটে প্রবেশের সময় কাউন্ট বাড়ান
    incrementVisitorCount();
    
    // ভিজিটর সংখ্যা প্রদর্শনের জন্য ফাংশন কল করুন
    