# iOS App Assets Generation Guide

This guide helps you create all the required assets for your Chat GitHub iOS app.

## Required Assets Overview

### App Icons
- **192x192px** (`icon-192.png`) - PWA icon
- **512x512px** (`icon-512.png`) - PWA icon
- **1024x1024px** (`icon-1024.png`) - App Store icon

### Screenshots
- **iPhone 14 Pro**: 1290x2796px
- **iPhone 13 Pro**: 1170x2532px  
- **iPad Pro**: 2048x2732px

### Splash Screens (Optional)
- **iPhone 8**: 750x1334px
- **iPhone X**: 1125x2436px

## Icon Design Guidelines

### Design Requirements
- Use your app's primary visual identity
- Ensure readability at small sizes
- Follow Apple's design guidelines
- Avoid text in icons (use symbols/imagery)

### Suggested Icon Design
```
🎯 Primary Element: Terminal/CLI symbol (⌨️ 💻)
🎨 Color Scheme: Dark background (#000000) with accent colors
📱 Style: Modern, clean, recognizable
```

### Icon Creation Tools
- **Online**: Figma, Canva, Adobe Express
- **Desktop**: Sketch, Adobe Illustrator, Photoshop
- **Free**: GIMP, Inkscape

## Automated Asset Generation

### Using PWA Asset Generator
```bash
# Install PWA Asset Generator
npm install -g pwa-asset-generator

# Generate all icons and splash screens from a single source
pwa-asset-generator source-icon.png public --manifest public/manifest.webmanifest
```

### Using Capacitor Assets
```bash
# Install Capacitor Assets plugin
npm install @capacitor/assets --save-dev

# Generate from a single source image (1024x1024)
npx capacitor-assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
```

## Manual Asset Creation

### 1. Create Base Icon (1024x1024)
Create your main app icon at 1024x1024 pixels:

```
Recommended tools:
- Figma: Free, web-based
- Sketch: macOS design tool
- Adobe Illustrator: Professional vector tool
```

### 2. Generate Required Sizes
Use online tools or scripts to generate required sizes:

**Online Tools:**
- [App Icon Generator](https://appicon.co)
- [PWA Icon Generator](https://tools.crawlora.com/pwa-icon-generator)
- [Icons8 Iconizer](https://icons8.com/iconizer)

### 3. Create Screenshots

#### Taking Screenshots
1. Build and run your PWA
2. Open in device simulators:
   - Chrome DevTools (mobile view)
   - iOS Simulator (if on Mac)
   - Physical device

#### Screenshot Requirements
- Show your app's main features
- Use realistic content (not placeholder text)
- Include Chinese language interface
- Demonstrate core functionality:
  - CLI interface
  - Editor mode
  - GitHub integration
  - AI features

### 4. Create Splash Screens (Optional)
Simple splash screen with:
- App logo/icon
- App name: "Chat GitHub"
- Clean background
- Loading indicator (optional)

## File Organization

Create the following structure:
```
public/
├── icon-192.png          # PWA icon (192x192)
├── icon-512.png          # PWA icon (512x512)
├── icon-1024.png         # App Store icon (1024x1024)
├── splash-iphone.png     # iPhone 8 splash (750x1334)
├── splash-iphone-x.png   # iPhone X splash (1125x2436)
└── screenshot-mobile.png # App screenshot (390x844)
```

## Asset Validation

### Check Icon Quality
- [ ] Icons are crisp at all sizes
- [ ] No pixelation or blurriness
- [ ] Consistent visual style
- [ ] Proper transparency/backgrounds
- [ ] Follows Apple guidelines

### Test Screenshots
- [ ] Show real app functionality
- [ ] High resolution and clarity
- [ ] Represent actual user experience
- [ ] Include Chinese text examples
- [ ] Demonstrate key features

## Apple App Store Guidelines

### Icon Requirements
- No transparency (for App Store icon)
- No Apple hardware representations
- No other mobile app icons
- High-quality artwork
- Consistent visual treatment

### Screenshot Requirements
- Actual app screenshots only
- No marketing overlays
- Text must be legible
- Show core functionality
- Multiple device sizes

## Quality Checklist

### Before Submission
- [ ] All icons generated and placed correctly
- [ ] Screenshots taken on required device sizes
- [ ] Assets follow Apple guidelines
- [ ] Visual consistency across all assets
- [ ] High-resolution, professional quality
- [ ] Files properly named and organized

### Testing
- [ ] Test PWA installation with new icons
- [ ] Verify splash screens display correctly
- [ ] Check icon appearance on various backgrounds
- [ ] Test on actual iOS devices
- [ ] Validate with App Store Connect

## Asset Sources

### Design Inspiration
- Apple's Human Interface Guidelines
- Existing developer tools apps
- Terminal/CLI applications
- Code editor applications

### Stock Resources (if needed)
- [Unsplash](https://unsplash.com) - Free photos
- [Icons8](https://icons8.com) - Icons and illustrations
- [Figma Community](https://figma.com/community) - Templates
- [Apple Design Resources](https://developer.apple.com/design/resources/)

## Automation Script

Create a simple automation script:

```bash
#!/bin/bash
# generate-assets.sh

echo "🎨 Generating iOS app assets..."

# Check if source icon exists
if [ ! -f "assets/source-icon.png" ]; then
    echo "❌ Create assets/source-icon.png (1024x1024) first"
    exit 1
fi

# Generate icons using ImageMagick (if installed)
if command -v convert &> /dev/null; then
    convert assets/source-icon.png -resize 192x192 public/icon-192.png
    convert assets/source-icon.png -resize 512x512 public/icon-512.png
    cp assets/source-icon.png public/icon-1024.png
    echo "✅ Icons generated"
else
    echo "⚠️  Install ImageMagick for automatic icon generation"
fi

echo "🎉 Asset generation complete!"
```

## Support

For assistance with asset creation:
1. Check Apple's official guidelines
2. Use online asset generators
3. Consult design communities
4. Consider hiring a designer for professional assets

Remember: Quality assets significantly impact user adoption and App Store approval success!