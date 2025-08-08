import fs from 'fs';
import path from 'path';

// Define the settings interface
export interface Settings {
  ical: {
    autoSync: boolean;
    syncInterval: string;
    lastSync: string | null;
  };
  bankAccounts: string[];
}

// Default settings
const defaultSettings: Settings = {
  ical: {
    autoSync: false,
    syncInterval: '15',
    lastSync: null,
  },
  bankAccounts: [
    'CU',
    'JCB Unit 1', 
    'JCB Unit 2',
    'SWJC',
    '185 CR',
    '234 CR',
    'Sofia 378'
  ]
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
      const parsedSettings = JSON.parse(fileContents) as Partial<Settings>;
      
      // Merge with defaults to ensure all properties exist
      const mergedSettings: Settings = {
        ical: {
          ...defaultSettings.ical,
          ...parsedSettings.ical
        },
        bankAccounts: parsedSettings.bankAccounts || defaultSettings.bankAccounts
      };
      
      // If bank accounts were missing, update the file
      if (!parsedSettings.bankAccounts) {
        console.log('Bank accounts missing from settings. Adding defaults.');
        fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
      }
      
      return mergedSettings;
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
      bankAccounts: settings.bankAccounts || currentSettings.bankAccounts,
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

// Function to get bank accounts
export function getBankAccounts(): string[] {
  try {
    const settings = getSettings();
    return settings.bankAccounts || [];
  } catch (error) {
    console.error('Error getting bank accounts:', error);
    return defaultSettings.bankAccounts;
  }
}

// Function to add a bank account
export function addBankAccount(bankAccount: string): Settings {
  try {
    const currentSettings = getSettings();
    
    // Check if bank account already exists
    if (currentSettings.bankAccounts.includes(bankAccount)) {
      throw new Error('Bank account already exists');
    }
    
    const updatedBankAccounts = [...currentSettings.bankAccounts, bankAccount];
    
    return updateSettings({
      bankAccounts: updatedBankAccounts
    });
  } catch (error) {
    console.error('Error adding bank account:', error);
    throw error;
  }
}

// Function to remove a bank account
export function removeBankAccount(bankAccount: string): Settings {
  try {
    const currentSettings = getSettings();
    
    const updatedBankAccounts = currentSettings.bankAccounts.filter(
      account => account !== bankAccount
    );
    
    return updateSettings({
      bankAccounts: updatedBankAccounts
    });
  } catch (error) {
    console.error('Error removing bank account:', error);
    throw error;
  }
} 