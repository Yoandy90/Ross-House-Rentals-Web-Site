/**
 * US State Adjacency Map for auto-suggesting route states
 * Used in Trucker Tools to auto-mark states when origin/destination are entered
 */

// State adjacency (which states border each other)
export const STATE_ADJACENCY: Record<string, string[]> = {
  'AL': ['FL', 'GA', 'MS', 'TN'],
  'AK': [],
  'AZ': ['CA', 'CO', 'NM', 'NV', 'UT'],
  'AR': ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
  'CA': ['AZ', 'NV', 'OR'],
  'CO': ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'],
  'CT': ['MA', 'NY', 'RI'],
  'DE': ['MD', 'NJ', 'PA'],
  'FL': ['AL', 'GA'],
  'GA': ['AL', 'FL', 'NC', 'SC', 'TN'],
  'HI': [],
  'ID': ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  'IL': ['IN', 'IA', 'KY', 'MO', 'WI'],
  'IN': ['IL', 'KY', 'MI', 'OH'],
  'IA': ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
  'KS': ['CO', 'MO', 'NE', 'OK'],
  'KY': ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  'LA': ['AR', 'MS', 'TX'],
  'ME': ['NH'],
  'MD': ['DE', 'PA', 'VA', 'WV'],
  'MA': ['CT', 'NH', 'NY', 'RI', 'VT'],
  'MI': ['IN', 'OH', 'WI'],
  'MN': ['IA', 'ND', 'SD', 'WI'],
  'MS': ['AL', 'AR', 'LA', 'TN'],
  'MO': ['AR', 'IL', 'IA', 'KS', 'KY', 'NE', 'OK', 'TN'],
  'MT': ['ID', 'ND', 'SD', 'WY'],
  'NE': ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
  'NV': ['AZ', 'CA', 'ID', 'OR', 'UT'],
  'NH': ['MA', 'ME', 'VT'],
  'NJ': ['DE', 'NY', 'PA'],
  'NM': ['AZ', 'CO', 'OK', 'TX', 'UT'],
  'NY': ['CT', 'MA', 'NJ', 'PA', 'VT'],
  'NC': ['GA', 'SC', 'TN', 'VA'],
  'ND': ['MN', 'MT', 'SD'],
  'OH': ['IN', 'KY', 'MI', 'PA', 'WV'],
  'OK': ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'],
  'OR': ['CA', 'ID', 'NV', 'WA'],
  'PA': ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
  'RI': ['CT', 'MA'],
  'SC': ['GA', 'NC'],
  'SD': ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  'TN': ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
  'TX': ['AR', 'LA', 'NM', 'OK'],
  'UT': ['AZ', 'CO', 'ID', 'NV', 'NM', 'WY'],
  'VT': ['MA', 'NH', 'NY'],
  'VA': ['KY', 'MD', 'NC', 'TN', 'WV'],
  'WA': ['ID', 'OR'],
  'WV': ['KY', 'MD', 'OH', 'PA', 'VA'],
  'WI': ['IA', 'IL', 'MI', 'MN'],
  'WY': ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
};

/**
 * Extract state abbreviation from a "City, State" or "City, ST" string
 */
export const extractState = (text: string): string | null => {
  if (!text) return null;
  const cleaned = text.trim().toUpperCase();
  
  // Try to find a 2-letter state at the end after comma
  const commaMatch = cleaned.match(/,\s*([A-Z]{2})\s*$/);
  if (commaMatch) return commaMatch[1];
  
  // Try to find a 2-letter state at the end
  const endMatch = cleaned.match(/\s([A-Z]{2})$/);
  if (endMatch && STATE_ADJACENCY[endMatch[1]]) return endMatch[1];
  
  // Try state name mappings
  const stateNames: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY',
  };
  
  for (const [name, abbr] of Object.entries(stateNames)) {
    if (cleaned.includes(name)) return abbr;
  }
  
  return null;
};

/**
 * Find the shortest path between two states using BFS on the adjacency graph
 * Returns the list of states you'd travel through (inclusive of start and end)
 */
export const findRouteStates = (origin: string, destination: string): string[] => {
  const startState = extractState(origin);
  const endState = extractState(destination);
  
  if (!startState || !endState) return [];
  if (startState === endState) return [startState];
  if (!STATE_ADJACENCY[startState] || !STATE_ADJACENCY[endState]) return [];
  
  // BFS to find shortest path
  const queue: string[][] = [[startState]];
  const visited = new Set<string>([startState]);
  
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    
    const neighbors = STATE_ADJACENCY[current] || [];
    for (const neighbor of neighbors) {
      if (neighbor === endState) {
        return [...path, neighbor];
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  
  // If no path found (shouldn't happen in contiguous US), return just start/end
  return [startState, endState].filter(Boolean);
};
