# sidebar-media-folder-multi-select Specification

## Purpose
Defines multi-select behavior for the media folder list in the sidebar: keyboard select-all (Ctrl+A / Cmd+A), modifier+click toggle (Ctrl+Click / Cmd+Click), selection set and primary folder, and visual indication of selected and primary state.

## Requirements

### Requirement: User can select all visible media folders with keyboard
The system SHALL allow the user to select all currently visible media folders in the sidebar using Ctrl+A (Windows/Linux) or Cmd+A (macOS). "Visible" means the list after applying sort, filter, and search.

#### Scenario: Select all when focus is in sidebar list
- **WHEN** focus is within the sidebar media folder list (or the list container has keyboard focus)
- **AND** user presses Ctrl+A (Windows/Linux) or Cmd+A (macOS)
- **THEN** all visible media folder items are added to the selection set
- **THEN** primary selection (folder shown in content panel) is unchanged or set to the first visible folder

#### Scenario: Ctrl+A does not steal focus from search
- **WHEN** focus is in the sidebar search input (or another text field)
- **AND** user presses Ctrl+A or Cmd+A
- **THEN** the key combination is NOT handled by the sidebar list (e.g., text "Select All" in the input occurs as normal)
- **THEN** selection set is unchanged

### Requirement: User can toggle folder selection with modifier+click
The system SHALL allow the user to add or remove a media folder from the selection set without clearing other selections by Ctrl+Click (Windows/Linux) or Cmd+Click (macOS) on that folder.

#### Scenario: Ctrl+Click adds folder to selection
- **WHEN** user Ctrl+Clicks (or Cmd+Clicks on macOS) on a media folder item that is not currently selected
- **THEN** that folder is added to the selection set
- **THEN** other selected folders remain selected
- **THEN** the clicked folder becomes the primary selection (content panel shows that folder)

#### Scenario: Ctrl+Click removes folder from selection
- **WHEN** user Ctrl+Clicks (or Cmd+Clicks on macOS) on a media folder item that is already selected
- **THEN** that folder is removed from the selection set
- **THEN** other selected folders remain selected
- **THEN** primary selection moves to another selected folder if the removed folder was primary (e.g., last remaining or first of remaining)

#### Scenario: Plain click replaces selection
- **WHEN** user clicks a media folder item without Ctrl/Cmd
- **THEN** the selection set is replaced with only that folder
- **THEN** that folder becomes the primary selection
- **THEN** content panel shows that folder (existing behavior)

### Requirement: Sidebar exposes selection set and primary to parent
The system SHALL expose the current selection set (set of folder paths) and the primary folder path to the parent (e.g., AppV2) so that bulk operations (e.g., import, batch actions) can use the selected folders.

#### Scenario: Parent receives selected paths
- **WHEN** user has selected one or more media folders (via click, Ctrl+Click, or Ctrl+A)
- **THEN** parent component has access to the set of selected folder paths
- **THEN** parent component has access to the primary folder path (the one driving the content panel)
- **THEN** when selection changes, parent receives updated selection and primary

### Requirement: Selected and primary state are visually indicated
The system SHALL show which folders are in the selection set and optionally which is primary (e.g., distinct highlight for primary).

#### Scenario: Selected items are visually highlighted
- **WHEN** a media folder is in the selection set
- **THEN** that folder item is rendered with selected styling (e.g., background highlight)
- **THEN** primary folder MAY have a stronger or distinct style from other selected items
