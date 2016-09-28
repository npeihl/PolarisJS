# Change Log

Notable changes to this project will be documented in this file, however changes to the map layers, data, etc may not be included here.

The format is based on [Keep a Changelog](http://keepachangelog.com) and this project adheres to [Semantic Versioning](http://semver.org)

## [Unreleased]
### Added
- Add ability to create minimized builds using the Dojo build system
- Add service worker support for JavaScript and CSS assets
- Add grunt and npm tools for installation

### Changed
- Move JavaScript from inline to separate file
- Upgrade to Esri JSAPI version 3.17
- Upgrade Intro.js to version 2.3.0
- JavaScript and CSS assets are served locally instead of using a CDN

### Removed
- Remove source code for Intro.js
- Remove CDN links from index.html (See installation instructions in README.md)


## [1.0.2] - 2016-04-18
### Fixed
- Fix bug where point measurement was clearing the result before the user could read it

## [1.0.1] - 2016-04-08
### Fixed
- Fix typo that was breaking application

## [1.0.0] - 2016-04-08 [YANKED]
### Added
- First final release