# Changelog

## 2.0.2 — 2026-10-06

- Fixed returning from a past week when its selected weekday falls after today in the current week.
- Removed the combined contribution calendar from Today and the all-activities calendar view.
- Added dedicated activity-calendar browsing, automatic calendars for new activities, and direct logging from each calendar.
- Calendar colors reflect only the selected activity, with clear states for partial progress, recovery, missed targets, and unscheduled days.
- Added regression coverage for every weekday navigation combination, calendar isolation, and activity lifecycle boundaries.


## 2.0.1 — 2026-09-27

- Organize the offline app as a standalone Android project.
- Replace specialist learning labels with general computer science and software-development routines.
- Update unchanged starter labels on existing installations without removing check-ins or custom routine names.
- Remove unused hosted-app code, platform branding, and unnecessary dependencies from the Android project.
- Add build scripts, continuous integration, and user/developer documentation.

## 2.0.0 — 2026-09-27

- Bundle the full tracker interface inside the Android app.
- Add private SQLite storage, bottom navigation, and Android file-picker backups.
- Support offline habits, streaks, calendars, goals, notes, and weekly reviews.
- Remove browser launching and network requirements.
