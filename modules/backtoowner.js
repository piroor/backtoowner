var EXPORTED_SYMBOLS = ['BackToOwner'];
 
function BackToOwner(aWindow) 
{
	this.init(aWindow);
}
BackToOwner.prototype = {
	
/* Utilities */ 
	
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
		this.initCommand(this.backCommand);
		this.initCommand(this.backOrDuplicateCommand);
	},
 
	destroy : function() 
	{
		this._window.removeEventListener('unload', this, false);
		this.destroyCommand(this.backCommand);
		this.destroyCommand(this.backOrDuplicateCommand);
		this._window = null;
	},
  
/* main */ 
	
	initCommand : function(aCommand) 
	{
		if (!aCommand) return;

		aCommand.addEventListener('DOMAttrModified', this, false);
		aCommand.addEventListener('command', this, true);
	},
 
	destroyCommand : function(aCommand) 
	{
		if (!aCommand) return;

		aCommand.removeEventListener('DOMAttrModified', this, false);
		aCommand.removeEventListener('command', this, true);
	},
 
 
/* event handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'unload':
				return this.destroy();

			case 'DOMAttrModified':
				return this.onChangeAttribute(aEvent);

			case 'command':
				return this.onCommand(aEvent);
		}
	},

	onChangeAttribute : function(aEvent)
	{
		dump('onChangeAttribute\n');
	},

	onCommand : function(aEvent)
	{
		dump('onCommand\n');
	}
  
};
  
