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
        const modal = document.getElementById('movie-modal');
        const closeModal = document.querySelector('.close-btn');
        const searchInput = document.getElementById('search');
        const paginationContainer = document.getElementById('pagination');

        let allMovies = [];
        let currentPage = 1;
        const itemsPerPage = 14;
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
                allMovies.sort((a, b) => b.uploadedAt - a.uploadedAt); // New movies first

                currentPage = Math.ceil(allMovies.length / itemsPerPage);
                paginateMovies(allMovies);
            });
        }

        // Paginate Movies
        function paginateMovies(movies) {
            const totalPages = Math.ceil(movies.length / itemsPerPage);
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const paginatedMovies = movies.slice(start, end);

            movieListContainer.innerHTML = '';
            paginatedMovies.forEach(movie => {
                const movieCard = document.createElement('div');
                movieCard.className = 'movie-card';

                const movieImage = document.createElement('img');
                movieImage.src = movie.fileURL;
                movieImage.alt = movie.name;
                movieImage.addEventListener('click', () => {
                    showModal(movie);
                });

                const movieInfo = document.createElement('div');
                movieInfo.className = 'movie-info';

                // Initialize click count for the movie
                clickCounts[movie.name] = clickCounts[movie.name] || 0;

                const downloadLink = document.createElement('a');
                downloadLink.textContent = "Download";
                downloadLink.target = "_blank";

                // Add click event listener to handle ad and download links
                downloadLink.addEventListener('click', (event) => {
                    event.preventDefault(); // Prevent default anchor behavior
                    clickCounts[movie.name] += 1; // Increment click count

                    if (clickCounts[movie.name] <= 2) {
                        window.open(movie.adLink, "_blank"); // Redirect to ad link for the first two clicks
                    } else {
                        window.open(movie.downloadLink, "_blank"); // Use the actual download link on the third click
                    }
                });

                movieInfo.innerHTML = `
                    <h5>${movie.name} (${movie.year})</h5>
                `;
                movieInfo.appendChild(downloadLink); // Append the download link to the movie info

                movieCard.appendChild(movieImage);
                movieCard.appendChild(movieInfo);
                movieListContainer.appendChild(movieCard);
            });

            // Create pagination buttons
            createPagination(totalPages);
        }

        // Create Pagination Buttons
        function createPagination(totalPages) {
            paginationContainer.innerHTML = ''; // Clear previous pagination
            const paginationWrapper = document.createElement('div'); // Create a wrapper div for pagination buttons
            paginationWrapper.className = 'pagination-wrapper'; // Add a class to the wrapper

            // Create buttons from last page to first page
            for (let i = totalPages; i >= 1; i--) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                pageBtn.className = 'pagination-btn';
                pageBtn.classList.toggle('active', i === currentPage); // Add active class to current page

                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    paginateMovies(allMovies);
                    // Scroll to the top when changing pages
                    window.scrollTo(0, 0);
                    });
                    
                    paginationWrapper.appendChild(pageBtn); // Append the button to the pagination wrapper
                    }
                    
                    paginationContainer.appendChild(paginationWrapper); // Append the wrapper to the pagination container
                    }
                    
                    // Show Movie Modal
                    function showModal(movie) {
                    const modalTitle = document.getElementById('modal-title');
                    const modalDescription = document.getElementById('modal-description');
                    
                    modalTitle.textContent = movie.name;
                    modalDescription.textContent = movie.description;
                    modal.style.display = 'block'; // Show modal
                    }
                    
                    // Close Movie Modal
                    closeModal.addEventListener('click', () => {
                    modal.style.display = 'none'; // Hide modal
                    });
                    
                    // Load Movies on Page Load
                    window.onload = loadMovies;
                    
                    // Search Functionality
                    searchInput.addEventListener('input', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    const filteredMovies = allMovies.filter(movie => movie.name.toLowerCase().includes(searchTerm));
                    paginateMovies(filteredMovies);
                    });