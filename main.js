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
                
                let allMovies = [];
                let itemsPerPage = 14; // Load 8 movies per click
                let currentPage = 0;
                let currentCategory = 'allMovies'; // Default category
                let clickCounts = {}; // Store click counts for each movie
                
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
                
                // Initially display the first set of movies
                currentPage = 0; // Reset page to 0 when movies are loaded
                renderMovies();
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
                const moviesToShow = filteredMovies.slice(0, end); // Show all loaded movies up to 'end'
                
                // Clear the previous movie list before rendering
                movieListContainer.innerHTML = '';
                
                moviesToShow.forEach(movie => {
                const movieCard = document.createElement('div');
                movieCard.className = 'movie-card';
                
                const movieImage = document.createElement('img');
                movieImage.src = movie.fileURL; // Ensure to use a lower quality image URL if needed
                movieImage.alt = movie.name;
                movieImage.addEventListener('click', () => {
                showModal(movie);
                });
                
                const movieInfo = document.createElement('div');
                movieInfo.className = 'movie-info';
                movieInfo.innerHTML = `<h5>${movie.name} (${movie.year})</h5>`;
                
                // Initialize click count for the movie
                clickCounts[movie.name] = clickCounts[movie.name] || 0;
                
                const downloadLink = document.createElement('a');
                downloadLink.textContent = "Download";
                downloadLink.target = "_blank";
                
                // Add click event listener to handle ad and download links
                downloadLink.addEventListener('click', (event) => {
                event.preventDefault();
                clickCounts[movie.name]++;
                
                // Implement the ad link functionality
                if (clickCounts[movie.name] <= 2) {
                // Replace with your ad link here
                window.open(movie.adLink || "https://google.com", "_blank");
                } else {
                window.open(movie.downloadLink, "_blank");
                }
                });
                
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
                categoryButtons.forEach(btn => btn.disabled = false);
                event.target.disabled = true; // Disable the clicked button
                });
                });
                
                // Load movies on page load
                window.onload = loadMovies;
                
                // Show modal with movie details
                function showModal(movie) {
                document.getElementById('modal-title').innerText = movie.name;
                document.getElementById('modal-description').innerText = movie.description;
                document.getElementById('movie-modal').style.display = 'block';
                }
                
                // Close modal functionality
                document.querySelector('.close-btn').addEventListener('click', () => {
                document.getElementById('movie-modal').style.display = 'none';
                });
                
                // Close modal when clicking outside of it
                window.onclick = function(event) {
                if (event.target == document.getElementById('movie-modal')) {
                document.getElementById('movie-modal').style.display = 'none';
                }
                };
                
                
                
                // Handle category button clicks
                categoryButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                currentCategory = event.target.getAttribute('data-category');
                currentPage = 0; // Reset page for new category
                renderMovies();
                
                // Remove active class from all buttons and add to the clicked button
                categoryButtons.forEach(btn => {
                btn.classList.remove('active'); // Remove active class from all
                });
                event.target.classList.add('active'); // Add active class to clicked button
                });
                });