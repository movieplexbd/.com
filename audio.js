// Firebase Configuration Import
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
        import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

        const firebaseConfig = {
            apiKey: "AIzaSyBsz-82MDaibWnIBUpoykrZHyJW7UMedX8",
            authDomain: "movies-bee24.firebaseapp.com",
            databaseURL: "https://movies-bee24-default-rtdb.firebaseio.com",
            projectId: "movies-bee24",
            storageBucket: "movies-bee24.appspot.com",
            messagingSenderId: "1080659811750",
            appId: "1:1080659811750:web:c1ef7d4dacc3ab17edc367"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        // Retrieve Audio URL from Firebase Database
        const audioRef = ref(db, 'audioUrl');
        onValue(audioRef, (snapshot) => {
            const audioUrl = snapshot.val();
            if (audioUrl) {
                const audioElement = document.getElementById("movieAudio");
                const audioSource = document.getElementById("audioSource");
                audioSource.src = audioUrl; // Set audio URL
                audioElement.load(); // Reload audio element to apply new source
            }
        });

        // Function to check if audio can be played today
        function canPlayAudioToday() {
            const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
            const lastPlayed = localStorage.getItem('lastAudioPlayDate');
            return today !== lastPlayed; // Returns true if audio hasn't been played today
        }

        // Flag to ensure audio plays only once a day
        let audioPlayed = false;

        // Start audio on scroll if it can be played today
        window.addEventListener('scroll', function() {
            if (!audioPlayed && canPlayAudioToday()) {
                const audioElement = document.getElementById("movieAudio");
                audioElement.play().then(() => {
                    audioPlayed = true; // Set flag to true so audio won't play again
                    localStorage.setItem('lastAudioPlayDate', new Date().toISOString().split('T')[0]); // Store the date
                }).catch((error) => {
                    console.log("Audio playback failed:", error);
                });
            }
        });
