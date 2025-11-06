# v0.1.0

## 🐛 Critical Bug Fixes
- Fixed missing WebSocket handler registration for `meal_planner/update` command
- Fixed week calculation typo causing Monday week start to fail
- Fixed duplicate `saveMeal()` functions causing conflicts
- Fixed options flow registration for sidebar configuration

## ⚡ Improvements
- Added comprehensive input validation (date format, string lengths, URL validation)
- Added input sanitization (removes null bytes, enforces max lengths)
- Implemented library size limit (max 1,000 items with auto-eviction)
- Implemented scheduled meals limit (max 5,000 items with auto-cleanup)
- Fixed memory leak in event listeners (now using event delegation)
- Added delete confirmation dialog for bulk operations

## 🎨 Frontend Enhancements
- Added detailed console logging for debugging
- Added delete confirmation modal with proper styling
- Improved error messages for better user experience
- Added `.danger` button styling for delete actions

## 📊 Dashboard Cards
- Created complete Lovelace dashboard cards:
  - Weekly horizontal grid (calendar-style)
  - Weekly vertical grid (mobile-friendly)
  - Potential meals card (unscheduled meals list)
- Added comprehensive README with installation instructions
- Includes both enhanced and basic versions for users with/without custom cards

## 🔒 Security
- URL validation now enforces HTTP/HTTPS protocols only
- Input length limits enforced server-side
- Null byte sanitization prevents injection attacks
- Library and scheduled meals limits prevent storage bloat

## 📝 Documentation
- Added comprehensive INSTALLATION_GUIDE.md
- Added troubleshooting steps
- Added success checklist
- Updated example Lovelace cards

---

# v0.0.1
- initial test build
