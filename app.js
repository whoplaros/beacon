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
