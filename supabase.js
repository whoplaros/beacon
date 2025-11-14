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

async function signUp() {
	const email = document.getElementById("emailInput").value;
	const password = document.getElementById("passwordInput").value;
	const authMessage = document.getElementById("authMessage");

	if (!email || !password) {
		authMessage.textContent = "Please enter both email and password.";
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
		authMessage.textContent = "Check your email to confirm your account.";
		authMessage.style.color = "green";
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

function showApp() {
	document.getElementById("authContainer").style.display = "none";
	document.querySelector(".container").style.display = "block";

	// Add logout button at the top
	let logoutBtn = document.getElementById("logoutBtn");
	if (!logoutBtn) {
		logoutBtn = document.createElement("button");
		logoutBtn.id = "logoutBtn";
		logoutBtn.className = "btn btn-secondary";
		logoutBtn.style.cssText =
			"position: fixed; top: 10px; right: 10px; z-index: 9999;";
		logoutBtn.innerHTML = "🚪 Log Out";
		logoutBtn.onclick = logOut;
		document.body.appendChild(logoutBtn);
	}

	// Add email tooltip that appears on hover
	if (currentUser) {
		let userTooltip = document.getElementById("userTooltip");
		if (!userTooltip) {
			userTooltip = document.createElement("div");
			userTooltip.id = "userTooltip";
			userTooltip.style.cssText = `
				position: fixed; 
				top: 50px; 
				right: 10px; 
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
			document.body.appendChild(userTooltip);

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
