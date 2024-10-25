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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const movieListContainer = document.getElementById('movie-list');
const loadingElement = document.getElementById('loading');
const loadMoreButton = document.getElementById('loadMore');
const endMessage = document.getElementById('endMessage');
const categoryButtons = document.querySelectorAll('.category-btn');
const searchInput = document.getElementById('search');

let allMovies = [];
let itemsPerPage = 14; // Load 14 movies per click
let currentPage = 0;
let currentCategory = 'allMovies'; // Default category

// Load Movies from Firebase
function loadMovies() {
    loadingElement.style.display = 'block';
    const moviesRef = ref(db, 'movies');
    onValue(moviesRef, (snapshot) => {
        loadingElement.style.display = 'none';
        allMovies = [];
        snapshot.forEach((childSnapshot) => {
            const movie = childSnapshot.val();
            allMovies.push(movie);
        });

        // Sort by newest (last movies first)
        allMovies.sort((a, b) => b.uploadedAt - a.uploadedAt);

        // Reset currentPage to load first set of movies
        currentPage = 0;
        renderMovies(); // Call renderMovies for the first time
    });
}

// Render Movies function with filtering logic
function renderMovies() {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;

    // Filter movies based on the current category
    const filteredMovies = allMovies.filter(movie => {
        if (currentCategory === 'allMovies') {
            return true; // Show all movies for 'allMovies' category
        } else {
            return movie.category === currentCategory; // Match movie's category
        }
    });

    // Slice movies based on pagination (start and end)
    const moviesToShow = filteredMovies.slice(start, end);

    // Clear the previous movie list before rendering if it's the first load
    if (currentPage === 0) {
        movieListContainer.innerHTML = ''; // Clear only if loading the first page
    }

    moviesToShow.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';

        // ক্যাটাগরি ডাইনামিক্যালি সেট করা
        movieCard.setAttribute('data-category', movie.category); // movie.category এর মান অনুসারে category দেখাবে

        const movieImage = document.createElement('img');
        movieImage.src = movie.fileURL;
        movieImage.alt = movie.name;
        movieImage.addEventListener('click', () => {
            showModal(movie);
        });

        const movieInfo = document.createElement('div');
        movieInfo.className = 'movie-info';
        movieInfo.innerHTML = `<h5>${movie.name} (${movie.year})</h5>`;

        const downloadLink = document.createElement('a');
        downloadLink.textContent = "Download";
        downloadLink.href = `movie-detail.html?name=${encodeURIComponent(movie.name)}`;
        downloadLink.target = "_self";

        movieInfo.appendChild(downloadLink);
        movieCard.appendChild(movieImage);
        movieCard.appendChild(movieInfo);
        movieListContainer.appendChild(movieCard);
    });

    // Manage Load More button visibility
    loadMoreButton.style.display = filteredMovies.length > end ? 'block' : 'none';
    endMessage.style.display = filteredMovies.length <= end ? 'block' : 'none';
}

// Load more movies
loadMoreButton.addEventListener('click', () => {
    currentPage++;
    renderMovies(); // Call renderMovies to show the next set of movies
});

// Handle category button clicks
categoryButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        currentCategory = event.target.getAttribute('data-category');
        currentPage = 0; // Reset page for new category
        renderMovies();

        // Update button styles for visual feedback
        categoryButtons.forEach(btn => {
            btn.classList.remove('active'); // Remove active class from all
        });
        event.target.classList.add('active'); // Add active class to the clicked button
    });
});

// Show movie modal for movie details
function showModal(movie) {
    const modal = document.getElementById('movie-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');

    modalTitle.textContent = movie.name;
    modalDescription.textContent = movie.description;

    modal.style.display = 'block'; // Show the modal
}

// Close the modal when the user clicks on <span> (x)
document.querySelector('.close-btn').onclick = function() {
    document.getElementById('movie-modal').style.display = "none"; // Hide the modal
}

// Search functionality
searchInput.addEventListener('input', function() {
    const query = searchInput.value.toLowerCase();
    filterMoviesBySearch(query);
});

function filterMoviesBySearch(query) {
    // Filter movies based on search query
    const filteredMovies = allMovies.filter(movie => {
        return movie.name.toLowerCase().includes(query); // Search in movie name
    });

    // Reset pagination to show filtered results
    currentPage = 0;
    renderFilteredMovies(filteredMovies);
}

function renderFilteredMovies(filteredMovies) {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;

    // Slice movies based on pagination (start and end)
    const moviesToShow = filteredMovies.slice(start, end);

    // Clear previous movie list
    movieListContainer.innerHTML = '';

    // Render the filtered movies
    moviesToShow.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.setAttribute('data-category', movie.category);

        const movieImage = document.createElement('img');
        movieImage.src = movie.fileURL;
        movieImage.alt = movie.name;
        movieImage.addEventListener('click', () => {
            showModal(movie);
        });

        const movieInfo = document.createElement('div');
        movieInfo.className = 'movie-info';
        movieInfo.innerHTML = `<h5>${movie.name} (${movie.year})</h5>`;

        const downloadLink = document.createElement('a');
        downloadLink.textContent = "Download";
        downloadLink.href = `movie-detail.html?name=${encodeURIComponent(movie.name)}`;
        downloadLink.target = "_self";

        movieInfo.appendChild(downloadLink);
        movieCard.appendChild(movieImage);
        movieCard.appendChild(movieInfo);
        movieListContainer.appendChild(movieCard);
    });

    // Manage Load More button visibility for filtered movies
    loadMoreButton.style.display = filteredMovies.length > end ? 'block' : 'none';
    endMessage.style.display = filteredMovies.length <= end ? 'block' : 'none';
}

// Load Movies on page load
loadMovies();
