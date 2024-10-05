import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
    import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

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

    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackInput = document.getElementById('feedback');
    const message = document.getElementById('messagess');

    feedbackForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const feedbackData = {
        feedback: feedbackInput.value,
        timestamp: new Date().toISOString()
      };

      const newFeedbackRef = ref(db, 'feedbacks/' + Date.now());
      set(newFeedbackRef, feedbackData)
        .then(() => {
          message.textContent = 'Feedback submitted successfully!';
          feedbackForm.reset();
        })
        .catch((error) => {
          message.textContent = 'Error submitting feedback: ' + error.message;
        });
    });