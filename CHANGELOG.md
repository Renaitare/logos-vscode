# Change Log

Changes for each minor version will be documented here.
The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## **[0.2.5]** - 2020-06-01

### Added

-   Internal support for a prepackaged clang binary (this is coming soon)
-   Cleaned up the codebase slightly for future modifications.

## **[0.2.4]** - 2020-05-08

### Changed

-   Updated `package.json` with the removal of the `tslint` dependency as it is now deprecated
-   Switched to using **PNPM** over **Yarn** and added the according lock-files to the `.gitignore` file

-   Completely rewrote the Logos Syntax highlighting to actually work and not break. (Special thanks to [Kritanta](https://github.com/KritantaDev))

## **[0.2.3]** - 2020-05-07

### Changed

-   Updated `package.json` with the removal of the enable/disable entries

### Removed

-   The abililty to enable/disable formatting for languages as that should be done in _VS Code User Settings_

## **[0.2.2]** - 2020-05-06

_Formatting_

### Changed

-   Updated `package.json` with preference entries and project dependencies

### Added

-   Support for formatting _Logos_, _Objective-C_, & _Objective-C++_
-   Added preferences to specify `clang-format` executable path along with styling
-   Extension source with formatting code _(written in Typescript)_

## **[0.2.1]** - 2020-05-05

_Initial Public Release_

### Added

-   Main Project Boilerplate
-   Logos Syntax Highlighting
