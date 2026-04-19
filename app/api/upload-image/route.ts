import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData, folder, fileName } = body;

    if (!imageData || !folder || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`Uploading to Cloudinary: ${folder}/${fileName}`);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(imageData, {
      folder: `job-completions/${folder}`,
      public_id: fileName,
      resource_type: 'auto', // Automatically detect file type
      quality: 'auto', // Automatic quality optimization
      fetch_format: 'auto', // Automatic format optimization
    });

    console.log('Cloudinary upload successful:', result.secure_url);

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
} 