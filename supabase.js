// supabase.js
const supabaseUrl = "https://duqttjehiykzkvsvmwsu.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1cXR0amVoaXlremt2c3Ztd3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MzY3ODQsImV4cCI6MjA3MzQxMjc4NH0.xKa35Fab_zB-h57p2m6EWOR8MG9m0a9-xqBLCCZghxQ";

// Initialize Supabase client globally
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Store current user globally
let currentUser = null;

// Check authentication on page load
document.addEventListener("DOMContentLoaded", async () => {
	const {
		data: { session },
	} = await supabaseClient.auth.getSession();

	if (session) {
		currentUser = session.user;
		showApp();
	} else {
		showLogin();
	}

	// Listen for auth state changes
	supabaseClient.auth.onAuthStateChange((event, session) => {
		if (event === "SIGNED_IN" && session) {
			currentUser = session.user;
			showApp();
		} else if (event === "SIGNED_OUT") {
			currentUser = null;
			showLogin();
		}
	});
});

// Valid invite codes - change these to whatever you want!
const VALID_INVITE_CODES = ["BEACON2025", "RESEARCH2025", "EDUCATOR2025"];

let isSignUpMode = false;

function toggleSignUpMode() {
	isSignUpMode = !isSignUpMode;
	const inviteCodeContainer = document.getElementById("inviteCodeContainer");
	const signUpBtn = document.querySelector(".auth-buttons button:last-child");

	if (isSignUpMode) {
		inviteCodeContainer.style.display = "block";
		signUpBtn.textContent = "Create Account";
		signUpBtn.onclick = signUp;
	} else {
		inviteCodeContainer.style.display = "none";
		document.getElementById("inviteCodeInput").value = "";
		signUpBtn.textContent = "Sign Up";
		signUpBtn.onclick = toggleSignUpMode;
	}
}

async function signUp() {
	const email = document.getElementById("emailInput").value;
	const password = document.getElementById("passwordInput").value;
	const inviteCode = document.getElementById("inviteCodeInput").value;
	const authMessage = document.getElementById("authMessage");

	if (!email || !password) {
		authMessage.textContent = "Please enter both email and password.";
		authMessage.style.color = "red";
		return;
	}

	// Validate invite code
	if (!inviteCode) {
		authMessage.textContent = "Please enter an invite code.";
		authMessage.style.color = "red";
		return;
	}

	if (!VALID_INVITE_CODES.includes(inviteCode.trim().toUpperCase())) {
		authMessage.textContent =
			"Invalid invite code. Please contact the administrator.";
		authMessage.style.color = "red";
		return;
	}

	const { data, error } = await supabaseClient.auth.signUp({
		email,
		password,
	});

	if (error) {
		authMessage.textContent = error.message;
		authMessage.style.color = "red";
	} else {
		authMessage.textContent =
			"Account created! Check your email to confirm your account.";
		authMessage.style.color = "green";
		// Reset form
		document.getElementById("inviteCodeInput").value = "";
		toggleSignUpMode();
	}
}

async function logIn() {
	const email = document.getElementById("emailInput").value;
	const password = document.getElementById("passwordInput").value;
	const authMessage = document.getElementById("authMessage");

	if (!email || !password) {
		authMessage.textContent = "Please enter both email and password.";
		return;
	}

	const { data, error } = await supabaseClient.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		authMessage.textContent = error.message;
		authMessage.style.color = "red";
	} else {
		currentUser = data.user;
		authMessage.textContent = "Login successful!";
		authMessage.style.color = "green";
		// The onAuthStateChange listener will handle showing the app
	}
}

async function logOut() {
	await supabaseClient.auth.signOut();
	currentUser = null;
	location.reload();
}

async function forgotPassword() {
	const email = document.getElementById("emailInput").value;
	const authMessage = document.getElementById("authMessage");

	if (!email) {
		authMessage.textContent = "Please enter your email address first.";
		authMessage.style.color = "red";
		return;
	}

	// Confirm with user
	if (!confirm(`Send password reset email to ${email}?`)) {
		return;
	}

	try {
		const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
			redirectTo: window.location.origin,
		});

		if (error) throw error;

		authMessage.textContent = "Password reset email sent! Check your inbox.";
		authMessage.style.color = "green";
	} catch (error) {
		authMessage.textContent = "Error: " + error.message;
		authMessage.style.color = "red";
	}
}

function showApp() {
	document.getElementById("authContainer").style.display = "none";
	document.querySelector(".container").style.display = "block";

	// Add logout button in the header
	let logoutBtn = document.getElementById("logoutBtn");
	const logoutContainer = document.getElementById("logoutBtnContainer");

	if (!logoutBtn) {
		logoutBtn = document.createElement("button");
		logoutBtn.id = "logoutBtn";
		logoutBtn.className = "header-logout-btn";
		logoutBtn.innerHTML = "🚪 Log Out";
		logoutBtn.onclick = logOut;
		logoutContainer.appendChild(logoutBtn);
	}

	// Add email tooltip that appears on hover
	if (currentUser) {
		let userTooltip = document.getElementById("userTooltip");
		if (!userTooltip) {
			userTooltip = document.createElement("div");
			userTooltip.id = "userTooltip";
			userTooltip.style.cssText = `
				position: absolute; 
				top: 60px; 
				right: 20px; 
				z-index: 9998; 
				background: white; 
				padding: 8px 12px; 
				border-radius: 6px; 
				box-shadow: 0 2px 8px rgba(0,0,0,0.15); 
				font-size: 0.85rem; 
				color: #64748b;
				opacity: 0;
				visibility: hidden;
				transition: opacity 0.2s ease, visibility 0.2s ease;
				pointer-events: none;
				white-space: nowrap;
			`;
			userTooltip.textContent = `Logged in as: ${currentUser.email}`;
			logoutContainer.appendChild(userTooltip);

			// Show tooltip on logout button hover
			logoutBtn.addEventListener("mouseenter", () => {
				userTooltip.style.opacity = "1";
				userTooltip.style.visibility = "visible";
			});

			logoutBtn.addEventListener("mouseleave", () => {
				userTooltip.style.opacity = "0";
				userTooltip.style.visibility = "hidden";
			});
		}
	}
}

function showLogin() {
	document.getElementById("authContainer").style.display = "block";
	document.querySelector(".container").style.display = "none";

	// Remove logout button if it exists
	const logoutBtn = document.getElementById("logoutBtn");
	if (logoutBtn) logoutBtn.remove();

	const userTooltip = document.getElementById("userTooltip");
	if (userTooltip) userTooltip.remove();
}

// Helper function to get current user ID
function getCurrentUserId() {
	return currentUser ? currentUser.id : null;
}

// Helper function to get current user email
function getCurrentUserEmail() {
	return currentUser ? currentUser.email : null;
}
