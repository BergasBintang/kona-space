// Where each screen sits on the Screens page.
export const COLS = [
  { x: 0, title: 'First time you open Kona', names: ['F1 Welcome', 'F2 Checking this PC', 'F2c Checks passed', 'F2b Claude is missing', 'F2e Not signed in', 'F3 Add your first project', '14 Add project', 'F4 Creating the project', 'F5 Project ready'] },
  { x: 1600, title: 'Sessions', names: ['1 Sessions / Chat', '1b Chat, answered yes', '1c Chat, answered no', '2 Sessions / Changes', '13 New session', '12 Command palette', 'S2 Sessions, loading', 'S3 Login expired'] },
  { x: 3200, title: 'Board and project', names: ['3 Board', '4 Board / Ticket open', 'S1 Board, empty', '5 Files', '6 Worktrees'] },
  { x: 4800, title: 'Costs, roles, upkeep', names: ['7 Costs', '8 Roles', '9 Leftovers', '9b Leftovers, confirm', '11 Settings'] },
  { x: 6400, title: 'Brain', names: ['10 Brain', '10a Brain / Notes', '10b Brain / Report', '10c Brain / Ask, found', '10d Brain / Ask, partly', '10e Brain / Ask, not in the brain'] },
  // the collapsed twins are made by build-rail.mjs, after the wiring step, and placed by it
];
