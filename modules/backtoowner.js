var WindowManager = import('lib/WindowManager.js');
var timer = import('lib/jstimer.jsm');
var prefs = import('lib/prefs.js').prefs;

function shutdown()
{
	WindowManager = void(0);
	timer = void(0);
	prefs = void(0);
}

var EXPORTED_SYMBOLS = ['BackToOwner'];
 
function BackToOwner(aWindow) 
{
	this.init(aWindow);
}
BackToOwner.prototype = {
	PREFROOT : 'extensions.backtoowner@piro.sakura.ne.jp.',

	defaultPrefs : {
		'shouldCloseTab' : true
	},

	initPrefs : function()
	{
		for (var i in this.defaultPrefs)
		{
			if (prefs.getPref(this.PREFROOT+i) === null)
				prefs.setPref(this.PREFROOT+i, this.defaultPrefs[i]);
		}
	},
	
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

	get browser() 
	{
		return this._window.gBrowser;
	},
	
	get backCommand() 
	{
		return this._window.document.getElementById('Browser:Back');
	},

	get backOrDuplicateCommand() 
	{
		return this._window.document.getElementById('Browser:BackOrBackDuplicate');
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
  
/* Initializing */ 
	
	init : function(aWindow) 
	{
		if (!('gBrowser' in aWindow)) return;
		this._window = aWindow;

		this.initPrefs();

		this._window.addEventListener('unload', this, false);
		this._window.addEventListener('TreeStyleTabAttached', this, false);
		this._window.addEventListener('TreeStyleTabParted', this, false);

		this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);

		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);

		timer.setTimeout(function(aSelf) { aSelf.updateCommands(); }, 0, this);
	},
 
	destroy : function() 
	{
		this._window.removeEventListener('unload', this, false);
		this._window.removeEventListener('TreeStyleTabAttached', this, false);
		this._window.removeEventListener('TreeStyleTabParted', this, false);

		this.browser.removeProgressListener(this);

		this.destroyCommand(this.backCommand);
		this.destroyCommand(this.backOrDuplicateCommand);

		this._window = null;
	},
  
/* main */ 
	
	initCommand : function(aCommand) 
	{
		if (!aCommand) return;

		if (this.isLegacy) { // Firefox 3.6 or older doesn't fire DOMXULCommand events on original command elements.
			aCommand.setAttribute('oncommand', 'if (backToOwner.onCommand(event)) return; '+aCommand.getAttribute('oncommand'));
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

		if (this.browser.canGoBack)
			aCommand.removeAttribute('disabled');
		else
			aCommand.setAttribute('disabled', true);
	},

	updateCommand : function(aCommand)
	{
		if (
			aCommand &&
			!this.browser.canGoBack &&
			this.getOwner(this.browser.selectedTab)
			)
			aCommand.removeAttribute('disabled');
	},

	updateCommands : function()
	{
		this.updateCommand(this.backCommand);
		this.updateCommand(this.backOrDuplicateCommand);
	},

	getOwner : function(aTab)
	{
		if (!aTab)
			return null;

		var w = this._window;
		var owner = 'TreeStyleTabService' in w ? w.TreeStyleTabService.getParentTab(aTab) :
					aTab.owner || null ;

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

			case 'command':
				return this.onCommand(aEvent);
		}
	},

	onCommand : function(aEvent)
	{
		var tab = this.browser.selectedTab;
		var owner = this.getOwner(tab);
		if (!owner)
			return false;

		aEvent.stopPropagation();

		this.browser.selectedTab = owner;

		if (this.shouldCloseTab(tab))
			this.browser.removeTab(tab, { animate : true });

		return true;
	},

/* nsIWebProgressListener */
	onStateChange : function() {},
	onProgressChange : function() {},
	onStatusChange : function() {},
	onSecurityChange : function() {},
	onLocationChange : function(aWebProgress, aRequest, aLocation)
	{
		this.updateCommands();

		if (this.isLegacy) {
			// on Firefox 3.6 or olders, we have to do it with delay.
			timer.setTimeout(function(aSelf) { aSelf.updateCommands(); }, 0, this);
		}
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
  
