import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBsz-82MDaibWnIBUpoykrZHyJW7UMedX8",
  authDomain: "movies-bee24.firebaseapp.com",
  databaseURL: "https://movies-bee24-default-rtdb.firebaseio.com",
  projectId: "movies-bee24",
  storageBucket: "movies-bee24.appspot.com",
  messagingSenderId: "1080659811750",
  appId: "1:1080659811750:web:c1ef7d4dacc3ab17edc367",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// All emails in this list have full admin access.
export const ADMIN_EMAILS: string[] = [
  "a@gmail.com",
  "sshepons38@gmail.com",
];

// Backwards-compat default (first entry).
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase().trim());

