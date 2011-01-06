var timer = import('lib/jstimer.jsm');

function shutdown()
{
	timer = null;
}

var EXPORTED_SYMBOLS = ['BackToOwner'];
 
function BackToOwner(aWindow) 
{
	this.init(aWindow);
}
BackToOwner.prototype = {
	
/* Utilities */ 
	
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
			('TreeStyleTabService' in this._window ? // Tree Style Tab
				!this._window.TreeStyleTabService.hasChildTabs(aTab) :
				true
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

		this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);

		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);
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

		this.updateCommand(aCommand);

		aCommand.addEventListener('command', this, true);
	},
 
	destroyCommand : function(aCommand) 
	{
		if (!aCommand) return;

		aCommand.removeEventListener('command', this, true);

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
		var w = this._window;
		return !aTab ? null :
				'TreeStyleTabService' in w ? w.TreeStyleTabService.getParentTab(aTab) :
				aTab.owner || null ;
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
			return;

		aEvent.stopPropagation();

		this.browser.selectedTab = owner;

		if (this.shouldCloseTab(tab))
			this.browser.removeTab(tab, { animate : true });
	},

/* nsIWebProgressListener */
	onStateChange : function() {},
	onProgressChange : function() {},
	onStatusChange : function() {},
	onSecurityChange : function() {},
	onLocationChange : function(aWebProgress, aRequest, aLocation)
	{
		this.updateCommands();
		// on Firefox 3.6, we have to do it with delay.
		timer.setTimeout(function(aSelf) { aSelf.updateCommands(); }, 0, this);
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
  
