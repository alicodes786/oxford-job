import fs from 'fs';
import path from 'path';

// Define the settings interface
export interface Settings {
  ical: {
    autoSync: boolean;
    syncInterval: string;
    lastSync: string | null;
  };
}

// Default settings
const defaultSettings: Settings = {
  ical: {
    autoSync: false,
    syncInterval: '15',
    lastSync: null,
  },
};

// Path to the settings file
const settingsPath = path.join(process.cwd(), 'settings.json');

// Function to read settings from file
export function getSettings(): Settings {
  try {
    // Check if the file exists
    if (!fs.existsSync(settingsPath)) {
      // Create the file with default settings if it doesn't exist
      try {
        console.log('Settings file not found. Creating with default settings at:', settingsPath);
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
        console.log('Default settings file created successfully');
      } catch (writeError) {
        console.error('Error creating settings file:', writeError);
        console.log('Using default settings from memory');
      }
      return defaultSettings;
    }

    // Read and parse the settings file
    const fileContents = fs.readFileSync(settingsPath, 'utf8');
    try {
      return JSON.parse(fileContents) as Settings;
    } catch (parseError) {
      console.error('Error parsing settings JSON:', parseError);
      console.log('Resetting to default settings');
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
  } catch (error) {
    console.error('Error reading settings:', error);
    return defaultSettings;
  }
}

// Function to update settings
export function updateSettings(settings: Partial<Settings>): Settings {
  try {
    // Get current settings
    const currentSettings = getSettings();
    
    // Merge with updates
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      ical: {
        ...currentSettings.ical,
        ...(settings.ical || {}),
      },
    };
    
    // Write to file
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
    
    return updatedSettings;
  } catch (error) {
    console.error('Error updating settings:', error);
    return getSettings();
  }
}

// Function to update specific iCal settings
export function updateIcalSettings(icalSettings: Partial<Settings['ical']>): Settings {
  try {
    const currentSettings = getSettings();
    
    const updatedSettings = {
      ...currentSettings,
      ical: {
        ...currentSettings.ical,
        ...icalSettings,
      },
    };
    
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
    
    return updatedSettings;
  } catch (error) {
    console.error('Error updating iCal settings:', error);
    return getSettings();
  }
} 