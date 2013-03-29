# History

 - master/HEAD
 - 0.3.2012122901
   * Wosk on Nightly 20.0a1.
   * Drop support for Firefox 9 and older versions.
   * Fixed: Free memory completely on disabled.
 - 0.3.2011110601
   * Fixed: On some environments, failed to find DOM windows by Z-order and didn't work. (regression on 0.3.2011110101)
 - 0.3.2011110101
   * Improved: More intelligent back/forward across multiple windows.
 - 0.2.2011083101
   * Improved: Menu items for owner/next tab are available in the popup menu on fhe back/forward button.
   * Fixed: Doesn't use Function#arity anymore.
 - 0.2.2011082902
   * Fixed: Relation of tabs based on the pref "browser.tabs.insertRelatedAfterCurrent" are now initialized correctly.
 - 0.2.2011082901
   * Improved: Support "go forward" axis.
   * Improved: Support AppCommand events (fired by 5-buttons mouse and so on).
   * Fixed: When this is updated, unexpectedly activated even if this is disabled by user.
   * Fixed: The owner tab was unexpectedly focused if "back" command is fired for in-page links.
 - 0.1.2011051101
   * Works on Nightly.
 - 0.1.2011012802
   * Fixed: Failed to initialize the configuration dialog.
 - 0.1.2011012801
   * Works on MInefield 4.0b11pre.
   * Improved: Configuration dialog is land.
   * Modified: Tabs are not closed by default.
   * Modified: Tree of tabs are not closed by default.
 - 0.1.2011010701
   * Fixed: On Firefox 3.6, "Back" command always closed the current tab wrongly even if the tab had histories to back.
 - 0.1.2011010601
   * Released.
