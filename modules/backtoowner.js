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
}
BackToOwner.prototype = {
	PREFROOT            : 'extensions.backtoowner@piro.sakura.ne.jp.',
	FAKE_CAN_GO_BACK    : 'backtoowner-fake-can-go-back',
	FAKE_CAN_GO_FORWARD : 'backtoowner-fake-can-go-forward',
	LAST_FOCUSED        : 'backtoowner-last-tocused',
	NEXT_IS_CLOSED      : 'backtoowner-next-is-clised',
	UNDO_CLOSE_TAB      : 'undo',
	OWNER               : 'backtoowner-owner',
	ID                  : 'backtoowner-id',
	
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

	get browser() 
	{
		return this._window.gBrowser;
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
		return this._window.document.getElementById('Browser:Back');
	},
	get backOrDuplicateCommand() 
	{
		return this._window.document.getElementById('Browser:BackOrBackDuplicate');
	},

	get forwardCommand() 
	{
		return this._window.document.getElementById('Browser:Forward');
	},
	get forwardOrDuplicateCommand() 
	{
		return this._window.document.getElementById('Browser:ForwardOrForwardDuplicate');
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
				) &&
			prefs.getPref('browser.tabs.closeWindowWithLastTab')
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
		this._window.addEventListener('TabSelect', this, false);
		this._window.addEventListener('AppCommand', this, true);

		if (this.browser.addProgressListener.arity == 1) // Firefox 4.1 or later
			this.browser.addProgressListener(this);
		else
			this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);

		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);
		this.initCommand(this.forwardCommand);
		this.initCommand(this.forwardOrDuplicateCommand);

		timer.setTimeout(function(aSelf) { aSelf.updateCommands(); }, 0, this);
	},
 
	destroy : function() 
	{
		this._window.removeEventListener('unload', this, false);
		this._window.removeEventListener('TreeStyleTabAttached', this, false);
		this._window.removeEventListener('TreeStyleTabParted', this, false);
		this._window.removeEventListener('TabSelect', this, false);
		this._window.removeEventListener('AppCommand', this, true);

		this.browser.removeProgressListener(this);

		this.destroyCommand(this.backCommand);
		this.destroyCommand(this.backOrDuplicateCommand);
		this.destroyCommand(this.forwardCommand);
		this.destroyCommand(this.forwardOrDuplicateCommand);

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
		}
	},

	updateCommand : function(aCommand)
	{
		if (!aCommand)
			return;

		if (aCommand == this.backCommand ||
			aCommand == this.backOrDuplicateCommand) {
			if (
				!this.canGoBack &&
				this.getOwnerTab(this.browser.selectedTab)
				) {
				aCommand.setAttribute(this.FAKE_CAN_GO_BACK, true);
				aCommand.removeAttribute('disabled');
			}
			else {
				aCommand.removeAttribute(this.FAKE_CAN_GO_BACK);
			}
		}
		else {
			if (
				!this.canGoForward &&
				this.getNextTab(this.browser.selectedTab)
				) {
				aCommand.setAttribute(this.FAKE_CAN_GO_FORWARD, true);
				aCommand.removeAttribute('disabled');
			}
			else {
				aCommand.removeAttribute(this.FAKE_CAN_GO_FORWARD);
			}
		}
	},

	updateCommands : function()
	{
		this.updateCommand(this.backCommand);
		this.updateCommand(this.backOrDuplicateCommand);
		this.updateCommand(this.forwardCommand);
		this.updateCommand(this.forwardOrDuplicateCommand);
	},

	getOwnerTab : function(aTab)
	{
		if (!aTab)
			return null;

		var owner = this.treeStyleTab ?
						this.treeStyleTab.getParentTab(aTab) :
						aTab.owner || null ;

		if (!owner) {
			let id = this.getOwnerId(aTab);
			if (id) {
				WindowManager.getWindows('navigator:browser')
					.some(function(aWindow) {
						if (Array.slice(aWindow.gBrowser.mTabContainer.childNodes)
								.some(function(aTab) {
									if (this.getTabId(aTab) == id)
										return owner = aTab;
									return false;
								}, this))
							return true;
						return false;
					}, this);
			}
		}

		if (!owner) {
			let opener = aTab.linkedBrowser.contentWindow.opener;
			if (opener) {
				opener = opener.top || opener;
				WindowManager.getWindows('navigator:browser')
					.some(function(aWindow) {
						if (Array.slice(aWindow.gBrowser.mTabContainer.childNodes)
								.some(function(aTab) {
									if (aTab.linkedBrowser.contentWindow == opener)
										return owner = aTab;
									return false;
								}))
							return true;
						return false;
					});
			}
		}

		return owner;
	},

	getNextTab : function(aTab)
	{
		if (!aTab)
			return null;

		try {
			if (this.SessionStore.getTabValue(ownerTab, this.NEXT_IS_CLOSED) == 'true')
				return this.UNDO_CLOSE_TAB;
		}
		catch(e) {
		}

		var children;
		if (this.treeStyleTab) {
			children = this.treeStyleTab.getChildTabs(aTab);
		}
		else {
			let opener = aTab.linkedBrowser.contentWindow;
			let id = this.getTabId(aTab);
			children = [];
			WindowManager.getWindows('navigator:browser')
				.forEach(function(aWindow) {
					Array.slice(aWindow.gBrowser.mTabContainer.childNodes)
						.forEach(function(aCheckingTab) {
							if (
								aTab != aCheckingTab &&
								(
									aTab == aCheckingTab.owner ||
									aCheckingTab.linkedBrowser.contentWindow.opener == opener ||
									this.getOwnerId(aCheckingTab) == id
								)
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
		var id = (new Date()).getTime()+'-'+parseInt(Math.random() * 10000);
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
				if (aEvent.target == this.browser.selectedTab)
					this.updateCommands();
				return;

			case 'TabSelect':
				this.SessionStore.setTabValue(aEvent.originalTarget, this.LAST_FOCUSED, (new Date()).getTime());
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

	onBackCommand : function(aEvent)
	{
		if (
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
			return false;

		var tab = this.browser.selectedTab;
		var ownerTab = this.getOwnerTab(tab);
		if (!ownerTab)
			return false;

		aEvent.stopPropagation();

		if (ownerTab.ownerDocument == this._window.document) {
			this.SessionStore.setTabValue(tab, this.OWNER, this.getTabId(ownerTab));
			this.browser.selectedTab = ownerTab;
		}

		if (this.shouldCloseTab(tab)) {
			if (this.shouldCloseWindow(tab)) {
				timer.setTimeout(function(aSelf) { aSelf._window.close(); }, 0, this);
				ownerTab.linkedBrowser.contentWindow.focus();
			}
			else {
				this.SessionStore.setTabValue(ownerTab, this.NEXT_IS_CLOSED, 'true');
				this.closeTab(tab);
			}
		}

		return true;
	},

	onForwardCommand : function(aEvent)
	{
		if (
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
			return false;

		var tab = this.browser.selectedTab;
		var nextTab = this.getNextTab(tab);
		if (!nextTab)
			return false;

		aEvent.stopPropagation();

		if (nextTab == this.UNDO_CLOSE_TAB) {
			this.SessionStore.getTabValue(tab, this.NEXT_IS_CLOSED, '');
			nextTab = this._window.undoCloseTab();
		}
		else {
			if (nextTab.ownerDocument == this._window.document)
				this.browser.selectedTab = nextTab;
		}

		if (nextTab && nextTab instanceof Ci.nsIDOMElement)
			this.SessionStore.setTabValue(nextTab, this.OWNER, this.getTabId(tab));

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

			var tab = aSelf.browser.selectedTab;
			var ownerTab = aSelf.getOwnerTab(tab);
			if (ownerTab && ownerTab.ownerDocument == aSelf._window.document)
				aSelf.SessionStore.setTabValue(tab, aSelf.OWNER, aSelf.getTabId(ownerTab));
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
  
