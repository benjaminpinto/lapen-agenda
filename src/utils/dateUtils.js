/**
 * Date utilities for timezone-aware operations
 */

/**
 * Get today's date in local timezone (YYYY-MM-DD format)
 * This prevents timezone conversion issues when setting min date for inputs
 */
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get tomorrow's date in local timezone (YYYY-MM-DD format)
 */
export const getTomorrowDateString = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return getLocalDateString(tomorrow)
}

/**
 * Get current year in local timezone
 */
export const getCurrentYear = () => {
  return new Date().getFullYear()
}

/**
 * Get current month in local timezone (1-12)
 */
export const getCurrentMonth = () => {
  return new Date().getMonth() + 1
}

/**
 * Check if a date string is today in local timezone
 */
export const isToday = (dateString) => {
  return dateString === getLocalDateString()
}

/**
 * Check if a date string is in the past (before today in local timezone)
 */
export const isPastDate = (dateString) => {
  const today = getLocalDateString()
  return dateString < today
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return ''
  
  // If it's already in YYYY-MM-DD format, parse directly
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }
  
  // Handle Date object or ISO string with UTC
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  
  return `${day}/${month}/${year}`
}