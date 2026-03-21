// ─────────────────────────────────────────────────────
// One-time script to create Cloudinary upload preset
// Run: npx tsx scripts/setup-cloudinary.ts
// ─────────────────────────────────────────────────────
import "dotenv/config"
import { v2 as cloudinary } from "cloudinary"

async function setupCloudinary() {
  console.log("☁️  Setting up Cloudinary upload preset...")
  console.log(`   Cloud name: ${cloudinary.config().cloud_name}`)

  try {
    // Check if preset already exists
    try {
      await cloudinary.api.upload_preset("fithub_unsigned")
      console.log("✅ Upload preset 'fithub_unsigned' already exists")
      return
    } catch {
      // Preset doesn't exist, create it
    }

    // Create unsigned upload preset
    const result = await cloudinary.api.create_upload_preset({
      name: "fithub_unsigned",
      unsigned: true,
      folder: "fithub",
      allowed_formats: "jpg,jpeg,png,webp,heic,mp4,mov,gif",
      max_file_size: 104857600, // 100MB
      transformation: [
        { quality: "auto", fetch_format: "auto" },
      ],
    })

    console.log("✅ Upload preset created:", result.name)
    console.log("   Mode: unsigned (safe for mobile)")
    console.log("   Folder: fithub/")
    console.log("   Max size: 100MB")
    console.log("   Formats: jpg, png, webp, heic, mp4, mov, gif")
  } catch (error: any) {
    console.error("❌ Error:", error.message || error)
  }
}

setupCloudinary()
