# angular-stackables ChangeLog

### Fixed
- Fix popover positioning by removing delta between
  popover content and its trigger element.
- Fix popover positioning bug by canceling reposition
  scheduling and only scheduling a reposition when
  the popover is shown.

### Changed
- Update dialog-polyfill dependency to 0.4.3. This also includes adding
  AMD/CommonJS support, by necessity.

## 1.0.1 - 2016-06-23

### Fixed
- Properly account for destroyed modals.

## 1.0.0 - 2016-04-09

- See git history for changes.