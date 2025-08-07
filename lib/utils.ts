import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Special case groupings for listings
const SPECIAL_GROUP_MAPPINGS: Record<string, string> = {
  'BR1': 'BR',
  'BR2': 'BR',
  'BR3': 'BR',
  'BR4': 'BR',
  'BR5': 'BR',
  'BR6': 'BR',
  '5WJ': '5WJ',
  '5WJ2': '5WJ'
};

/**
 * Gets the base group name for a listing
 * @param name The listing name
 * @returns The base group name
 */
export const getListingGroupName = (name: string): string => {
  if (!name) return 'Unknown';

  // First check if this is a special case
  const upperName = name.toUpperCase().trim();
  if (SPECIAL_GROUP_MAPPINGS[upperName]) {
    return SPECIAL_GROUP_MAPPINGS[upperName];
  }

  // Then check for dot notation
  const parts = name.split('.');
  return parts[0].trim();
};

/**
 * Groups listings by their base name
 * @param items Array of items with a name property
 * @returns Record of grouped items by base name
 */
export const groupListingsByName = <T extends { name: string }>(items: T[]): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};
  
  items.forEach(item => {
    const groupName = getListingGroupName(item.name);
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(item);
  });
  
  // Sort items within each group
  Object.keys(groups).forEach(groupName => {
    groups[groupName].sort((a, b) => {
      // For special cases, sort by the full name
      if (SPECIAL_GROUP_MAPPINGS[a.name.toUpperCase()] || SPECIAL_GROUP_MAPPINGS[b.name.toUpperCase()]) {
        return a.name.localeCompare(b.name);
      }

      // For dot notation, sort by the number after the dot
      const aNameParts = a.name.split('.');
      const bNameParts = b.name.split('.');
      
      // If either doesn't have a part after the dot, use string comparison
      if (aNameParts.length <= 1 || bNameParts.length <= 1) {
        return a.name.localeCompare(b.name);
      }
      
      // Try to parse the parts after the dot as numbers
      const aValue = parseFloat(aNameParts[1]);
      const bValue = parseFloat(bNameParts[1]);
      
      // If both are valid numbers, sort numerically
      if (!isNaN(aValue) && !isNaN(bValue)) {
        return aValue - bValue;
      }
      
      // Otherwise sort alphabetically
      return aNameParts[1].localeCompare(bNameParts[1]);
    });
  });
  
  return groups;
};

// Helper function to calculate Monday-Sunday boundaries for any date
export function getWeekBoundaries(date: Date) {
  // Clone the date to avoid modifying the original
  const day = new Date(date);
  const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday (first day of week)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If today is Sunday, Monday was 6 days ago
  const monday = new Date(day);
  monday.setDate(day.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  // Calculate Sunday (last day of week) - EXACTLY 6 days after Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
}
