# angular-stackables ChangeLog

## 1.1.3 - 2017-03-06

### Fixed
- Fix page reload bug when hitting `back` on stacked modals.

## 1.1.2 - 2017-02-27

### Fixed
- Remove logging.

## 1.1.1 - 2017-02-27

### Fixed
- Fix history bug with descendants.

## 1.1.0 - 2017-02-26

### Added
- Handle `back` button when stackables are open.

## 1.0.3 - 2016-07-08

### Fixed
- Remove scrolling adjustment as it is no longer broken in Chrome.

## 1.0.2 - 2016-06-28

### Fixed
- Fix popover positioning by removing delta between
  popover content and its trigger element.
- Fix popover positioning bug by canceling reposition
  scheduling and only scheduling a reposition when
  the popover is shown.
- Fix popover z-index bug when using polyfill.

### Changed
- Update dialog-polyfill dependency to 0.4.3. This also includes adding
  AMD/CommonJS support, by necessity.

## 1.0.1 - 2016-06-23

### Fixed
- Properly account for destroyed modals.

## 1.0.0 - 2016-04-09

- See git history for changes.
