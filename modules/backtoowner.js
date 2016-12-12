/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Back to Owner Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/

load('lib/WindowManager');
load('lib/prefs');
var timer = load('lib/jstimer');

load('config');

function shutdown()
{
	WindowManager = void(0);
	prefs = void(0);
	timer = void(0);
}

var EXPORTED_SYMBOLS = ['BackToOwner'];
 
function BackToOwner(aWindow) 
{
	this.init(aWindow);
	aWindow.backToOwner = this;
}
BackToOwner.prototype = {
	PREFROOT              : 'extensions.backtoowner@piro.sakura.ne.jp.',
	FAKE_CAN_GO_BACK      : 'backtoowner-fake-can-go-back',
	FAKE_CAN_GO_FORWARD   : 'backtoowner-fake-can-go-forward',
	LAST_FOCUSED          : 'backtoowner-last-tocused',
	NEXT_IS_CLOSED        : 'backtoowner-next-is-closed',
	NEXT_IS_CLOSED_WINDOW : 'backtoowner-next-is-closed-window',
	UNDO_CLOSE_TAB        : 'undo-close-tab',
	UNDO_CLOSE_WINDOW     : 'undo-close-window',
	OWNER                 : 'backtoowner-owner',
	ID                    : 'backtoowner-id',
	EXTRA_MENU_ITEM       : 'backtoowner-menu-item',
	HISTORY_POPUP         : 'backtoowner-history-popup',
	
/* Utilities */ 
	
	get isLegacy()
	{
		return this.Comparator.compare(this.XULAppInfo.version, '4.0b1') < 0;
	},
	get XULAppInfo()
	{
		return this._XULAppInfo ||
				(this._XULAppInfo = Cc['@mozilla.org/xre/app-info;1']
									.getService(Ci.nsIXULAppInfo)
									.QueryInterface(Ci.nsIXULRuntime));
	},
	get Comparator() {
		return this._Comparator ||
				(this._Comparator = Cc['@mozilla.org/xpcom/version-comparator;1']
									.getService(Ci.nsIVersionComparator));
	},
	get SessionStore() { 
		return this._SessionStore ||
				(this._SessionStore = Cc['@mozilla.org/browser/sessionstore;1']
									.getService(Ci.nsISessionStore));
	},

	get document()
	{
		return this._window.document;
	},

	get browser() 
	{
		return this._window.gBrowser;
	},
	get selectedTab()
	{
		return this.browser.selectedTab;
	},
	set selectedTab(aTab)
	{
		if (!aTab)
			return aTab;

		var doc = aTab.ownerDocument;
		if (this.browser.ownerDocument == doc)
			return this.browser.selectedTab = aTab;

		WindowManager.getWindows('navigator:browser')
			.some(function(aWindow) {
				if (aWindow.document != doc)
					return false;

				aWindow.gBrowser.selectedTab = aTab;
				aTab.linkedBrowser.contentWindow.focus();
				return true;
			}, this);

		return aTab;
	},

	get treeStyleTab() 
	{
		return 'TreeStyleTabService' in this._window ? this._window.TreeStyleTabService : null ;
	},

	get canGoBack()
	{
		return this.browser.canGoBack;
	},
	get canGoForward()
	{
		return this.browser.canGoForward;
	},
	
	get backCommand() 
	{
		return this.document.getElementById('Browser:Back');
	},
	get backOrDuplicateCommand() 
	{
		return this.document.getElementById('Browser:BackOrBackDuplicate');
	},

	get forwardCommand() 
	{
		return this.document.getElementById('Browser:Forward');
	},
	get forwardOrDuplicateCommand() 
	{
		return this.document.getElementById('Browser:ForwardOrForwardDuplicate');
	},

	get backForwardMenu()
	{
		return this.document.getElementById('backForwardMenu');
	},
	get backForwardMenuDropmarker() // Firefox 3.6 (legacy)
	{
		var button = this.document.getElementById('back-forward-dropmarker');
		if (button)
			return button.getElementsByTagName('menupopup')[0];
		return null;
	},

	shouldCloseTab : function(aTab)
	{
		return (
			aTab &&
			!aTab.hasAttribute('pinned') && // App Tabs (Firefox 4), Tab Utilities
			!aTab.hasAttribute('protected') && // Tab Utilities, Tab Mix Plus
			prefs.getPref(this.PREFROOT+'shouldCloseTab')
		);
	},

	shouldCloseWindow : function(aTab)
	{
		var b = this.browser;
		return (
			!aTab.hasAttribute('protected') && // Tab Utilities, Tab Mix Plus
			(this.treeStyleTab ?
				(this.treeStyleTab.getDescendantTabs(aTab).length + 1 == b.browsers.length) :
				(b.browsers.length == 1 && b.selectedTab == aTab)
				)
		);
	},
  
/* Initializing */ 
	
	init : function(aWindow) 
	{
		if (!('gBrowser' in aWindow)) return;
		this._window = aWindow;

		this._window.addEventListener('unload', this, false);
		this._window.addEventListener('TreeStyleTabAttached', this, false);
		this._window.addEventListener('TreeStyleTabParted', this, false);
		this._window.addEventListener('TabOpen', this, false);
		this._window.addEventListener('TabClose', this, false);
		this._window.addEventListener('TabSelect', this, false);
		this._window.addEventListener('AppCommand', this, true);

		if (this.browser.addProgressListener.length == 1) // Firefox 4.1 or later
			this.browser.addProgressListener(this);
		else
			this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);

		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);
		this.initCommand(this.forwardCommand);
		this.initCommand(this.forwardOrDuplicateCommand);

		this.backForwardMenuFake = this.document.createElement('menupopup');
		this.document.getElementById('mainPopupSet').appendChild(this.backForwardMenuFake);
		this.initPopup(this.backForwardMenuFake);
		this.initPopup(this.backForwardMenu);
		this.initPopup(this.backForwardMenuDropmarker);

		timer.setTimeout(function(aSelf) {
			aSelf.updateCommands();
		}, 0, this);
	},
 
	destroy : function() 
	{
		var ownerTab = this.getOwnerTab(this.selectedTab);
		if (ownerTab && ownerTab.ownerDocument != this.document) {
			this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED, 'true');
			this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED_WINDOW, 'true');
		}

		this._window.removeEventListener('unload', this, false);
		this._window.removeEventListener('TreeStyleTabAttached', this, false);
		this._window.removeEventListener('TreeStyleTabParted', this, false);
		this._window.removeEventListener('TabOpen', this, false);
		this._window.removeEventListener('TabClose', this, false);
		this._window.removeEventListener('TabSelect', this, false);
		this._window.removeEventListener('AppCommand', this, true);

		this.browser.removeProgressListener(this);

		this.destroyCommand(this.backCommand);
		this.destroyCommand(this.backOrDuplicateCommand);
		this.destroyCommand(this.forwardCommand);
		this.destroyCommand(this.forwardOrDuplicateCommand);

		this.destroyPopup(this.backForwardMenuFake);
		this.backForwardMenuFake.parentNode.removeChild(this.backForwardMenuFake);
		this.backForwardMenuFake = null;
		this.destroyPopup(this.backForwardMenu);
		this.destroyPopup(this.backForwardMenuDropmarker);

		delete this._window.backToOwner;
		this._window = null;
	},
  
/* main */ 
	
	initCommand : function(aCommand) 
	{
		if (!aCommand) return;

		if (this.isLegacy) { // Firefox 3.6 or older doesn't fire DOMXULCommand events on original command elements.
			if (aCommand == this.backCommand ||
				aCommand == this.backOrDuplicateCommand) {
				aCommand.setAttribute('oncommand', 'if (backToOwner.onBackCommand(event)) return; '+aCommand.getAttribute('oncommand'));
			}
			else {
				aCommand.setAttribute('oncommand', 'if (backToOwner.onForwardCommand(event)) return; '+aCommand.getAttribute('oncommand'));
			}
		}
		else {
			aCommand.addEventListener('command', this, true);
		}
	},
 
	destroyCommand : function(aCommand) 
	{
		if (!aCommand) return;

		if (this.isLegacy) { // Firefox 3.6 or older doesn't fire DOMXULCommand events on original command elements.
		}
		else {
			aCommand.removeEventListener('command', this, true);
		}

		if (aCommand == this.backCommand ||
			aCommand == this.backOrDuplicateCommand) {
			aCommand.removeAttribute(this.FAKE_CAN_GO_BACK);

			if (this.canGoBack)
				aCommand.removeAttribute('disabled');
			else
				aCommand.setAttribute('disabled', true);
		}
		else {
			aCommand.removeAttribute(this.FAKE_CAN_GO_FORWARD);

			if (this.canGoForward)
				aCommand.removeAttribute('disabled');
			else
				aCommand.setAttribute('disabled', true);

			this.setForwardButtonOcclusion(!this.canGoForward);
		}
	},

	updateCommand : function(aCommand, aForceUpdate)
	{
		if (!aCommand)
			return;

		if (aCommand == this.backCommand ||
			aCommand == this.backOrDuplicateCommand) {
			if (
				!this.canGoBack &&
				this.getOwnerTab(this.selectedTab)
				) {
				aCommand.setAttribute(this.FAKE_CAN_GO_BACK, true);
				aCommand.removeAttribute('disabled');
			}
			else {
				aCommand.removeAttribute(this.FAKE_CAN_GO_BACK);
				if (aForceUpdate) {
					if (!this.canGoBack)
						aCommand.setAttribute('disabled', true);
					else
						aCommand.removeAttribute('disabled');
				}
			}
		}
		else {
			if (
				!this.canGoForward &&
				this.getNextTab(this.selectedTab)
				) {
				aCommand.setAttribute(this.FAKE_CAN_GO_FORWARD, true);
				aCommand.removeAttribute('disabled');
				this.setForwardButtonOcclusion(false);
			}
			else {
				aCommand.removeAttribute(this.FAKE_CAN_GO_FORWARD);
				if (aForceUpdate) {
					if (!this.canGoForward)
						aCommand.setAttribute('disabled', true);
					else
						aCommand.removeAttribute('disabled');
					this.setForwardButtonOcclusion(!this.canGoForward);
				}
			}
		}
	},
	setForwardButtonOcclusion : function(aOccluded)
	{
		if ('CombinedBackForward' in this._window)
			this._window.CombinedBackForward.setForwardButtonOcclusion(aOccluded);
	},

	updateCommands : function(aForceUpdate)
	{
		this.updateCommand(this.backCommand, aForceUpdate);
		this.updateCommand(this.backOrDuplicateCommand, aForceUpdate);
		this.updateCommand(this.forwardCommand, aForceUpdate);
		this.updateCommand(this.forwardOrDuplicateCommand, aForceUpdate);
	},

	initPopup : function(aPopup) 
	{
		if (!aPopup) return;
		aPopup.addEventListener('popupshowing', this, false);
		aPopup.addEventListener('popuphiding', this, true);
	},

	destroyPopup : function(aPopup) 
	{
		if (!aPopup) return;
		try {
			aPopup.removeEventListener('popupshowing', this, false);
			aPopup.removeEventListener('popuphiding', this, true);
		}
		catch(e) {
			// on Firefox 3.6, customizable toolbar item can be not-initialized.
		}
	},

	insertTabItems : function(aPopup)
	{
		if (!aPopup)
			return;

		this.removeTabItems(aPopup);

		// for backForwardMenuFake
		if (!aPopup.hasChildNodes()) {
			let item = this.document.createElement('menuitem');
			item.setAttribute('label', this.selectedTab.label);
			item.setAttribute('type', 'radio');
			item.setAttribute('checked', 'true');
			item.setAttribute('class', 'unified-nav-current '+this.EXTRA_MENU_ITEM);
			item.setAttribute('tooltiptext', this._window.gNavigatorBundle.getString('tabHistory.current'));
			aPopup.appendChild(item);
		}

		var ownerTab = this.getOwnerTab(this.selectedTab);
		if (ownerTab) {
			let fragment = this.document.createDocumentFragment();
			let item = fragment.appendChild(this.document.createElement('menuitem'));
			item.setAttribute('label', ownerTab.label);
			item.setAttribute('class', 'unified-nav-back menuitem-iconic menuitem-with-favicon '+this.EXTRA_MENU_ITEM);
			item.setAttribute('oncommand', 'backToOwner.onBackCommand(event, true); this.parentNode.hidePopup()');
			item.setAttribute('tooltiptext', this._window.gNavigatorBundle.getString('tabHistory.goBack'));
			if (aPopup.hasChildNodes()) {
				let separator = fragment.insertBefore(this.document.createElement('menuseparator'), item);
				separator.setAttribute('class', this.EXTRA_MENU_ITEM);
			}
			aPopup.appendChild(fragment);
		}

		var nextTab = this.getNextTab(this.selectedTab);
		if (nextTab && nextTab instanceof this._window.Element) {
			let fragment = this.document.createDocumentFragment();
			let item = fragment.appendChild(this.document.createElement('menuitem'));
			item.setAttribute('label', nextTab.label);
			item.setAttribute('class', 'unified-nav-forward menuitem-iconic menuitem-with-favicon '+this.EXTRA_MENU_ITEM);
			item.setAttribute('oncommand', 'backToOwner.onForwardCommand(event, true); this.parentNode.hidePopup()');
			item.setAttribute('tooltiptext', this._window.gNavigatorBundle.getString('tabHistory.goForward'));
			if (aPopup.hasChildNodes()) {
				let separator = fragment.appendChild(this.document.createElement('menuseparator'));
				separator.setAttribute('class', this.EXTRA_MENU_ITEM);
			}
			aPopup.insertBefore(fragment, aPopup.firstChild);
		}
	},
	removeTabItems : function(aPopup)
	{
		if (!aPopup)
			return;

		var items = aPopup.querySelectorAll('.'+this.EXTRA_MENU_ITEM);
		for (let aItem of items)
		{
			aItem.parentNode.removeChild(aItem);
		}
	},

	getOwnerTab : function(aTab)
	{
		if (!aTab)
			return null;

		var owner = this.treeStyleTab ?
						this.treeStyleTab.getParentTab(aTab) :
						aTab.owner || null ;

		var removingTabs = this.browser._removingTabs || [];
		if (removingTabs.indexOf(owner) > -1)
			owner = null;

		if (!owner) {
			let id = this.getOwnerId(aTab);
			if (id) {
				WindowManager.getWindows('navigator:browser')
					.some(function(aWindow) {
						var tabs = [...aWindow.gBrowser.mTabContainer.childNodes];
						var removingTabs = aWindow.gBrowser._removingTabs || [];
						if (tabs.some(function(aTab) {
								if (this.getTabId(aTab) == id &&
									removingTabs.indexOf(aTab) < 0)
									return owner = aTab;
								return false;
							}, this))
							return true;
						return false;
					}, this);
			}
		}

		if (!owner) {
			let lastRelated = this.browser._lastRelatedTab;
			if (
				removingTabs.indexOf(aTab) < 0 &&
				lastRelated &&
				lastRelated._tPos <= aTab._tPos &&
				aTab._tPos > this.selectedTab._tPos
				)
				owner = this.selectedTab;
		}

		if (!owner) {
			let openerChromeWindow = aTab.ownerDocument.defaultView.opener;
			let childDocument = aTab.linkedBrowser.contentDocument;
			let childWindow = aTab.linkedBrowser.contentWindow;
			let childURI = childDocument.referrer;
			let opener = childWindow.opener || openerChromeWindow;
			if (opener) {
				opener = opener.top || opener;
				WindowManager.getWindows('navigator:browser')
					.some(function(aWindow) {
						var b = aWindow.gBrowser;
						var selectedTab = b.selectedTab;
						var tabs = [...b.mTabContainer.childNodes];
						var removingTabs = b._removingTabs || [];
						tabs.splice(tabs.indexOf(selectedTab), 1);
						tabs.unshift(selectedTab);
						if (tabs
							.some(function(aTab) {
								if (
									aTab.linkedBrowser &&
									(
										aTab.linkedBrowser.contentWindow == opener ||
										(
											aWindow == openerChromeWindow &&
											this.checkTabContainsPage(aTab, childURI)
										)
									) &&
									removingTabs.indexOf(aTab) < 0
									)
									return owner = aTab;
								return false;
							}, this))
							return true;
						return false;
					}, this);
			}
		}

		return owner;
	},
	checkTabContainsPage : function(aTab, aURI)
	{
		aURI = String(aURI);
		return (function checkMatched(aFrame) {
			if (aFrame.location.href == aURI)
				return true;
			return Array.prototype.some.call(aFrame.frames, checkMatched);
		})(aTab.linkedBrowser.contentWindow);
	},

	getNextTab : function(aTab)
	{
		if (!aTab)
			return null;

		try {
			if (this.SessionStore.getTabValue(aTab, this.NEXT_IS_CLOSED) == 'true')
				return this.SessionStore.getTabValue(aTab, this.NEXT_IS_CLOSED_WINDOW) == 'true' ?
						this.UNDO_CLOSE_WINDOW :
						this.UNDO_CLOSE_TAB ;
		}
		catch(e) {
		}

		var children = [];
		if (this.treeStyleTab) {
			children = this.treeStyleTab.getChildTabs(aTab);
		}
		if (!children.length) {
			let opener = aTab.linkedBrowser.contentWindow;
			let id = this.getTabId(aTab);
			children = [];
			WindowManager.getWindows('navigator:browser')
				.forEach(function(aWindow) {
					var tabs = [...aWindow.gBrowser.mTabContainer.childNodes];
					var removingTabs = aWindow.gBrowser._removingTabs;
					tabs.forEach(function(aCheckingTab) {
						if (
							aTab != aCheckingTab &&
							(
								aTab == aCheckingTab.owner ||
								aCheckingTab.linkedBrowser.contentWindow.opener == opener ||
								this.getOwnerId(aCheckingTab) == id
							) &&
							removingTabs.indexOf(aCheckingTab) < 0
							)
							children.push(aCheckingTab);
					}, this);
				}, this);
		}

		var self = this;
		children.sort(function(aA, aB) {
			var a = 0;
			var b = 0;
			try {
				a = self.SessionStore.getTabValue(aA, self.LAST_FOCUSED);
			}
			catch(e) {
			}
			try {
				b = self.SessionStore.getTabValue(aB, self.LAST_FOCUSED);
			}
			catch(e) {
			}
			return b - a;
		});

		return children.length ? children[0] : null ;
	},

	getTabId : function(aTab)
	{
		if (!aTab)
			return '';

		var id;
		try {
			id = this.SessionStore.getTabValue(aTab, this.ID);
			if (id)
				return id;
		}
		catch(e) {
		}
		var id = Date.now()+'-'+parseInt(Math.random() * 10000);
		this.SessionStore.setTabValue(aTab, this.ID, id);
		return id;
	},

	getOwnerId : function(aTab)
	{
		try {
			if (aTab)
				return this.SessionStore.getTabValue(aTab, this.OWNER);
		}
		catch(e) {
		}
		return '';
	},

	setOwnerTab : function(aTab, aOwnerTab)
	{
		if (!aTab || !aTab.parentNode)
			return null;

		var tab = this.selectedTab;
		var ownerTab = aOwnerTab || this.getOwnerTab(aTab);
		if (ownerTab)
			this.SessionStore.setTabValue(aTab, this.OWNER, this.getTabId(ownerTab));

		return ownerTab;
	},

	closeTab : function(aTab)
	{
		if (
			this.treeStyleTab &&
			this.treeStyleTab.removeTabSubtree &&
			prefs.getPref(this.PREFROOT+'shouldCloseTree') &&
			this.treeStyleTab.hasChildTabs(aTab)
			)
			this.treeStyleTab.removeTabSubtree(aTab);
		else
			this.browser.removeTab(aTab, { animate : true });
	},
 
/* event handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'unload':
				return this.destroy();

			case 'TreeStyleTabAttached':
			case 'TreeStyleTabParted':
				if (aEvent.target == this.selectedTab)
					this.updateCommands();
				return;

			case 'TabOpen':
				timer.setTimeout(function(aSelf, aTab) {
					// we have to do this with delay because tab's relations are updated
					// after the TabOpen event is fired.
					aSelf.setOwnerTab(aTab);
					if (!aTab.selected)
						aSelf.updateCommands(true);
				}, 0, this, aEvent.originalTarget);
				return;

			case 'TabClose':
				return this.updateCommands(aEvent.originalTarget != this.selectedTab);

			case 'TabSelect':
				return this.SessionStore.setTabValue(aEvent.originalTarget, this.LAST_FOCUSED, String(Date.now()));

			case 'popupshowing':
				if (aEvent.target == aEvent.currentTarget) {
					let popup = aEvent.target;
					if (popup != this.backForwardMenuFake &&
						this.selectedTab.linkedBrowser.sessionHistory.count <= 1) {
						// the original popup menu is canceled by Firefox, so reopen fake popup.
						let anchorNode = popup.triggerNode || this.document.getElementById('back-button');
						let position = 'after_pointer';
						let isContext = true;
						if (popup == this.backForwardMenuDropmarker) {
							anchorNode = popup.parentNode;
							position = 'after_start';
							isContext = false;
						}
						this.backForwardMenuFake.openPopup(anchorNode, position, 0, 0, isContext, false, aEvent);
						aEvent.preventDefault();
					}
					else {
						this.insertTabItems(popup);
					}
				}
				return;

			case 'popuphiding':
				if (aEvent.target == aEvent.currentTarget)
					this.removeTabItems(aEvent.target);
				return;

			case 'AppCommand':
				switch (aEvent.command)
				{
					case 'Back':
						return this.onBackCommand(aEvent);
					case 'Forward':
						return this.onForwardCommand(aEvent);
				}
				return;
			case 'command':
				if (/back/i.test(aEvent.target.id || ''))
					return this.onBackCommand(aEvent);
				else if (/forward/i.test(aEvent.target.id || ''))
					return this.onForwardCommand(aEvent);
				else
					return;
		}
	},

	onBackCommand : function(aEvent, aForce)
	{
		if (
			!aForce &&
			(
				this.canGoBack ||
				(
					(
						!this.backCommand ||
						this.backCommand.getAttribute(this.FAKE_CAN_GO_BACK) != 'true'
					) &&
					(
						!this.backOrDuplicateCommand ||
						this.backOrDuplicateCommand.getAttribute(this.FAKE_CAN_GO_BACK) != 'true'
					)
				)
			)
			)
			return false;

		var tab = this.selectedTab;
		var ownerTab = this.getOwnerTab(tab);
		if (!ownerTab)
			return false;

		aEvent.stopPropagation();

		var isDifferentWindow = ownerTab.ownerDocument != this.document;
		this.setOwnerTab(tab, ownerTab);
		this.selectedTab = ownerTab;

		if (isDifferentWindow) {
			if (prefs.getPref(this.PREFROOT+'shouldCloseWindow') &&
				prefs.getPref('browser.tabs.closeWindowWithLastTab') &&
				this.shouldCloseWindow(tab)) {
				this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED, 'true');
				this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED_WINDOW, 'true');
				timer.setTimeout(function(aSelf) { aSelf._window.close(); }, 0, this);
			}
		}
		else if (this.shouldCloseTab(tab)) {
			this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED, 'true');
			this.closeTab(tab);
		}

		return true;
	},

	onForwardCommand : function(aEvent, aForce)
	{
		if (
			!aForce &&
			(
				this.canGoForward ||
				(
					(
						!this.forwardCommand ||
						this.forwardCommand.getAttribute(this.FAKE_CAN_GO_FORWARD) != 'true'
					) &&
					(
						!this.forwardOrDuplicateCommand ||
						this.forwardOrDuplicateCommand.getAttribute(this.FAKE_CAN_GO_FORWARD) != 'true'
					)
				)
			)
			)
			return false;

		var tab = this.selectedTab;
		var nextTab = this.getNextTab(tab);
		if (!nextTab)
			return false;

		aEvent.stopPropagation();

		switch (nextTab)
		{
			case this.UNDO_CLOSE_WINDOW:
				this.SessionStore.setTabValue(tab, this.NEXT_IS_CLOSED, '');
				this.SessionStore.setTabValue(tab, this.NEXT_IS_CLOSED_WINDOW, '');
				{
					let win = this._window.undoCloseWindow();
					let self = this;
					win.addEventListener('load', function() {
						win.removeEventListener('load', arguments.callee, false);
						self.setOwnerTab(win.gBrowser.selectedTab, tab);
					}, false);
				}
				break;

			case this.UNDO_CLOSE_TAB:
				this.SessionStore.setTabValue(tab, this.NEXT_IS_CLOSED, '');
				nextTab = this._window.undoCloseTab();
				break;

			default:
				this.selectedTab = nextTab;
				break;
		}

		if (nextTab && nextTab instanceof this._window.Element)
			this.setOwnerTab(nextTab, tab);

		return true;
	},

/* nsIWebProgressListener */
	onStateChange : function() {},
	onProgressChange : function() {},
	onStatusChange : function() {},
	onSecurityChange : function() {},
	onLocationChange : function(aWebProgress, aRequest, aLocation)
	{
		// this.updateCommands();
		// do with delay, because...
		//  * Firefox sometimes disables commands after this method is called.
		//  * Firefox changes the state of "canGoBack" before "command" command is fired, if it is in-page link.
		timer.setTimeout(function(aSelf) {
			aSelf.updateCommands();
			var ownerTab = aSelf.setOwnerTab(aSelf.selectedTab);
			if (ownerTab && ownerTab.ownerDocument != aSelf.document)
				ownerTab.ownerDocument.defaultView.backToOwner.updateCommands(true);
		}, 0, this);
	},

/* nsIWebProgressListener2 */
	onProgressChange64 : function() {},
	onRefreshAttempted : function() { return true; },

/* nsISupports */
	QueryInterface : function (aIID)
	{
		if (aIID.equals(Ci.nsIWebProgressListener) ||
			aIID.equals(Ci.nsIWebProgressListener2) ||
			aIID.equals(Ci.nsISupports))
			return this;
		throw Cr.NS_NOINTERFACE;
	}
  
};
  
