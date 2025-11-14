// supabase.js
const supabaseUrl = "https://duqttjehiykzkvsvmwsu.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1cXR0amVoaXlremt2c3Ztd3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MzY3ODQsImV4cCI6MjA3MzQxMjc4NH0.xKa35Fab_zB-h57p2m6EWOR8MG9m0a9-xqBLCCZghxQ";

let supabaseClient;

function initSupabase() {
	supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}

// Ensure supabase is initialized before this
document.addEventListener("DOMContentLoaded", async () => {
	const session = await supabase.auth.getSession();

	if (session.data.session) {
		showApp();
	} else {
		showLogin();
	}
});

async function signUp() {
	const email = document.getElementById("emailInput").value;
	const password = document.getElementById("passwordInput").value;

	const { error } = await supabase.auth.signUp({
		email,
		password,
	});

	if (error) {
		document.getElementById("authMessage").textContent = error.message;
	} else {
		document.getElementById("authMessage").textContent =
			"Check your email to confirm your account.";
	}
}

async function logIn() {
	const email = document.getElementById("emailInput").value;
	const password = document.getElementById("passwordInput").value;

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		document.getElementById("authMessage").textContent = error.message;
	} else {
		location.reload(); // Reload to trigger showing the app
	}
}

async function logOut() {
	await supabase.auth.signOut();
	location.reload();
}

function showApp() {
	document.getElementById("authContainer").style.display = "none";
	document.querySelector(".container").style.display = "block";

	// Optional: add logout button
	const logoutBtn = document.createElement("button");
	logoutBtn.textContent = "🚪 Log Out";
	logoutBtn.style.margin = "10px";
	logoutBtn.onclick = logOut;
	document.body.prepend(logoutBtn);
}

function showLogin() {
	document.getElementById("authContainer").style.display = "block";
	document.querySelector(".container").style.display = "none";
}
