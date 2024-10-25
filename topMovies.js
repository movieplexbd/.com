// topMovies.js
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
const topMoviesRef = ref(db, 'top_movies');  // Assuming 'top_movies' node stores top movies data
const topMoviesList = document.getElementById('topMoviesCarousel');

// Fetch and Display Top Movies
onValue(topMoviesRef, (snapshot) => {
    const data = snapshot.val();
    topMoviesList.innerHTML = '';

    if (data) {
        Object.keys(data).forEach((key) => {
            const movie = data[key];
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card3';
            movieCard.innerHTML = `
                <a href="${movie.downloadUrl}" target="_blank">
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                </a>
                <div class="card-body">
                    <h3>${movie.title}</h3>
                </div>
            `;
            topMoviesList.appendChild(movieCard);
        });
    } else {
        topMoviesList.innerHTML = '<div class="text-center">No top movies found</div>';
    }
});

// Carousel Control Logic
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const moviesContainer = document.getElementById('topMoviesCarousel');

// Number of pixels to scroll per click (width of 3 cards plus margin)
const scrollAmount = 3 * 127; // width (123px) + margin (4px) = 127px per card

prevBtn.addEventListener('click', () => {
    moviesContainer.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    resetAutoSlide();
});

nextBtn.addEventListener('click', () => {
    moviesContainer.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    resetAutoSlide();
});

// Auto-slide functionality
let autoSlideInterval = setInterval(() => {
    moviesContainer.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });

    // If we've reached the end, scroll back to start
    if (moviesContainer.scrollLeft + moviesContainer.clientWidth >= moviesContainer.scrollWidth) {
        moviesContainer.scrollTo({
            left: 0,
            behavior: 'smooth'
        });
    }
}, 2000); // Slide every 3 seconds

// Pause auto-slide on mouse enter and resume on mouse leave
moviesContainer.addEventListener('mouseenter', () => {
    clearInterval(autoSlideInterval);
});

moviesContainer.addEventListener('mouseleave', () => {
    autoSlideInterval = setInterval(() => {
        moviesContainer.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });

        if (moviesContainer.scrollLeft + moviesContainer.clientWidth >= moviesContainer.scrollWidth) {
            moviesContainer.scrollTo({
                left: 0,
                behavior: 'smooth'
            });
        }
    }, 2000);
});

// Function to reset auto-slide when user interacts
function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => {
        moviesContainer.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });

        if (moviesContainer.scrollLeft + moviesContainer.clientWidth >= moviesContainer.scrollWidth) {
            moviesContainer.scrollTo({
                left: 0,
                behavior: 'smooth'
            });
        }
    }, 2000);
}