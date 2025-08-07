// Adapted version that works with existing toast from sonner
import { toast } from "sonner"

// This is a simplified version that doesn't actually do anything special
// but matches the API expectations in the calendar component
export function useToast() {
  return {
    toast
  }
} 