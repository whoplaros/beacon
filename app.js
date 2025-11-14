// app.js

// Upload video function with user authentication
async function uploadVideo() {
	const fileInput = document.getElementById("fileInput");
	const file = fileInput.files[0];

	if (!file) {
		alert("Please select a file first.");
		return;
	}

	const userId = getCurrentUserId();
	if (!userId) {
		alert("You must be logged in to upload files.");
		return;
	}

	// Show uploading status
	const uploadBtn = document.querySelector('button[onclick="uploadVideo()"]');
	const originalText = uploadBtn.textContent;
	uploadBtn.textContent = "Uploading...";
	uploadBtn.disabled = true;

	try {
		// Create user-specific file path
		const timestamp = new Date().getTime();
		const filePath = `${userId}/${timestamp}_${file.name}`;

		// Upload to Supabase Storage
		const { data: uploadData, error: uploadError } =
			await supabaseClient.storage.from("videos").upload(filePath, file, {
				cacheControl: "3600",
				upsert: false,
			});

		if (uploadError) {
			throw uploadError;
		}

		// Get public URL
		const { data: urlData } = supabaseClient.storage
			.from("videos")
			.getPublicUrl(filePath);

		// Insert metadata into videos table
		const { data: dbData, error: dbError } = await supabaseClient
			.from("videos")
			.insert({
				user_id: userId,
				title: file.name,
				upload_url: filePath,
				file_size: file.size,
				file_type: file.type,
			})
			.select();

		if (dbError) {
			throw dbError;
		}

		alert("Upload complete! File saved to your account.");
		console.log("Upload successful:", dbData);

		// Load the video into the player
		const player = document.getElementById("player");
		player.src = URL.createObjectURL(file);
		document.getElementById("mediaContainer").style.display = "block";
	} catch (error) {
		console.error("Upload error:", error);
		alert("Upload failed: " + error.message);
	} finally {
		uploadBtn.textContent = originalText;
		uploadBtn.disabled = false;
	}
}

// Function to list user's uploaded videos
async function listUserVideos() {
	const userId = getCurrentUserId();
	if (!userId) {
		alert("You must be logged in to view your videos.");
		return;
	}

	try {
		const { data, error } = await supabaseClient
			.from("videos")
			.select("*")
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		console.log("Your videos:", data);
		return data;
	} catch (error) {
		console.error("Error loading videos:", error);
		alert("Error loading videos: " + error.message);
		return [];
	}
}

// Application expiration check
function checkExpiration() {
	const expirationDate = new Date("2025-12-31");
	const currentDate = new Date();

	if (currentDate > expirationDate) {
		document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="text-align: center; padding: 48px; background: white; border-radius: 16px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); max-width: 500px;">
            <div style="font-size: 4rem; margin-bottom: 24px;">⏰</div>
            <h2 style="color: #1e293b; margin-bottom: 16px;">BEACON Application Expired</h2>
            <p style="color: #64748b; margin-bottom: 24px; line-height: 1.6;">
              This version of BEACON (Behavioral Educational Analysis & Classroom Observation Notebook) expired on ${expirationDate.toLocaleDateString()}.
            </p>
            <p style="color: #64748b; font-size: 0.9rem;">
              Please contact the administrator for an updated version.
            </p>
            <p style="color: #64748b; font-size: 0.8rem; margin-top: 20px; opacity: 0.7;">
              &copy; 2025 Georgios Hoplaros, PhD
            </p>
          </div>
        </div>
      `;
		return true;
	}
	return false;
}

if (checkExpiration()) {
	// Stop execution if expired
} else {
	document.addEventListener("DOMContentLoaded", function () {
		const player = document.getElementById("player");
		const eventsContainer = document.getElementById("eventsContainer");
		const canvas = document.getElementById("observationChart");
		const analysisContainer = document.getElementById("analysisContainer");
		const mediaContainer = document.getElementById("mediaContainer");
		const sizeSlider = document.getElementById("sizeSlider");
		const sizeDisplay = document.getElementById("sizeDisplay");
		const statusIndicator = document.getElementById("statusIndicator");
		const controlsFrame = document.getElementById("controlsFrame");
		const videoFrame = document.getElementById("videoFrame");
		const detachBtn = document.getElementById("detachBtn");
		const detachVideoBtn = document.getElementById("detachVideoBtn");
		const exportSVGContainer = document.getElementById("exportSVGContainer");

		let allEvents = [];
		let keyBindings = {};
		let activeDurations = {};
		let graphBars = [];
		let ecPoints = [];
		let isDragging = false;
		let dragOffset = { x: 0, y: 0 };
		let currentDragElement = null;

		const originalControlsParent = controlsFrame.parentNode;
		const originalVideoParent = videoFrame.parentNode;

		document.getElementById("fileInput").addEventListener("change", (e) => {
			const file = e.target.files[0];
			if (file) {
				player.src = URL.createObjectURL(file);
				mediaContainer.style.display = "block";
				updateStatus("ready", "Media loaded - Ready to track");
			}
		});

		sizeSlider.addEventListener("input", (e) => {
			const size = e.target.value;
			player.style.maxWidth = size + "px";
			sizeDisplay.textContent = size + "px";
		});

		function updateStatus(type, message) {
			statusIndicator.className = `status-indicator ${type}`;
			statusIndicator.innerHTML = `<span class="${
				type === "recording" ? "pulse" : ""
			}">●</span> ${message}`;
		}

		const fmt = (s) => Number(s).toFixed(2);

		function clearEmptyState() {
			const emptyState = eventsContainer.querySelector(".empty-state");
			if (emptyState) {
				emptyState.remove();
			}
		}

		detachBtn.addEventListener("click", () => {
			if (controlsFrame.classList.contains("detached")) {
				controlsFrame.classList.remove("detached");
				controlsFrame.classList.add("attached");
				controlsFrame.style.position = "";
				controlsFrame.style.top = "";
				controlsFrame.style.left = "";
				controlsFrame.style.right = "";
				controlsFrame.style.zIndex = "";
				controlsFrame.style.width = "";
				controlsFrame.style.height = "";
				detachBtn.textContent = "📌 Detach Controls";
				originalControlsParent.appendChild(controlsFrame);
			} else {
				controlsFrame.classList.remove("attached");
				controlsFrame.classList.add("detached");
				controlsFrame.style.top = "100px";
				controlsFrame.style.right = "20px";
				detachBtn.textContent = "📎 Attach Controls";
				document.body.appendChild(controlsFrame);
			}
		});

		detachVideoBtn.addEventListener("click", () => {
			if (videoFrame.classList.contains("detached")) {
				videoFrame.classList.remove("detached");
				videoFrame.classList.add("attached");
				videoFrame.style.position = "";
				videoFrame.style.top = "";
				videoFrame.style.left = "";
				videoFrame.style.right = "";
				videoFrame.style.zIndex = "";
				videoFrame.style.width = "";
				videoFrame.style.height = "";
				detachVideoBtn.textContent = "🎬 Detach Video";
				originalVideoParent.appendChild(videoFrame);
			} else {
				videoFrame.classList.remove("attached");
				videoFrame.classList.add("detached");
				videoFrame.style.top = "50px";
				videoFrame.style.left = "50px";
				detachVideoBtn.textContent = "🎬 Attach Video";
				document.body.appendChild(videoFrame);
			}
		});

		function setupDragHandlers(frame, dragHandle) {
			dragHandle.addEventListener("mousedown", (e) => {
				if (!frame.classList.contains("detached")) return;
				isDragging = true;
				currentDragElement = frame;
				const rect = frame.getBoundingClientRect();
				dragOffset.x = e.clientX - rect.left;
				dragOffset.y = e.clientY - rect.top;
				frame.style.cursor = "grabbing";
				e.preventDefault();
			});
		}

		setupDragHandlers(
			controlsFrame,
			controlsFrame.querySelector(".drag-handle")
		);
		setupDragHandlers(videoFrame, videoFrame.querySelector(".drag-handle"));

		document.addEventListener("mousemove", (e) => {
			if (
				!isDragging ||
				!currentDragElement ||
				!currentDragElement.classList.contains("detached")
			)
				return;
			const x = e.clientX - dragOffset.x;
			const y = e.clientY - dragOffset.y;
			const maxX = window.innerWidth - currentDragElement.offsetWidth;
			const maxY = window.innerHeight - currentDragElement.offsetHeight;
			currentDragElement.style.left = Math.max(0, Math.min(x, maxX)) + "px";
			currentDragElement.style.top = Math.max(0, Math.min(y, maxY)) + "px";
			currentDragElement.style.right = "auto";
		});

		document.addEventListener("mouseup", () => {
			if (isDragging) {
				isDragging = false;
				if (currentDragElement) {
					currentDragElement.style.cursor = "";
				}
				currentDragElement = null;
			}
		});

		function createEventRow(name, key, type, prefill = "") {
			clearEmptyState();
			const row = document.createElement("div");
			row.className = "event-row";

			const keybtn = document.createElement("button");
			keybtn.className = "keybtn";
			keybtn.textContent = key.toUpperCase();
			keybtn.title = `Press ${key.toUpperCase()} to record`;

			const label = document.createElement("span");
			label.className = "event-label";
			label.textContent = name;

			const typeBadge = document.createElement("span");
			typeBadge.className = `type-badge ${type.toLowerCase()}`;
			typeBadge.textContent = type === "EC" ? "Event Count" : "Duration";

			const input = document.createElement("input");
			input.type = "text";
			input.className = "event-input";
			input.value = prefill;
			input.placeholder =
				type === "EC"
					? "Recorded times will appear here..."
					: "Duration pairs (start-end) will appear here...";
			input.readOnly = true;

			row.appendChild(keybtn);
			row.appendChild(label);
			row.appendChild(typeBadge);
			row.appendChild(input);
			eventsContainer.appendChild(row);

			const event = { key, name, type, input, row };
			allEvents.push(event);
			keyBindings[key] = event;

			keybtn.addEventListener("click", () => handleKeyPress(key));
		}

		// Make createEventRow globally accessible
		window.createEventRow = createEventRow;

		function handleKeyPress(key) {
			const event = keyBindings[key];
			if (!event) return;

			const currentTime = player.currentTime;
			if (isNaN(currentTime)) {
				alert("Please load a video/audio file before tracking events.");
				return;
			}

			if (event.type === "EC") {
				const existing = event.input.value ? event.input.value.split(",") : [];
				existing.push(fmt(currentTime));
				event.input.value = existing.join(", ");
				ecPoints.push({ time: currentTime, name: event.name });
				updateStatus("recording", `Event recorded at ${fmt(currentTime)}s`);
				setTimeout(() => updateStatus("ready", "Ready to track"), 1000);
			} else if (event.type === "DE") {
				if (activeDurations[key]) {
					const startTime = activeDurations[key];
					const duration = currentTime - startTime;
					const existing = event.input.value
						? event.input.value.split(",")
						: [];
					existing.push(`${fmt(startTime)}-${fmt(currentTime)}`);
					event.input.value = existing.join(", ");
					delete activeDurations[key];
					event.row.style.background = "";
					graphBars.push({
						start: startTime,
						end: currentTime,
						name: event.name,
					});
					updateStatus(
						"ready",
						`Duration ended: ${duration.toFixed(2)}s (${fmt(
							startTime
						)}s - ${fmt(currentTime)}s)`
					);
				} else {
					activeDurations[key] = currentTime;
					const existing = event.input.value
						? event.input.value.split(",")
						: [];
					existing.push(`${fmt(currentTime)}...`);
					event.input.value = existing.join(", ");
					event.row.style.background = "rgba(239, 68, 68, 0.1)";
					updateStatus(
						"recording",
						`Duration started at ${fmt(
							currentTime
						)}s - Press ${key.toUpperCase()} again to end`
					);
				}
			}
		}

		document.addEventListener("keydown", (e) => {
			if (
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable
			) {
				return;
			}
			const key = e.key.toLowerCase();
			if (keyBindings[key]) {
				e.preventDefault();
				handleKeyPress(key);
			}
		});

		document.getElementById("createEC").addEventListener("click", () => {
			const name = prompt("Enter event name (e.g., 'Hand Raise'):");
			if (!name) return;
			const key = prompt(
				`Enter keyboard shortcut (single letter/number) for "${name}":`
			);
			if (!key || key.length !== 1) {
				alert("Please enter a single character.");
				return;
			}
			if (keyBindings[key.toLowerCase()]) {
				alert(`Key "${key}" is already in use.`);
				return;
			}
			createEventRow(name, key.toLowerCase(), "EC");
		});

		document.getElementById("createDE").addEventListener("click", () => {
			const name = prompt("Enter duration event name (e.g., 'Off Task'):");
			if (!name) return;
			const key = prompt(
				`Enter keyboard shortcut (single letter/number) for "${name}":`
			);
			if (!key || key.length !== 1) {
				alert("Please enter a single character.");
				return;
			}
			if (keyBindings[key.toLowerCase()]) {
				alert(`Key "${key}" is already in use.`);
				return;
			}
			createEventRow(name, key.toLowerCase(), "DE");
		});

		document.getElementById("showGraph").addEventListener("click", () => {
			// Check if we have any events with data
			const hasEventData = allEvents.some(
				(e) => e.input.value && e.input.value.trim() !== ""
			);

			if (!hasEventData) {
				alert(
					"No observation data to display. Please record some observations first."
				);
				return;
			}

			// If no video loaded, use the stored video duration from session or set a default
			let durationSec = player.duration;
			if (!durationSec || isNaN(durationSec)) {
				// Try to extract duration from the event data
				durationSec = 0;
				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						if (times.length > 0) {
							durationSec = Math.max(durationSec, Math.max(...times));
						}
					} else if (ev.type === "DE") {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						pairs.forEach((p) => {
							const [s, e] = p.split("-").map(Number);
							if (Number.isFinite(e)) {
								durationSec = Math.max(durationSec, e);
							}
						});
					}
				});

				if (durationSec === 0) {
					alert(
						"Cannot determine video duration. Please load a video file or record observations with timestamps."
					);
					return;
				}
			}

			const labels = allEvents.length
				? allEvents.map((e) => e.name)
				: ["No Observations"];

			const canvasElement = document.getElementById("observationChart");
			canvasElement.style.display = "block";
			exportSVGContainer.style.display = "block";
			canvasElement.scrollIntoView({ behavior: "smooth", block: "center" });

			const ctx = canvasElement.getContext("2d");

			if (window.observationChartInstance) {
				window.observationChartInstance.destroy();
			}

			const datasets = [];
			allEvents.forEach((ev, idx) => {
				const data = Array(labels.length).fill(null);
				if (ev.type === "EC") {
					const times = (ev.input.value || "")
						.split(",")
						.map((v) => parseFloat(v))
						.filter((v) => Number.isFinite(v));
					times.forEach((t) => {
						data[idx] = (data[idx] || 0) + 1;
					});
					datasets.push({
						label: ev.name + " (Count)",
						data: data,
						backgroundColor: "rgba(59, 130, 246, 0.6)",
						borderColor: "rgba(37, 99, 235, 1)",
						borderWidth: 2,
						type: "bar",
					});
				} else if (ev.type === "DE") {
					const pairs = (ev.input.value || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.filter((s) => !s.endsWith("..."));
					let totalDuration = 0;
					pairs.forEach((p) => {
						const [s, e] = p.split("-").map(Number);
						if (Number.isFinite(s) && Number.isFinite(e))
							totalDuration += e - s;
					});
					data[idx] = totalDuration;
					datasets.push({
						label: ev.name + " (Total Duration)",
						data: data,
						backgroundColor: "rgba(239, 68, 68, 0.6)",
						borderColor: "rgba(220, 38, 38, 1)",
						borderWidth: 2,
						type: "bar",
					});
				}
			});

			window.observationChartInstance = new Chart(ctx, {
				type: "bar",
				data: {
					labels: labels,
					datasets: datasets,
				},
				options: {
					responsive: true,
					maintainAspectRatio: true,
					plugins: {
						title: {
							display: true,
							text: `Behavioral Observation Summary (Duration: ${Math.floor(
								durationSec / 60
							)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")})`,
							font: { size: 18, weight: "bold" },
						},
						legend: {
							display: true,
							position: "top",
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									const label = context.dataset.label || "";
									const value = context.parsed.y || 0;
									if (label.includes("Count")) {
										return `${label}: ${value} event(s)`;
									} else if (label.includes("Duration")) {
										return `${label}: ${value.toFixed(2)}s`;
									}
									return `${label}: ${value}`;
								},
							},
						},
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: "Count / Duration (seconds)",
								font: { size: 14 },
							},
						},
						x: {
							title: {
								display: true,
								text: "Observation Events",
								font: { size: 14 },
							},
						},
					},
				},
			});

			updateStatus("ready", "Chart displayed");
		});

		document.getElementById("saveData").addEventListener("click", async () => {
			const userId = getCurrentUserId();
			if (!userId) {
				alert("You must be logged in to save data.");
				return;
			}

			const sessionData = {
				user_id: userId,
				events: allEvents.map((e) => ({
					name: e.name,
					key: e.key,
					type: e.type,
					values: e.input.value,
				})),
				videoDuration: player.duration || 0,
				timestamp: new Date().toISOString(),
			};

			try {
				// Save to Supabase database
				const { data, error } = await supabaseClient
					.from("observation_sessions")
					.insert({
						user_id: userId,
						session_data: sessionData,
						video_duration: player.duration || 0,
					})
					.select();

				if (error) throw error;

				alert("Data saved to your account successfully!");
				console.log("Saved session:", data);
			} catch (error) {
				console.error("Save error:", error);
				alert("Error saving data: " + error.message);
			}
		});

		document.getElementById("clearSession").addEventListener("click", () => {
			if (
				!confirm(
					"Are you sure you want to clear all events and start fresh? This will NOT delete saved sessions in the cloud."
				)
			) {
				return;
			}

			// Clear all events
			eventsContainer.innerHTML = "";
			allEvents = [];
			keyBindings = {};
			activeDurations = {};

			// Add back empty state
			eventsContainer.innerHTML = `
				<div class="empty-state">
					<div class="empty-state-icon">🎯</div>
					<p><strong>No events configured yet</strong></p>
					<p>
						Click "Create Event Count" or "Create Duration Event" to
						start tracking behaviors
					</p>
				</div>
			`;

			// Clear the video player
			player.src = "";
			player.removeAttribute("src");
			mediaContainer.style.display = "none";

			// Clear any displayed graphs or analysis
			canvas.style.display = "none";
			analysisContainer.style.display = "none";
			analysisContainer.innerHTML = "";
			exportSVGContainer.style.display = "none";

			if (window.observationChartInstance) {
				window.observationChartInstance.destroy();
			}

			updateStatus("ready", "Session cleared - Ready to start fresh");
		});

		document.getElementById("analysisBtn").addEventListener("click", () => {
			// Check if we have any events with data
			const hasEventData = allEvents.some(
				(e) => e.input.value && e.input.value.trim() !== ""
			);

			if (!hasEventData) {
				alert(
					"No observation data to analyze. Please record some observations first."
				);
				return;
			}

			// If no video loaded, use the stored video duration from session or extract from data
			let durationSec = player.duration;
			if (!durationSec || isNaN(durationSec)) {
				// Try to extract duration from the event data
				durationSec = 0;
				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						if (times.length > 0) {
							durationSec = Math.max(durationSec, Math.max(...times));
						}
					} else if (ev.type === "DE") {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						pairs.forEach((p) => {
							const [s, e] = p.split("-").map(Number);
							if (Number.isFinite(e)) {
								durationSec = Math.max(durationSec, e);
							}
						});
					}
				});

				if (durationSec === 0) {
					durationSec = 60; // Default to 1 minute if we can't determine
				}
			}

			analysisContainer.style.display = "block";
			analysisContainer.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});

			const stats = [];
			allEvents.forEach((ev) => {
				if (ev.type === "EC") {
					const times = (ev.input.value || "")
						.split(",")
						.map((v) => parseFloat(v))
						.filter((v) => Number.isFinite(v));
					const count = times.length;
					const rate = count / (durationSec / 60);
					stats.push({
						name: ev.name,
						type: "Event Count",
						count: count,
						rate: rate.toFixed(2) + " per minute",
						details: times.map((t) => fmt(t) + "s").join(", "),
					});
				} else if (ev.type === "DE") {
					const pairs = (ev.input.value || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.filter((s) => !s.endsWith("..."));
					let totalDuration = 0;
					let count = 0;
					const durations = [];
					pairs.forEach((p) => {
						const [s, e] = p.split("-").map(Number);
						if (Number.isFinite(s) && Number.isFinite(e)) {
							const d = e - s;
							totalDuration += d;
							count++;
							durations.push(d);
						}
					});
					const avgDuration = count > 0 ? totalDuration / count : 0;
					const percentage = (totalDuration / durationSec) * 100;
					stats.push({
						name: ev.name,
						type: "Duration Event",
						count: count,
						totalDuration: totalDuration.toFixed(2) + "s",
						avgDuration: avgDuration.toFixed(2) + "s",
						percentage: percentage.toFixed(1) + "%",
						details: durations.map((d) => d.toFixed(2) + "s").join(", "),
					});
				}
			});

			let html = `
        <div style="margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.5rem;">📊 Detailed Analysis</h3>
          <p style="color: var(--text-secondary);">Session Duration: <strong>${Math.floor(
						durationSec / 60
					)}:${String(Math.floor(durationSec % 60)).padStart(
				2,
				"0"
			)}</strong></p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Type</th>
              <th>Count</th>
              <th>Metrics</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
      `;

			stats.forEach((s) => {
				const metrics =
					s.type === "Event Count"
						? `Rate: ${s.rate}`
						: `Total: ${s.totalDuration}<br>Avg: ${s.avgDuration}<br>% of Session: ${s.percentage}`;
				html += `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.type}</td>
            <td>${s.count}</td>
            <td>${metrics}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${
							s.details || "N/A"
						}</td>
          </tr>
        `;
			});

			html += `
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: center;">
          <button onclick="exportDetailedCSV()" class="btn btn-success">📥 Export Detailed CSV</button>
        </div>
      `;

			analysisContainer.innerHTML = html;

			window.exportDetailedCSV = () => {
				const detailedRows = [
					[
						"Event Name",
						"Event Type",
						"Count/Occurrences",
						"Total Duration (s)",
						"Avg Duration (s)",
						"% of Session",
						"Rate (per min)",
						"Individual Times/Durations",
					],
				];

				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						const count = times.length;
						const rate = count / (durationSec / 60);
						detailedRows.push([
							ev.name,
							"Event Count",
							count,
							"N/A",
							"N/A",
							"N/A",
							rate.toFixed(2),
							times.map((t) => t.toFixed(2)).join("; "),
						]);
					} else if (ev.type === "DE") {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						let totalDuration = 0;
						let count = 0;
						const durationsDetail = [];
						pairs.forEach((p) => {
							const [s, e] = p.split("-").map(Number);
							if (Number.isFinite(s) && Number.isFinite(e)) {
								const duration = e - s;
								totalDuration += duration;
								count++;
								const start = s;
								const end = e;
								durationsDetail.push([
									duration.toFixed(2),
									start.toFixed(2),
									end.toFixed(2),
								]);
							}
						});
						const avgDuration = count > 0 ? totalDuration / count : 0;
						const percentage = (totalDuration / durationSec) * 100;
						detailedRows.push([
							ev.name,
							"Duration",
							count,
							totalDuration.toFixed(2),
							avgDuration.toFixed(2),
							percentage.toFixed(1),
							"N/A",
							durationsDetail
								.map(([dur, start, end]) => `${dur}s (${start}s-${end}s)`)
								.join("; "),
						]);
					}
				});

				detailedRows.push([]);
				detailedRows.push(["Detailed Event Log"]);
				detailedRows.push([
					"Event Name",
					"Type",
					"Occurrence #",
					"Duration (s)",
					"Start Time (s)",
					"End Time (s)",
				]);

				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						times.forEach((t, idx) => {
							detailedRows.push([
								ev.name,
								"Event Count",
								idx + 1,
								"N/A",
								t.toFixed(2),
								"N/A",
							]);
						});
					} else if (ev.type === "DE") {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						pairs.forEach((p, idx) => {
							const [s, e] = p.split("-").map(Number);
							if (Number.isFinite(s) && Number.isFinite(e)) {
								const duration = e - s;
								const start = s;
								const end = e;
								detailedRows.push([
									ev.name,
									"Duration",
									idx + 1,
									duration.toFixed(2),
									start.toFixed(2),
									end.toFixed(2),
								]);
							}
						});
					}
				});

				const csvContent = detailedRows
					.map((row) => row.map((cell) => `"${cell}"`).join(","))
					.join("\n");
				const blob = new Blob(["\uFEFF" + csvContent], {
					type: "text/csv;charset=utf-8;",
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `detailed_observation_data_${
					new Date().toISOString().split("T")[0]
				}.csv`;
				a.click();
				URL.revokeObjectURL(url);
			};
		});

		document.getElementById("exportSVG").addEventListener("click", () => {
			// Check if we have any events with data
			const hasEventData = allEvents.some(
				(e) => e.input.value && e.input.value.trim() !== ""
			);

			if (!hasEventData) {
				alert(
					"No observation data to export. Please record some observations first."
				);
				return;
			}

			// If no video loaded, extract duration from the event data
			let durationSec = player.duration;
			if (!durationSec || isNaN(durationSec)) {
				durationSec = 0;
				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						if (times.length > 0) {
							durationSec = Math.max(durationSec, Math.max(...times));
						}
					} else if (ev.type === "DE") {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						pairs.forEach((p) => {
							const [s, e] = p.split("-").map(Number);
							if (Number.isFinite(e)) {
								durationSec = Math.max(durationSec, e);
							}
						});
					}
				});

				if (durationSec === 0) {
					alert("Cannot determine video duration from observation data.");
					return;
				}
			}
			const labels = allEvents.length
				? allEvents.map((e) => e.name)
				: ["No Observations"];
			const ec = [];
			const de = [];

			allEvents.forEach((ev) => {
				if (ev.type === "EC") {
					const times = (ev.input.value || "")
						.split(",")
						.map((v) => parseFloat(v))
						.filter((v) => Number.isFinite(v));
					times.forEach((t) => ec.push({ time: t, name: ev.name }));
				} else if (ev.type === "DE") {
					const pairs = (ev.input.value || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.filter((s) => !s.endsWith("..."));
					pairs.forEach((p) => {
						const [s, e] = p.split("-").map(Number);
						if (Number.isFinite(s) && Number.isFinite(e))
							de.push({ start: s, end: e, name: ev.name });
					});
				}
			});

			const W = 1200,
				H = 600;
			const M = { left: 150, right: 40, top: 60, bottom: 80 };
			const innerW = W - M.left - M.right;
			const innerH = H - M.top - M.bottom;

			const xFor = (t) => M.left + (t / durationSec) * innerW;
			const yForName = (name) => {
				const idx = Math.max(0, labels.indexOf(name));
				const step = innerH / (labels.length || 1);
				return M.top + step * idx + step / 2;
			};

			const yStep = innerH / (labels.length || 1);

			function niceStep(max, target = 10) {
				const raw = max / target;
				const bases = [1, 2, 5];
				const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
				for (const b of bases) {
					const step = b * pow;
					if (raw <= step) return step;
				}
				return 10 * pow;
			}

			const step = Math.max(1, niceStep(durationSec));
			const fmtTick = (v) =>
				`${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;

			let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
  </filter>
</defs>

<rect width="${W}" height="${H}" fill="#ffffff" stroke="none"/>

<text x="${
				W / 2
			}" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="20" fill="#1e293b" text-anchor="middle">Behavioral Observation Analysis</text>
<text x="${
				W / 2
			}" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Duration: ${fmtTick(
				durationSec
			)} | Generated: ${new Date().toLocaleDateString()}</text>`;

			// Grid lines and tick labels
			for (let v = 0; v <= durationSec + 0.0001; v += step) {
				const x = xFor(Math.min(v, durationSec));
				svg += `<line x1="${x}" y1="${M.top}" x2="${x}" y2="${
					H - M.bottom
				}" stroke="#e2e8f0" stroke-width="1"/>`;
				svg += `<text x="${x}" y="${
					H - M.bottom + 20
				}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">${fmtTick(
					v
				)}</text>`;
			}

			// Horizontal grid lines and event labels
			for (let i = 0; i < labels.length; i++) {
				const y = M.top + yStep * i + yStep / 2;
				svg += `<line x1="${M.left}" y1="${y}" x2="${
					W - M.right
				}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
				svg += `<text x="${
					M.left - 10
				}" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#374151" text-anchor="end" dominant-baseline="middle">${
					labels[i]
				}</text>`;
			}

			// Main axes
			svg += `<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${
				H - M.bottom
			}" stroke="#94a3b8" stroke-width="2"/>`;
			svg += `<line x1="${M.left}" y1="${H - M.bottom}" x2="${
				W - M.right
			}" y2="${H - M.bottom}" stroke="#94a3b8" stroke-width="2"/>`;

			// Axis labels
			svg += `<text x="${(M.left + W - M.right) / 2}" y="${
				H - 10
			}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#475569" text-anchor="middle">Time (min:sec)</text>`;
			svg += `<text x="20" y="${
				(M.top + H - M.bottom) / 2
			}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#475569" text-anchor="middle" transform="rotate(-90, 20, ${
				(M.top + H - M.bottom) / 2
			})">Observation Events</text>`;

			// Duration events (bars) - with explicit styling
			de.forEach(({ start, end, name }) => {
				const x1 = xFor(start),
					x2 = xFor(end),
					y = yForName(name);
				const h = Math.min(30, yStep * 0.6);
				const width = Math.max(2, x2 - x1);
				svg += `<rect x="${x1}" y="${
					y - h / 2
				}" width="${width}" height="${h}" fill="#ef4444" fill-opacity="0.7" stroke="#dc2626" stroke-width="1" filter="url(#shadow)"/>`;

				if (width > 40) {
					const duration = (end - start).toFixed(1);
					svg += `<text x="${
						(x1 + x2) / 2
					}" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#374151" text-anchor="middle" dominant-baseline="middle">${duration}s</text>`;
				}
			});

			// Event count points - with explicit styling
			ec.forEach(({ time, name }) => {
				svg += `<circle cx="${xFor(time)}" cy="${yForName(
					name
				)}" r="6" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2" filter="url(#shadow)"/>`;
			});

			// Legend
			if (ec.length > 0 || de.length > 0) {
				const legendY = H - 25;
				let legendX = M.left;

				svg += `<rect x="${legendX}" y="${
					legendY - 15
				}" width="200" height="30" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="4"/>`;

				if (ec.length > 0) {
					svg += `<circle cx="${
						legendX + 15
					}" cy="${legendY}" r="6" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/>`;
					svg += `<text x="${
						legendX + 30
					}" y="${legendY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#374151" dominant-baseline="middle">Event Count</text>`;
					legendX += 110;
				}

				if (de.length > 0) {
					svg += `<rect x="${legendX + 10}" y="${
						legendY - 4
					}" width="20" height="8" fill="#ef4444" fill-opacity="0.7" stroke="#dc2626" stroke-width="1"/>`;
					svg += `<text x="${
						legendX + 40
					}" y="${legendY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#374151" dominant-baseline="middle">Duration</text>`;
				}
			}

			// Copyright notice
			svg += `<text x="${W - 10}" y="${
				H - 5
			}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b" text-anchor="end">© 2025 Georgios Hoplaros, PhD</text>`;

			svg += `</svg>`;

			const blob = new Blob([svg], {
				type: "image/svg+xml;charset=utf-8",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `professional_observation_chart_${
				new Date().toISOString().split("T")[0]
			}.svg`;
			a.click();
			URL.revokeObjectURL(url);

			updateStatus("ready", "Professional SVG chart exported");
		});

		// My Sessions functionality
		document
			.getElementById("mySessions")
			.addEventListener("click", async () => {
				await showSessionsModal();
			});
	});
}

// My Sessions Modal Functions (outside DOMContentLoaded)
async function showSessionsModal() {
	const userId = getCurrentUserId();
	if (!userId) {
		alert("You must be logged in to view your sessions.");
		return;
	}

	const modal = document.getElementById("sessionsModal");
	const container = document.getElementById("sessionsListContainer");
	modal.style.display = "flex";
	container.innerHTML =
		'<p style="text-align: center; color: #64748b;">Loading sessions...</p>';

	try {
		const { data: sessions, error } = await supabaseClient
			.from("observation_sessions")
			.select("*")
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		if (!sessions || sessions.length === 0) {
			container.innerHTML = `
				<div style="text-align: center; padding: 40px; color: #64748b;">
					<div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;">📋</div>
					<p><strong>No saved sessions yet</strong></p>
					<p>Create some observations and click "Save Data" to save your first session.</p>
				</div>
			`;
			return;
		}

		// Display sessions
		let html = "";
		sessions.forEach((session, index) => {
			const date = new Date(session.created_at);
			const dateStr = date.toLocaleDateString();
			const timeStr = date.toLocaleTimeString();
			const duration = session.video_duration
				? `${Math.floor(session.video_duration / 60)}:${String(
						Math.floor(session.video_duration % 60)
				  ).padStart(2, "0")}`
				: "N/A";
			const eventCount = session.session_data?.events?.length || 0;

			html += `
				<div class="session-card">
					<div class="session-card-header">
						<div>
							<h3 class="session-card-title">Session ${sessions.length - index}</h3>
							<div class="session-card-date">${dateStr} at ${timeStr}</div>
						</div>
					</div>
					<div class="session-card-info">
						<span>📊 <strong>${eventCount}</strong> events tracked</span>
						<span>⏱️ Duration: <strong>${duration}</strong></span>
					</div>
					<div class="session-card-actions">
						<button class="btn btn-primary" onclick="loadSessionById('${session.id}')">
							📂 Load Session
						</button>
						<button class="btn btn-secondary" onclick="deleteSession('${
							session.id
						}')" style="background: var(--danger-color);">
							🗑️ Delete
						</button>
					</div>
				</div>
			`;
		});

		container.innerHTML = html;
	} catch (error) {
		console.error("Error loading sessions:", error);
		container.innerHTML = `
			<div style="text-align: center; padding: 40px; color: #dc2626;">
				<p><strong>Error loading sessions</strong></p>
				<p>${error.message}</p>
			</div>
		`;
	}
}

function closeSessionsModal() {
	document.getElementById("sessionsModal").style.display = "none";
}

async function loadSessionById(sessionId) {
	try {
		const { data: session, error } = await supabaseClient
			.from("observation_sessions")
			.select("*")
			.eq("id", sessionId)
			.single();

		if (error) throw error;

		// Clear existing events
		const eventsContainer = document.getElementById("eventsContainer");
		eventsContainer.innerHTML = "";
		window.allEvents = [];
		window.keyBindings = {};
		window.activeDurations = {};

		// Load the session data
		const sessionData = session.session_data;
		sessionData.events.forEach((e) => {
			window.createEventRow(e.name, e.key, e.type, e.values);
		});

		closeSessionsModal();

		// Check if a video is loaded
		const player = document.getElementById("player");
		if (!player.src || player.src === window.location.href) {
			alert(
				"Session loaded successfully!\n\n⚠️ Please load your video file to continue working with this session."
			);
		} else {
			alert(
				"Session loaded successfully!\n\nℹ️ Make sure you have the correct video file loaded for this session."
			);
		}
	} catch (error) {
		console.error("Error loading session:", error);
		alert("Error loading session: " + error.message);
	}
}

async function deleteSession(sessionId) {
	if (
		!confirm(
			"Are you sure you want to delete this session? This cannot be undone."
		)
	) {
		return;
	}

	try {
		const { error } = await supabaseClient
			.from("observation_sessions")
			.delete()
			.eq("id", sessionId);

		if (error) throw error;

		alert("Session deleted successfully!");
		await showSessionsModal(); // Refresh the list
	} catch (error) {
		console.error("Error deleting session:", error);
		alert("Error deleting session: " + error.message);
	}
}

// Make createEventRow globally accessible
window.createEventRow = null;
window.allEvents = [];
window.keyBindings = {};
window.activeDurations = {};
