// slider.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// Firebase configuration (Should be same as main.js, consider centralizing this)
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

// DOM Elements
const slidesRef = ref(db, 'slides');
const slider = document.getElementById('slider');
const dotsContainer = document.getElementById('dots');

let slides = [];
let currentIndex = 0;
let slideInterval;

// Load Slides from Firebase
function loadSlides() {
    onValue(slidesRef, (snapshot) => {
        slides = [];
        slider.innerHTML = '';
        dotsContainer.innerHTML = '';

        snapshot.forEach((childSnapshot) => {
            const slide = childSnapshot.val();
            slides.push(slide);
            const slideElement = document.createElement('div');
            slideElement.className = 'slide';
            slideElement.innerHTML = `
                <a href="${slide.link}">
                    <img src="${slide.imageURL}" alt="${slide.title}">
                    <div class="slide-info">${slide.title}</div>
                </a>
            `;
            slider.appendChild(slideElement);

            // Create dot for each slide
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.addEventListener('click', () => {
                showSlide(slides.indexOf(slide));
            });
            dotsContainer.appendChild(dot);
        });

        // Start the auto-sliding
        startAutoSlide();
    });
}

// Show Specific Slide
function showSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    slider.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update dots
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active-dot', i === currentIndex);
    });
}

// Auto Slide Functionality
function startAutoSlide() {
    slideInterval = setInterval(() => {
        showSlide(currentIndex + 1);
    }, 2000); // Slide every 5 seconds
}

function stopAutoSlide() {
    clearInterval(slideInterval);
}

// Navigation Controls
document.getElementById('prevs').addEventListener('click', () => {
    showSlide(currentIndex - 1);
    stopAutoSlide();
    startAutoSlide();
});

document.getElementById('nexts').addEventListener('click', () => {
    showSlide(currentIndex + 1);
    stopAutoSlide();
    startAutoSlide();
});

// Initialize Slider
loadSlides();