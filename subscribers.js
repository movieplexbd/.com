// Firebase configuration and initialization
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

// Show popup after 5 seconds if user has not subscribed
window.onload = function() {
    const subscribed = localStorage.getItem("subscribed");
    if (!subscribed) {
        setTimeout(() => {
            document.getElementById("subscribePopup").style.display = "flex";
        }, 5000); // Show popup after 5 seconds
    } else {
        // If subscribed, don't show the popup
        document.getElementById("subscribePopup").style.display = "none";
    }
};

// Enable subscribe button if both fields are valid
function checkInputFields() {
    const userName = document.getElementById("userName").value;
    const userEmail = document.getElementById("userEmail").value;
    document.getElementById("subscribeButton").disabled = !userName || !userEmail.includes("@");
}

document.getElementById("userName").addEventListener("input", checkInputFields);
document.getElementById("userEmail").addEventListener("input", checkInputFields);

// Subscribe button click event
document.getElementById("subscribeButton").addEventListener("click", function() {
    const userName = document.getElementById("userName").value;
    const userEmail = document.getElementById("userEmail").value;

    // Save subscription data in Firebase
    set(ref(db, 'subscribers/' + userEmail.replace('.', '_')), {
        name: userName,
        email: userEmail
    })
    .then(() => {
        document.getElementById("successMessage").style.display = "block"; // Show success message
        setTimeout(() => {
            document.getElementById("successMessage").style.display = "none"; // Hide after 3 seconds
        }, 3000);
        localStorage.setItem("subscribed", "true"); // Mark user as subscribed
        document.getElementById("subscribePopup").style.display = "none"; // Hide popup
    })
    .catch((error) => {
        console.error("Error subscribing: ", error);
    });
});