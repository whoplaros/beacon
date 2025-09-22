// app.js
async function uploadVideo() {
	const file = document.getElementById("fileInput").files[0];
	const userId = "test-user-id"; // replace with auth user later

	const filePath = `${userId}/${file.name}`;

	const { data, error } = await supabase.storage
		.from("videos")
		.upload(filePath, file);

	if (error) {
		alert("Upload failed: " + error.message);
		return;
	}

	// Insert into videos table
	await supabase.from("videos").insert({
		user_id: userId,
		title: file.name,
		upload_url: filePath,
	});

	alert("Upload complete!");
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
					? "Timestamps will appear here..."
					: "Duration ranges will appear here...";

			row.appendChild(keybtn);
			row.appendChild(label);
			row.appendChild(typeBadge);
			row.appendChild(input);
			eventsContainer.appendChild(row);

			const keyLower = key.toLowerCase();
			const ev = { name, type, key: keyLower, input };
			allEvents.push(ev);

			function recordTime() {
				if (!player.duration || isNaN(player.duration)) {
					alert("Please load a media file first!");
					return;
				}

				const t = fmt(player.currentTime);

				if (type === "EC") {
					keybtn.style.background = "#059669";
					setTimeout(() => (keybtn.style.background = ""), 200);
					let arr = input.value
						? input.value
								.split(",")
								.map((v) => v.trim())
								.filter(Boolean)
						: [];
					if (!arr.includes(t)) arr.push(t);
					arr = arr
						.map(Number)
						.sort((a, b) => a - b)
						.map((n) => n.toFixed(2));
					input.value = arr.join(", ");
					updateStatus("recording", `Event recorded at ${t}s`);
					setTimeout(() => updateStatus("ready", "Ready to track"), 1500);
				} else {
					if (activeDurations[keyLower]) {
						keybtn.style.background = "#dc2626";
						setTimeout(() => (keybtn.style.background = ""), 200);

						const start = activeDurations[keyLower];
						delete activeDurations[keyLower];
						const end = t;
						let parts = input.value
							? input.value
									.split(",")
									.map((v) => v.trim())
									.filter(Boolean)
							: [];
						const placeholder = `${start}-...`;
						const idx = parts.lastIndexOf(placeholder);
						const pair = `${start}-${end}`;
						if (idx !== -1) parts[idx] = pair;
						else parts.push(pair);
						parts.sort(
							(a, b) =>
								parseFloat(a.split("-")[0]) - parseFloat(b.split("-")[0])
						);
						input.value = parts.join(", ");
						updateStatus(
							"recording",
							`Duration ended: ${(end - start).toFixed(2)}s`
						);
						setTimeout(() => updateStatus("ready", "Ready to track"), 1500);
					} else {
						keybtn.style.background = "#d97706";
						setTimeout(() => (keybtn.style.background = ""), 200);

						activeDurations[keyLower] = t;
						let parts = input.value
							? input.value
									.split(",")
									.map((v) => v.trim())
									.filter(Boolean)
							: [];
						parts.push(`${t}-...`);
						input.value = parts.join(", ");
						updateStatus("recording", `Duration started at ${t}s`);
					}
				}
			}

			keybtn.addEventListener("click", recordTime);
			keyBindings[keyLower] = recordTime;
		}

		document.getElementById("createEC").addEventListener("click", () => {
			const name = prompt(
				'Enter Event Count name (e.g., "Button Press", "Jump", etc.):'
			);
			if (!name) return;
			const key = prompt(
				"Enter key to assign (single letter or number, cannot be space):"
			);
			if (!key || key.trim() === "" || key === " " || key.length > 1) {
				alert("Please enter a single letter or number (not space)");
				return;
			}
			if (keyBindings[key.toLowerCase()]) {
				alert("This key is already assigned to another event!");
				return;
			}
			createEventRow(name, key, "EC");
		});

		document.getElementById("createDE").addEventListener("click", () => {
			const name = prompt(
				'Enter Duration Event name (e.g., "Walking", "Talking", etc.):'
			);
			if (!name) return;
			const key = prompt(
				"Enter key to assign (single letter or number, cannot be space):"
			);
			if (!key || key.trim() === "" || key === " " || key.length > 1) {
				alert("Please enter a single letter or number (not space)");
				return;
			}
			if (keyBindings[key.toLowerCase()]) {
				alert("This key is already assigned to another event!");
				return;
			}
			createEventRow(name, key, "DE");
		});

		document.addEventListener("keydown", (e) => {
			if (e.code === "Space") return;
			const k = e.key.toLowerCase();
			if (keyBindings[k]) {
				e.preventDefault();
				keyBindings[k]();
			}
		});

		const durationBarsPlugin = {
			id: "durationBarsPlugin",
			afterDatasetsDraw(chart) {
				const ctx = chart.ctx;
				const xScale = chart.scales.x;
				const yScale = chart.scales.y;
				ctx.save();
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.font =
					'12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

				graphBars.forEach((bar) => {
					let y = yScale.getPixelForValue(bar.name);
					if (Number.isNaN(y)) y = yScale.getPixelForValue(0);
					const xStart = xScale.getPixelForValue(bar.start);
					const xEnd = xScale.getPixelForValue(bar.end);
					const height = 28;

					const gradient = ctx.createLinearGradient(
						xStart,
						y - height / 2,
						xEnd,
						y + height / 2
					);
					gradient.addColorStop(0, "rgba(239, 68, 68, 0.7)");
					gradient.addColorStop(1, "rgba(239, 68, 68, 0.4)");

					ctx.fillStyle = gradient;
					ctx.strokeStyle = "#dc2626";
					ctx.lineWidth = 1;
					const width = Math.max(2, xEnd - xStart);
					ctx.fillRect(xStart, y - height / 2, width, height);
					ctx.strokeRect(xStart, y - height / 2, width, height);

					ctx.fillStyle = "#1e293b";
					ctx.font =
						'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
					const textWidth = ctx.measureText(bar.name).width;
					if (textWidth < width - 10) {
						ctx.fillText(bar.name, (xStart + xEnd) / 2, y);
					}
				});

				ctx.fillStyle = "#64748b";
				ctx.font =
					'10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
				ctx.textAlign = "right";
				ctx.textBaseline = "bottom";
				ctx.fillText(
					"© 2025 Georgios Hoplaros, PhD",
					chart.width - 10,
					chart.height - 5
				);

				ctx.restore();
			},
		};

		document.getElementById("showGraph").addEventListener("click", () => {
			if (!player.duration || isNaN(player.duration)) {
				alert("Please load a video/audio file and wait for metadata.");
				return;
			}

			const durationSec = player.duration;
			const labels = allEvents.length
				? allEvents.map((e) => e.name)
				: ["No Observations"];
			const datasets = [];
			graphBars = [];
			ecPoints = [];

			allEvents.forEach((ev) => {
				if (ev.type === "EC") {
					const times = (ev.input.value || "")
						.split(",")
						.map((v) => parseFloat(v))
						.filter((v) => Number.isFinite(v));
					times.forEach((t) => ecPoints.push({ time: t, name: ev.name }));
					if (times.length) {
						datasets.push({
							label: ev.name,
							parsing: false,
							data: times.map((t) => ({ x: t, y: ev.name })),
							backgroundColor: "#3b82f6",
							borderColor: "#1d4ed8",
							pointRadius: 6,
							pointHoverRadius: 8,
							showLine: false,
						});
					}
				} else if (ev.type === "DE") {
					const pairs = (ev.input.value || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.filter((s) => !s.endsWith("..."));
					pairs.forEach((p) => {
						const [s, e] = p.split("-").map(Number);
						if (Number.isFinite(s) && Number.isFinite(e))
							graphBars.push({ start: s, end: e, name: ev.name });
					});
				}
			});

			if (datasets.length === 0) {
				datasets.push({
					label: "placeholder",
					parsing: false,
					data: [{ x: 0, y: labels[0] }],
					pointRadius: 0,
					showLine: false,
				});
			}

			const ctx = canvas.getContext("2d");
			if (
				window.observationChart &&
				typeof window.observationChart.destroy === "function"
			) {
				window.observationChart.destroy();
			}

			canvas.style.display = "block";

			window.observationChart = new Chart(ctx, {
				type: "scatter",
				data: { datasets },
				options: {
					responsive: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							backgroundColor: "rgba(0, 0, 0, 0.8)",
							titleColor: "#ffffff",
							bodyColor: "#ffffff",
							borderColor: "#3b82f6",
							borderWidth: 1,
						},
					},
					scales: {
						x: {
							type: "linear",
							min: 0,
							max: durationSec,
							ticks: {
								callback: (v) =>
									`${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(
										2,
										"0"
									)}`,
								color: "#64748b",
							},
							title: {
								display: true,
								text: "Time (min:sec)",
								color: "#1e293b",
								font: { weight: "bold" },
							},
							grid: {
								color: "#e2e8f0",
							},
						},
						y: {
							type: "category",
							labels,
							title: {
								display: true,
								text: "Observations",
								color: "#1e293b",
								font: { weight: "bold" },
							},
							grid: {
								color: "#e2e8f0",
							},
							ticks: {
								color: "#64748b",
							},
						},
					},
				},
				plugins: [durationBarsPlugin],
			});
		});

		document.getElementById("saveData").addEventListener("click", () => {
			const data = allEvents.map((ev) => ({
				name: ev.name,
				type: ev.type,
				key: ev.key,
				values: ev.input.value,
			}));
			const blob = new Blob([JSON.stringify({ events: data }, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `observation_data_${
				new Date().toISOString().split("T")[0]
			}.json`;
			a.click();
			URL.revokeObjectURL(url);
			updateStatus("ready", "Data saved successfully");
		});

		document.getElementById("loadData").addEventListener("click", () => {
			const inp = document.createElement("input");
			inp.type = "file";
			inp.accept = "application/json";
			inp.onchange = (e) => {
				const file = e.target.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => {
					try {
						const parsed = JSON.parse(reader.result);
						eventsContainer.innerHTML = "";
						allEvents = [];
						keyBindings = {};
						activeDurations = {};
						(parsed.events || []).forEach((ev) => {
							createEventRow(ev.name, ev.key, ev.type, ev.values || "");
						});
						updateStatus("ready", "Data loaded successfully");
					} catch {
						alert("Invalid JSON file.");
					}
				};
				reader.readAsText(file);
			};
			inp.click();
		});

		document.getElementById("analysisBtn").addEventListener("click", () => {
			if (!player.duration || isNaN(player.duration)) {
				alert("Please load a video/audio file first.");
				return;
			}

			const durationSec = player.duration;
			let html =
				'<div class="section-title">📈 Observation Data Analysis</div>';
			html +=
				"<table><tr><th>Event Name</th><th>Type</th><th>Total Count</th><th>Total Duration (s)</th><th>Mean Duration (s)</th><th>% of Total Time</th><th>Rate per Minute</th></tr>";

			const rows = [];
			let totalEvents = 0;

			allEvents.forEach((ev) => {
				const name = ev.name;
				const type = ev.type;

				if (type === "EC") {
					const times = (ev.input.value || "")
						.split(",")
						.map((v) => v.trim())
						.filter(Boolean);
					const count = times.length;
					totalEvents += count;
					const rate =
						durationSec > 0 ? ((count / durationSec) * 60).toFixed(2) : "0.00";
					rows.push([name, "Event Count", count, "-", "-", "-", rate]);
				} else {
					const pairs = (ev.input.value || "")
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
						.filter((s) => !s.endsWith("..."));
					let totalDur = 0;
					pairs.forEach((p) => {
						const [s, e] = p.split("-").map(Number);
						if (Number.isFinite(s) && Number.isFinite(e)) totalDur += e - s;
					});
					const count = pairs.length;
					totalEvents += count;
					const meanDur = count > 0 ? totalDur / count : 0;
					const perc = totalDur > 0 ? (totalDur / durationSec) * 100 : 0;
					const rate =
						durationSec > 0 ? ((count / durationSec) * 60).toFixed(2) : "0.00";
					rows.push([
						name,
						"Duration",
						count,
						totalDur.toFixed(2),
						meanDur.toFixed(2),
						perc.toFixed(2) + "%",
						rate,
					]);
				}
			});

			rows.forEach((r) => {
				html += `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`;
			});
			html += "</table>";

			html +=
				'<div style="margin-top: 24px; padding: 20px; background: var(--bg-primary); border-radius: 8px; border-left: 4px solid var(--primary-color);">';
			html +=
				'<h3 style="margin: 0 0 12px 0; color: var(--primary-color);">📊 Summary Statistics</h3>';
			html += `<p><strong>Total Media Duration:</strong> ${Math.floor(
				durationSec / 60
			)}:${String(Math.floor(durationSec % 60)).padStart(
				2,
				"0"
			)} (${durationSec.toFixed(1)}s)</p>`;
			html += `<p><strong>Total Events Recorded:</strong> ${totalEvents}</p>`;
			html += `<p><strong>Event Types Configured:</strong> ${allEvents.length}</p>`;
			html += `<p><strong>Overall Event Rate:</strong> ${
				durationSec > 0 ? ((totalEvents / durationSec) * 60).toFixed(2) : "0.00"
			} events per minute</p>`;
			html += "</div>";

			html += '<div style="margin-top: 16px; display: flex; gap: 12px;">';
			html +=
				'<button id="exportCSV" class="btn btn-success">📊 Export CSV</button>';
			html +=
				'<button id="exportDetailedCSV" class="btn btn-warning">📋 Export Detailed CSV</button>';
			html += "</div>";

			html +=
				'<div style="text-align: center; margin-top: 20px; padding: 10px; color: var(--text-secondary); font-size: 0.75rem; border-top: 1px solid var(--border-color);">&copy; 2025 Georgios Hoplaros, PhD</div>';

			analysisContainer.innerHTML = html;
			analysisContainer.style.display = "block";

			document.getElementById("exportCSV").onclick = () => {
				const csvRows = [
					[
						"Event Name",
						"Type",
						"Total Count",
						"Total Duration (s)",
						"Mean Duration (s)",
						"% of Total Time",
						"Rate per Minute",
					],
				];
				rows.forEach((r) => csvRows.push(r));
				const csvContent = csvRows
					.map((row) => row.map((cell) => `"${cell}"`).join(","))
					.join("\n");
				const blob = new Blob(["\uFEFF" + csvContent], {
					type: "text/csv;charset=utf-8;",
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `observation_analysis_${
					new Date().toISOString().split("T")[0]
				}.csv`;
				a.click();
				URL.revokeObjectURL(url);
			};

			document.getElementById("exportDetailedCSV").onclick = () => {
				const detailedRows = [
					[
						"Event Name",
						"Type",
						"Timestamp (s)",
						"Duration (s)",
						"Start Time (s)",
						"End Time (s)",
					],
				];

				allEvents.forEach((ev) => {
					if (ev.type === "EC") {
						const times = (ev.input.value || "")
							.split(",")
							.map((v) => parseFloat(v))
							.filter((v) => Number.isFinite(v));
						times.forEach((t) => {
							detailedRows.push([
								ev.name,
								"Event Count",
								t.toFixed(2),
								"-",
								"-",
								"-",
							]);
						});
					} else {
						const pairs = (ev.input.value || "")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
							.filter((s) => !s.endsWith("..."));
						pairs.forEach((p) => {
							const [start, end] = p.split("-").map(Number);
							if (Number.isFinite(start) && Number.isFinite(end)) {
								const duration = end - start;
								detailedRows.push([
									ev.name,
									"Duration",
									"-",
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
			if (!player.duration || isNaN(player.duration)) {
				alert("Please load a video/audio file first.");
				return;
			}

			const durationSec = player.duration;
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
	});
}
