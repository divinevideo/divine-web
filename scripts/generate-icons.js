#!/usr/bin/env node

/**
 * Generate PWA icons from app_icon.avif
 * 
 * This script creates:
 * - Regular icons for general use (favicon, apple-touch-icon, etc.)
 * - Maskable icons with green circular backgrounds for PWA safe zones
 * 
 * Maskable icons scale your original design to 70% and center it on a green
 * circular background (using app theme color #00b488), ensuring it displays 
 * properly when the system applies masks without cropping your design.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '../public/app_icon.avif');
const outputDir = path.join(__dirname, '../public');

// Icon sizes needed
const iconSizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' }
];

// Dedicated maskable icons with proper padding
const maskableIconSizes = [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' }
];

async function generateIcons() {
  console.log('Generating icons from app_icon.avif...');
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error('Error: app_icon.avif not found in public directory');
    process.exit(1);
  }

  try {
    // Generate regular icon sizes
    for (const { size, name } of iconSizes) {
      await sharp(inputFile)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({ quality: 90 })
        .toFile(path.join(outputDir, name));
      
      console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    // Generate dedicated maskable icons with proper padding and green circular background
    for (const { size, name } of maskableIconSizes) {
      // For maskable icons, scale content to 70% and center it on a green circular background
      const iconSize = Math.round(size * 0.7);
      const padding = Math.round((size - iconSize) / 2);
      
      // Create green circular background using app theme color
      const greenCircle = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
      })
      .composite([{
        input: Buffer.from(`<svg width="${size}" height="${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 10}" fill="#00b488"/>
        </svg>`),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

      // Resize original icon and composite on green circle
      const resizedIcon = await sharp(inputFile)
        .resize(iconSize, iconSize, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      await sharp(greenCircle)
        .composite([{
          input: resizedIcon,
          top: padding,
          left: padding
        }])
        .png({ quality: 90 })
        .toFile(path.join(outputDir, name));
      
      console.log(`✓ Generated ${name} (${size}x${size}) [maskable with green circular background]`);
    }

    // Copy 32x32 PNG as favicon.ico
    fs.copyFileSync(
      path.join(outputDir, 'favicon-32x32.png'),
      path.join(outputDir, 'favicon.ico')
    );
    console.log('✓ Generated favicon.ico');

    console.log('✓ Generated all icon sizes successfully!');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
