# Aspose Cloud API Setup

## Environment Variables Required

Add these environment variables to your Render deployment:

### Required Variables:
- `ASPOSE_CLIENT_ID`: Your Aspose Cloud Client ID
- `ASPOSE_CLIENT_SECRET`: Your Aspose Cloud Client Secret

## How to Set Environment Variables on Render:

1. Go to your Render dashboard
2. Select your service
3. Go to "Environment" tab
4. Add these variables:
   - Key: `ASPOSE_CLIENT_ID`, Value: [Your Client ID]
   - Key: `ASPOSE_CLIENT_SECRET`, Value: [Your Client Secret]
5. Save and redeploy

## What This Does:

- ✅ Converts PPTX slides to PNG images with NO watermarks
- ✅ Perfect rendering of all slide content (text, images, charts)
- ✅ Works on Render without Docker or system packages
- ✅ Uses your paid Aspose Cloud subscription
- ✅ Automatically cleans up uploaded files

## Testing:

After deployment, your slide conversion will work automatically. The system will:
1. Upload PPTX to Aspose Cloud
2. Convert each slide to PNG
3. Download images locally
4. Clean up cloud files
5. Use images in video generation

No additional configuration needed!
