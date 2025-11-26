import { format } from 'date-fns';

interface RecurrenceSettings {
  frequency: string;
  time: string;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  monthOfYear?: number; // 1-12
  originalText?: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Format time from HH:MM string to display format (e.g., "6:00 PM")
 */
function formatTimeDisplay(time: string): string {
  // Validate time format - if invalid, return null to signal detection failure
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
    return '9:00 AM'; // Default fallback
  }

  try {
    return format(new Date(`2000-01-01T${time}`), 'h:mm a');
  } catch (error) {
    // Silently fail - return default instead of throwing
    return '9:00 AM';
  }
}

/**
 * Extract day of week from originalText for weekly patterns
 */
function extractDayOfWeek(originalText: string): number | null {
  const dayPatterns: [RegExp, number][] = [
    [/\bsun(day)?\b/i, 0],
    [/\bmon(day)?\b/i, 1],
    [/\btue(sday)?\b/i, 2],
    [/\bwed(nesday)?\b/i, 3],
    [/\bthu(rsday)?\b/i, 4],
    [/\bfri(day)?\b/i, 5],
    [/\bsat(urday)?\b/i, 6],
  ];

  for (const [pattern, day] of dayPatterns) {
    if (pattern.test(originalText)) {
      return day;
    }
  }
  return null;
}

/**
 * Check if pattern is biweekly (every other)
 */
function isBiweekly(originalText: string): boolean {
  return /\bevery\s+(other|2nd|second)\b/i.test(originalText);
}

/**
 * Format recurrence settings into a uniform display string
 * Examples:
 * - Monthly on the 3rd at 6:00 PM
 * - Yearly on August 3rd at 6:00 PM
 * - Weekly on Tuesday at 6:00 PM
 * - Biweekly on Tuesday at 6:00 PM
 * - Daily at 6:00 PM
 * - Every 2 hours
 * - Every 30 minutes
 */
export function formatRecurrence(recurrence: RecurrenceSettings): string {
  const { frequency, time, interval, dayOfMonth, dayOfWeek, monthOfYear, originalText } = recurrence;

  // For interval-based (minutely/hourly), ALWAYS use recurrence.time (not reminderDate)
  // The recurrence.time is set to current time when created, which is the correct start time
  const timeDisplay = formatTimeDisplay(time);

  switch (frequency) {
    case 'minutely':
      return `Every ${interval || 1} minute${(interval || 1) > 1 ? 's' : ''} starting at ${timeDisplay}`;

    case 'hourly': {
      const hrs = interval || 1;
      return `Every ${hrs === 1 ? 'hour' : `${hrs} hours`} starting at ${timeDisplay}`;
    }

    case 'daily':
      return `Daily at ${timeDisplay}`;

    case 'weekly': {
      // Check for biweekly first
      const biweekly = originalText ? isBiweekly(originalText) : false;
      const prefix = biweekly ? 'Biweekly' : 'Weekly';

      // Get day of week
      let day: number | undefined = dayOfWeek;
      if (day === undefined && originalText) {
        const extracted = extractDayOfWeek(originalText);
        if (extracted !== null) day = extracted;
      }

      if (day !== undefined) {
        return `${prefix} on ${DAYS_OF_WEEK[day]} at ${timeDisplay}`;
      }
      return `${prefix} at ${timeDisplay}`;
    }

    case 'monthly': {
      if (dayOfMonth) {
        return `Monthly on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} at ${timeDisplay}`;
      }
      return `Monthly at ${timeDisplay}`;
    }

    case 'yearly': {
      if (monthOfYear && dayOfMonth) {
        return `Yearly on ${MONTHS[monthOfYear - 1]} ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} at ${timeDisplay}`;
      }
      return `Yearly at ${timeDisplay}`;
    }

    default:
      // Fallback to originalText if available
      if (originalText) {
        let displayText = originalText.charAt(0).toUpperCase() + originalText.slice(1);
        return `${displayText} at ${timeDisplay}`;
      }
      return `${frequency} at ${timeDisplay}`;
  }
}
