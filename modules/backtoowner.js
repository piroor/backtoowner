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
  
/* Initializing */ 
	
	init : function(aWindow) 
	{
		if (!('gBrowser' in aWindow)) return;
		this._window = aWindow;

		this._window.addEventListener('unload', this, false);
		this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);
		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);
	},
 
	destroy : function() 
	{
		this._window.removeEventListener('unload', this, false);
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

			case 'command':
				return this.onCommand(aEvent);
		}
	},

	onCommand : function(aEvent)
	{
		dump('onCommand\n');
	},

/* nsIWebProgressListener */
	onStateChange : function() {},
	onProgressChange : function() {},
	onStatusChange : function() {},
	onSecurityChange : function() {},
	onLocationChange : function(aWebProgress, aRequest, aLocation)
	{
		this.updateCommand(this.backCommand);
		this.updateCommand(this.backOrDuplicateCommand);
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
  
